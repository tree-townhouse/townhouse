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
	NotesRepository,
	UsersRepository,
} from '@/models/_.js';
import type { MiChannel } from '@/models/Channel.js';
import type { MiUser } from '@/models/User.js';
import { IdService } from '@/core/IdService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import { RoleService } from '@/core/RoleService.js';
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

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private idService: IdService,
		private notificationService: NotificationService,
		private noteDeleteService: NoteDeleteService,
		private roleService: RoleService,
	) {}

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

		// Create moderator invitation with pending status
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

		await this.channelModeratorsRepository.update(invitation.id, {
			status: 'accepted',
		});
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
	public async banUser(channelId: MiChannel['id'], bannerId: MiUser['id'], targetUserId: MiUser['id'], expiresAt?: Date | null): Promise<void> {
		// Check permission (channel admin/moderator or server admin)
		const isServerAdmin = await this.roleService.isAdministrator({ id: bannerId });
		if (!isServerAdmin && !await this.hasChannelManagePermission(channelId, bannerId)) {
			throw new Error('ACCESS_DENIED');
		}

		// Cannot ban the channel admin
		if (await this.isChannelAdmin(channelId, targetUserId)) {
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
			});
			return;
		}

		await this.channelBansRepository.insertOne({
			id: this.idService.gen(),
			channelId,
			userId: targetUserId,
			bannedById: bannerId,
			expiresAt: expiresAt ?? null,
		});

		// Also remove moderator status if the user was a moderator
		await this.channelModeratorsRepository.delete({
			channelId,
			userId: targetUserId,
		});
	}

	/**
	 * Unban a user from a channel
	 */
	@bindThis
	public async unbanUser(channelId: MiChannel['id'], unbannerId: MiUser['id'], targetUserId: MiUser['id']): Promise<void> {
		if (!await this.hasChannelManagePermission(channelId, unbannerId)) {
			throw new Error('ACCESS_DENIED');
		}

		await this.channelBansRepository.delete({
			channelId,
			userId: targetUserId,
		});
	}

	/**
	 * Check if a user is banned from a channel (respecting expiration)
	 */
	@bindThis
	public async isBanned(channelId: MiChannel['id'], userId: MiUser['id']): Promise<boolean> {
		const ban = await this.channelBansRepository.findOneBy({ channelId, userId });
		if (!ban) return false;

		// If ban has expired, remove it and return false
		if (ban.expiresAt && ban.expiresAt.getTime() < Date.now()) {
			await this.channelBansRepository.delete(ban.id);
			return false;
		}

		return true;
	}

	/**
	 * Get banned users for a channel (excluding expired bans)
	 */
	@bindThis
	public async getBannedUsers(channelId: MiChannel['id']): Promise<{ userId: string; bannedById: string; expiresAt: Date | null }[]> {
		const bans = await this.channelBansRepository.findBy({ channelId });

		// Filter out expired bans and clean them up
		const activeBans: { userId: string; bannedById: string; expiresAt: Date | null }[] = [];
		const expiredBanIds: string[] = [];

		for (const ban of bans) {
			if (ban.expiresAt && ban.expiresAt.getTime() < Date.now()) {
				expiredBanIds.push(ban.id);
			} else {
				activeBans.push({ userId: ban.userId, bannedById: ban.bannedById, expiresAt: ban.expiresAt });
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
}
