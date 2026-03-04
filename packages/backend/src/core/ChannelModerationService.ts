/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type {
	ChannelsRepository,
	ChannelModeratorsRepository,
	ChannelBansRepository,
	ChannelModerationLogsRepository,
	NotesRepository,
	UsersRepository,
} from '@/models/_.js';
import type { MiChannel } from '@/models/Channel.js';
import type { MiUser } from '@/models/User.js';
import { IdService } from '@/core/IdService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import { RoleService } from '@/core/RoleService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { SearchService } from '@/core/SearchService.js';
import type { ChannelModerationLogType } from '@/models/ChannelModerationLog.js';
import { bindThis } from '@/decorators.js';

@Injectable()
export class ChannelModerationService {
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.channelModeratorsRepository)
		private channelModeratorsRepository: ChannelModeratorsRepository,

		@Inject(DI.channelBansRepository)
		private channelBansRepository: ChannelBansRepository,

		@Inject(DI.channelModerationLogsRepository)
		private channelModerationLogsRepository: ChannelModerationLogsRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private idService: IdService,
		private notificationService: NotificationService,
		private noteDeleteService: NoteDeleteService,
		private roleService: RoleService,
		private globalEventService: GlobalEventService,
		private searchService: SearchService,
	) {}

	/**
	 * Log a channel moderation action
	 */
	@bindThis
	public async logAction(channelId: MiChannel['id'], userId: MiUser['id'], type: ChannelModerationLogType, info: Record<string, any> = {}): Promise<void> {
		await this.channelModerationLogsRepository.insertOne({
			id: this.idService.gen(),
			channelId,
			userId,
			type,
			info,
		});
	}

	/**
	 * Log a channel moderation action (internal alias)
	 */
	@bindThis
	private async log(channelId: MiChannel['id'], userId: MiUser['id'], type: ChannelModerationLogType, info: Record<string, any> = {}): Promise<void> {
		await this.logAction(channelId, userId, type, info);
	}

	/**
	 * Check if a user is the channel owner (admin)
	 */
	@bindThis
	public async isChannelAdmin(channelId: MiChannel['id'], userId: MiUser['id']): Promise<boolean> {
		const channel = await this.channelsRepository.findOneBy({ id: channelId });
		return channel != null && channel.userId === userId;
	}

	/**
	 * Check if a user is an accepted channel moderator
	 */
	@bindThis
	public async isChannelModerator(channelId: MiChannel['id'], userId: MiUser['id']): Promise<boolean> {
		return await this.channelModeratorsRepository.exists({
			where: {
				channelId,
				userId,
				status: 'accepted',
			},
		});
	}

	/**
	 * Check if a user has channel management permission (admin or accepted moderator)
	 */
	@bindThis
	public async hasChannelManagePermission(channelId: MiChannel['id'], userId: MiUser['id']): Promise<boolean> {
		return await this.isChannelAdmin(channelId, userId) || await this.isChannelModerator(channelId, userId);
	}

	/**
	 * Invite a user as channel moderator (sends notification, requires approval)
	 */
	@bindThis
	public async inviteModerator(channelId: MiChannel['id'], inviterId: MiUser['id'], inviteeId: MiUser['id']): Promise<void> {
		// Channel admin or server admin can invite moderators
		const isServerAdmin = await this.roleService.isAdministrator({ id: inviterId });
		if (!isServerAdmin && !await this.isChannelAdmin(channelId, inviterId)) {
			throw new Error('ACCESS_DENIED');
		}

		if (inviterId === inviteeId) {
			throw new Error('CANNOT_INVITE_SELF');
		}

		// Cannot invite the channel admin as moderator
		if (await this.isChannelAdmin(channelId, inviteeId)) {
			throw new Error('CANNOT_INVITE_ADMIN');
		}

		// Cannot invite a banned user as moderator
		const { banned } = await this.isBanned(channelId, inviteeId);
		if (banned) {
			throw new Error('USER_BANNED');
		}

		// Check if already a moderator
		const existing = await this.channelModeratorsRepository.findOneBy({
			channelId,
			userId: inviteeId,
		});

		if (existing) {
			if (existing.status === 'accepted') {
				throw new Error('ALREADY_MODERATOR');
			}
			if (existing.status === 'pending') {
				throw new Error('ALREADY_INVITED');
			}
			// If rejected, allow re-invitation by deleting old record
			await this.channelModeratorsRepository.delete(existing.id);
		}

		// Server admin: immediately appoint without invitation
		if (isServerAdmin) {
			await this.channelModeratorsRepository.insertOne({
				id: this.idService.gen(),
				channelId,
				userId: inviteeId,
				status: 'accepted',
			});
		} else {
			// Channel admin: create moderator invitation with pending status
			await this.channelModeratorsRepository.insertOne({
				id: this.idService.gen(),
				channelId,
				userId: inviteeId,
				status: 'pending',
			});

			// Send notification to the invitee
			this.notificationService.createNotification(inviteeId, 'channelModeratorInvitationReceived', {
				channelId,
			}, inviterId);
		}

		await this.log(channelId, inviterId, 'addModerator', { targetUserId: inviteeId });
	}

	/**
	 * Accept moderator invitation
	 */
	@bindThis
	public async acceptModeratorInvitation(channelId: MiChannel['id'], userId: MiUser['id']): Promise<void> {
		const invitation = await this.channelModeratorsRepository.findOneBy({
			channelId,
			userId,
			status: 'pending',
		});

		if (!invitation) {
			throw new Error('NO_INVITATION');
		}

		// Cannot accept if the user is banned from the channel
		const { banned } = await this.isBanned(channelId, userId);
		if (banned) {
			throw new Error('USER_BANNED');
		}

		await this.channelModeratorsRepository.update(invitation.id, {
			status: 'accepted',
		});

		// Notify the channel owner that the invitation was accepted
		const channel = await this.channelsRepository.findOneBy({ id: channelId });
		if (channel && channel.userId) {
			this.notificationService.createNotification(channel.userId, 'channelModeratorInvitationAccepted', {
				channelId,
			}, userId);
		}
	}

	/**
	 * Reject moderator invitation
	 */
	@bindThis
	public async rejectModeratorInvitation(channelId: MiChannel['id'], userId: MiUser['id']): Promise<void> {
		const invitation = await this.channelModeratorsRepository.findOneBy({
			channelId,
			userId,
			status: 'pending',
		});

		if (!invitation) {
			throw new Error('NO_INVITATION');
		}

		await this.channelModeratorsRepository.update(invitation.id, {
			status: 'rejected',
		});
	}

	/**
	 * Remove a moderator (channel admin or server admin can do this)
	 */
	@bindThis
	public async removeModerator(channelId: MiChannel['id'], adminId: MiUser['id'], moderatorId: MiUser['id']): Promise<void> {
		const isServerAdmin = await this.roleService.isAdministrator({ id: adminId });
		if (!isServerAdmin && !await this.isChannelAdmin(channelId, adminId)) {
			throw new Error('ACCESS_DENIED');
		}

		await this.channelModeratorsRepository.delete({
			channelId,
			userId: moderatorId,
		});

		await this.log(channelId, adminId, 'removeModerator', { targetUserId: moderatorId });
	}

	/**
	 * Get list of moderators for a channel
	 */
	@bindThis
	public async getModerators(channelId: MiChannel['id'], status?: 'pending' | 'accepted' | 'rejected'): Promise<{ userId: string; status: string }[]> {
		const where: Record<string, unknown> = { channelId };
		if (status) {
			where.status = status;
		}

		const moderators = await this.channelModeratorsRepository.findBy(where as any);
		return moderators.map((m: { userId: string; status: string }) => ({ userId: m.userId, status: m.status }));
	}

	/**
	 * Ban a user from a channel
	 */
	@bindThis
	public async banUser(channelId: MiChannel['id'], bannerId: MiUser['id'], targetUserId: MiUser['id'], expiresAt?: Date | null, reason?: string): Promise<void> {
		// Check permission (channel admin/moderator or server admin)
		const isServerAdmin = await this.roleService.isAdministrator({ id: bannerId });
		if (!isServerAdmin && !await this.hasChannelManagePermission(channelId, bannerId)) {
			throw new Error('ACCESS_DENIED');
		}

		// Cannot ban the channel admin
		if (await this.isChannelAdmin(channelId, targetUserId)) {
			throw new Error('CANNOT_BAN_ADMIN');
		}

		// Cannot ban server admins/moderators
		const targetIsServerAdmin = await this.roleService.isModerator({ id: targetUserId } as MiUser);
		if (targetIsServerAdmin) {
			throw new Error('CANNOT_BAN_ADMIN');
		}

		// Check if already banned
		const existing = await this.channelBansRepository.findOneBy({
			channelId,
			userId: targetUserId,
		});

		if (existing) {
			// Update expiration if already banned
			await this.channelBansRepository.update(existing.id, {
				expiresAt: expiresAt ?? null,
				bannedById: bannerId,
				reason: reason ?? '',
			});
			await this.log(channelId, bannerId, 'banUser', { targetUserId, expiresAt: expiresAt ?? null, reason: reason ?? '' });
			return;
		}

		await this.channelBansRepository.insertOne({
			id: this.idService.gen(),
			channelId,
			userId: targetUserId,
			bannedById: bannerId,
			expiresAt: expiresAt ?? null,
			reason: reason ?? '',
		});

		// Also remove moderator status if the user was a moderator
		await this.channelModeratorsRepository.delete({
			channelId,
			userId: targetUserId,
		});

		await this.log(channelId, bannerId, 'banUser', { targetUserId, expiresAt: expiresAt ?? null, reason: reason ?? '' });
	}

	/**
	 * Unban a user from a channel
	 */
	@bindThis
	public async unbanUser(channelId: MiChannel['id'], unbannerId: MiUser['id'], targetUserId: MiUser['id']): Promise<void> {
		const isServerAdmin = await this.roleService.isAdministrator({ id: unbannerId });
		if (!isServerAdmin && !await this.hasChannelManagePermission(channelId, unbannerId)) {
			throw new Error('ACCESS_DENIED');
		}

		await this.channelBansRepository.delete({
			channelId,
			userId: targetUserId,
		});

		await this.log(channelId, unbannerId, 'unbanUser', { targetUserId });
	}

	/**
	 * Check if a user is banned from a channel (respecting expiration)
	 */
	@bindThis
	public async isBanned(channelId: MiChannel['id'], userId: MiUser['id']): Promise<{ banned: boolean; reason?: string; expiresAt?: Date | null }> {
		const ban = await this.channelBansRepository.findOneBy({ channelId, userId });
		if (!ban) return { banned: false };

		// If ban has expired, remove it and return false
		if (ban.expiresAt && ban.expiresAt.getTime() < Date.now()) {
			await this.channelBansRepository.delete(ban.id);
			return { banned: false };
		}

		return { banned: true, reason: ban.reason || undefined, expiresAt: ban.expiresAt ?? null };
	}

	/**
	 * Get banned users for a channel (excluding expired bans)
	 */
	@bindThis
	public async getBannedUsers(channelId: MiChannel['id']): Promise<{ userId: string; bannedById: string; expiresAt: Date | null; reason: string }[]> {
		const bans = await this.channelBansRepository.findBy({ channelId });

		// Filter out expired bans and clean them up
		const activeBans: { userId: string; bannedById: string; expiresAt: Date | null; reason: string }[] = [];
		const expiredBanIds: string[] = [];

		for (const ban of bans) {
			if (ban.expiresAt && ban.expiresAt.getTime() < Date.now()) {
				expiredBanIds.push(ban.id);
			} else {
				activeBans.push({ userId: ban.userId, bannedById: ban.bannedById, expiresAt: ban.expiresAt, reason: ban.reason ?? '' });
			}
		}

		// Clean up expired bans in background
		if (expiredBanIds.length > 0) {
			this.channelBansRepository.delete(expiredBanIds);
		}

		return activeBans;
	}

	/**
	 * Delete a note from a channel (by channel admin/moderator or server admin)
	 */
	@bindThis
	public async deleteNote(channelId: MiChannel['id'], deleterId: MiUser['id'], noteId: string): Promise<void> {
		const isServerAdmin = await this.roleService.isAdministrator({ id: deleterId });
		if (!isServerAdmin && !await this.hasChannelManagePermission(channelId, deleterId)) {
			throw new Error('ACCESS_DENIED');
		}

		const note = await this.notesRepository.findOneBy({
			id: noteId,
			channelId,
		});

		if (!note) {
			throw new Error('NO_SUCH_NOTE');
		}

		const noteAuthor = await this.usersRepository.findOneByOrFail({ id: note.userId });
		const deleter = await this.usersRepository.findOneByOrFail({ id: deleterId });

		await this.noteDeleteService.delete(noteAuthor, note, false, deleter);

		await this.log(channelId, deleterId, 'deleteNote', { noteId, noteUserId: note.userId });
	}

	/**
	 * Blind or unblind a note in a channel (by channel admin/moderator or server admin/moderator)
	 */
	@bindThis
	public async blindNote(channelId: MiChannel['id'], operatorId: MiUser['id'], noteId: string, isBlinded: boolean): Promise<void> {
		const isServerMod = await this.roleService.isModerator({ id: operatorId });
		if (!isServerMod && !await this.hasChannelManagePermission(channelId, operatorId)) {
			throw new Error('ACCESS_DENIED');
		}

		const note = await this.notesRepository.findOneBy({
			id: noteId,
			channelId,
		});

		if (!note) {
			throw new Error('NO_SUCH_NOTE');
		}

		// Channel moderators cannot blind notes by the channel admin
		const isOperatorChannelAdmin = await this.isChannelAdmin(channelId, operatorId);
		if (!isServerMod && !isOperatorChannelAdmin) {
			// Operator is a channel moderator (not admin, not server mod)
			if (await this.isChannelAdmin(channelId, note.userId)) {
				throw new Error('ACCESS_DENIED');
			}
		}

		// Channel admins cannot blind notes by server admins/moderators
		if (!isServerMod) {
			if (await this.roleService.isModerator({ id: note.userId })) {
				throw new Error('ACCESS_DENIED');
			}
		}

		if (note.isBlinded === isBlinded) {
			return;
		}

		await this.notesRepository.update({ id: note.id }, {
			isBlinded,
		});

		note.isBlinded = isBlinded;
		this.searchService.unindexNote(note);
		this.searchService.indexNote(note);

		this.globalEventService.publishNoteStream(note.id, 'updated', {
			deleteAt: note.deleteAt ?? null,
			isBlinded: note.isBlinded,
		});

		this.globalEventService.publishBroadcastStream('noteUpdated', {
			id: note.id,
			type: 'updated',
			body: {
				deleteAt: note.deleteAt ?? null,
				isBlinded: note.isBlinded,
			},
		});

		await this.log(channelId, operatorId, isBlinded ? 'blindNote' : 'unblindNote', { noteId, noteUserId: note.userId, targetUserId: note.userId });
	}

	/**
	 * Transfer channel ownership to another user (server admin only)
	 */
	@bindThis
	public async transferOwnership(channelId: MiChannel['id'], requesterId: MiUser['id'], newOwnerId: MiUser['id']): Promise<void> {
		const isServerAdmin = await this.roleService.isAdministrator({ id: requesterId });
		if (!isServerAdmin) {
			throw new Error('ACCESS_DENIED');
		}

		const channel = await this.channelsRepository.findOneBy({ id: channelId });
		if (!channel) {
			throw new Error('NO_SUCH_CHANNEL');
		}

		// Remove new owner from moderators if they were one
		await this.channelModeratorsRepository.delete({
			channelId,
			userId: newOwnerId,
		});

		await this.channelsRepository.update(channelId, {
			userId: newOwnerId,
		});
	}

	/**
	 * Get moderation log entries for a channel
	 */
	@bindThis
	public async getLog(channelId: MiChannel['id'], limit = 50, sinceId?: string, untilId?: string, type?: string): Promise<{
		id: string;
		userId: string;
		type: string;
		info: Record<string, any>;
	}[]> {
		const query = this.channelModerationLogsRepository.createQueryBuilder('log')
			.where('log.channelId = :channelId', { channelId })
			.orderBy('log.id', 'DESC')
			.take(limit);

		if (sinceId) {
			query.andWhere('log.id > :sinceId', { sinceId });
		}
		if (untilId) {
			query.andWhere('log.id < :untilId', { untilId });
		}
		if (type) {
			query.andWhere('log.type = :type', { type });
		}

		const logs = await query.getMany();

		return logs.map((log: { id: string; userId: string; type: string; info: Record<string, any> }) => ({
			id: log.id,
			userId: log.userId,
			type: log.type,
			info: log.info,
		}));
	}
}
