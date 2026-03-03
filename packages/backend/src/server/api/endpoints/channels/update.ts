/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { DriveFilesRepository, ChannelsRepository } from '@/models/_.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { ChannelModerationService } from '@/core/ChannelModerationService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['channels'],

	requireCredential: true,

	prohibitRestricted: true,

	kind: 'write:channels',

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Channel',
	},

	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'f9c5467f-d492-4c3c-9a8d-a70dacc86512',
		},

		accessDenied: {
			message: 'You do not have edit privilege of the channel.',
			code: 'ACCESS_DENIED',
			id: '1fb7cb09-d46a-4fdf-b8df-057788cce513',
		},

		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'e86c14a4-0da2-4032-8df3-e737a04c7f3b',
		},

		cannotChangeChannelName: {
			message: 'Channel name cannot be changed by the channel admin.',
			code: 'CANNOT_CHANGE_CHANNEL_NAME',
			id: 'e0460b5e-1a02-4c29-a8b0-005002000002',
		},

		duplicateChannelName: {
			message: 'A channel with this name already exists.',
			code: 'DUPLICATE_CHANNEL_NAME',
			id: 'e0460b5e-1a02-4c29-a8b0-005002000003',
		},

		channelNotApproved: {
			message: 'This channel is not yet approved. Settings cannot be changed until approved.',
			code: 'CHANNEL_NOT_APPROVED',
			id: 'e0460b5e-1a02-4c29-a8b0-005002000004',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
		name: { type: 'string', minLength: 1, maxLength: 128 },
		description: { type: 'string', nullable: true, maxLength: 2048 },
		bannerId: { type: 'string', format: 'misskey:id', nullable: true },
		pinnedNoteIds: {
			type: 'array',
			items: {
				type: 'string', format: 'misskey:id',
			},
		},
		color: { type: 'string', minLength: 1, maxLength: 16 },
		isSensitive: { type: 'boolean', nullable: true },
		allowRenoteToExternal: { type: 'boolean', nullable: true },
	},
	required: ['channelId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private channelEntityService: ChannelEntityService,

		private channelModerationService: ChannelModerationService,

		private moderationLogService: ModerationLogService,

		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({
				id: ps.channelId,
			});

			if (channel == null) {
				throw new ApiError(meta.errors.noSuchChannel);
			}

			const iAmModerator = await this.roleService.isModerator(me);
			const isChannelAdmin = channel.userId === me.id;
			const isChannelModerator = await this.channelModerationService.isChannelModerator(channel.id, me.id);

			// Block updates on unapproved channels (only server admins can update)
			if (!channel.isApproved && !iAmModerator) {
				throw new ApiError(meta.errors.channelNotApproved);
			}

			// Channel moderators can only update pinnedNoteIds
			if (isChannelModerator && !isChannelAdmin && !iAmModerator) {
				// Only allow pinnedNoteIds update
				if (ps.name !== undefined || ps.description !== undefined || ps.bannerId !== undefined ||
					ps.color !== undefined || ps.isSensitive !== undefined || ps.allowRenoteToExternal !== undefined) {
					throw new ApiError(meta.errors.accessDenied);
				}
			} else if (!isChannelAdmin && !iAmModerator) {
				throw new ApiError(meta.errors.accessDenied);
			}

			// eslint:disable-next-line:no-unnecessary-initializer
			let banner = undefined;
			if (ps.bannerId != null) {
				banner = await this.driveFilesRepository.findOneBy({
					id: ps.bannerId,
					userId: me.id,
				});

				if (banner == null) {
					throw new ApiError(meta.errors.noSuchFile);
				}
			} else if (ps.bannerId === null) {
				banner = null;
			}

			// Channel admin cannot change name after creation; only server admin can
			if (ps.name !== undefined && ps.name !== channel.name && !iAmModerator) {
				throw new ApiError(meta.errors.cannotChangeChannelName);
			}

			// Duplicate name check (for server admin changing name)
			if (ps.name !== undefined && ps.name !== channel.name) {
				const existing = await this.channelsRepository.findOneBy({ name: ps.name });
				if (existing) {
					throw new ApiError(meta.errors.duplicateChannelName);
				}
			}

			await this.channelsRepository.update(channel.id, {
				...(ps.name !== undefined ? { name: ps.name } : {}),
				...(ps.description !== undefined ? { description: ps.description } : {}),
				...(ps.pinnedNoteIds !== undefined ? { pinnedNoteIds: ps.pinnedNoteIds } : {}),
				...(ps.color !== undefined ? { color: ps.color } : {}),
				...(banner ? { bannerId: banner.id } : {}),
				...(typeof ps.isSensitive === 'boolean' ? { isSensitive: ps.isSensitive } : {}),
				...(typeof ps.allowRenoteToExternal === 'boolean' ? { allowRenoteToExternal: ps.allowRenoteToExternal } : {}),
			});

			// Log to moderation log when server admin (not channel admin) updates channel settings
			if (iAmModerator && !isChannelAdmin) {
				const before: Record<string, any> = {};
				const after: Record<string, any> = {};
				if (ps.name !== undefined && ps.name !== channel.name) { before.name = channel.name; after.name = ps.name; }
				if (ps.description !== undefined && ps.description !== channel.description) { before.description = channel.description; after.description = ps.description; }
				if (ps.color !== undefined && ps.color !== channel.color) { before.color = channel.color; after.color = ps.color; }
				if (typeof ps.isSensitive === 'boolean' && ps.isSensitive !== channel.isSensitive) { before.isSensitive = channel.isSensitive; after.isSensitive = ps.isSensitive; }
				if (typeof ps.allowRenoteToExternal === 'boolean' && ps.allowRenoteToExternal !== channel.allowRenoteToExternal) { before.allowRenoteToExternal = channel.allowRenoteToExternal; after.allowRenoteToExternal = ps.allowRenoteToExternal; }
				if (ps.pinnedNoteIds !== undefined) { before.pinnedNoteIds = channel.pinnedNoteIds; after.pinnedNoteIds = ps.pinnedNoteIds; }
				if (banner !== undefined) { before.bannerId = channel.bannerId; after.bannerId = banner ? banner.id : null; }

				if (Object.keys(after).length > 0) {
					await this.moderationLogService.log(me, 'updateChannel', {
						channelId: channel.id,
						channelName: channel.name,
						before,
						after,
					});
				}
			}

			// Log pin/unpin changes
			if (ps.pinnedNoteIds !== undefined) {
				const oldPinned = new Set(channel.pinnedNoteIds ?? []);
				const newPinned = new Set(ps.pinnedNoteIds);
				for (const noteId of ps.pinnedNoteIds) {
					if (!oldPinned.has(noteId)) {
						await this.channelModerationService.logAction(channel.id, me.id, 'pinNote', { noteId });
					}
				}
				for (const noteId of (channel.pinnedNoteIds ?? [])) {
					if (!newPinned.has(noteId)) {
						await this.channelModerationService.logAction(channel.id, me.id, 'unpinNote', { noteId });
					}
				}
			}

			return await this.channelEntityService.pack(channel.id, me);
		});
	}
}
