/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ChannelModerationService } from '@/core/ChannelModerationService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['channels'],

	requireCredential: true,

	kind: 'write:channels',

	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'e0460b5e-1a02-4c29-a8b0-001001000001',
		},
		accessDenied: {
			message: 'You do not have permission.',
			code: 'ACCESS_DENIED',
			id: 'e0460b5e-1a02-4c29-a8b0-001001000002',
		},
		alreadyModerator: {
			message: 'The user is already a moderator.',
			code: 'ALREADY_MODERATOR',
			id: 'e0460b5e-1a02-4c29-a8b0-001001000003',
		},
		alreadyInvited: {
			message: 'The user has already been invited.',
			code: 'ALREADY_INVITED',
			id: 'e0460b5e-1a02-4c29-a8b0-001001000004',
		},
		cannotInviteSelf: {
			message: 'You cannot invite yourself.',
			code: 'CANNOT_INVITE_SELF',
			id: 'e0460b5e-1a02-4c29-a8b0-001001000005',
		},
		cannotInviteAdmin: {
			message: 'Cannot invite the channel admin as moderator.',
			code: 'CANNOT_INVITE_ADMIN',
			id: 'e0460b5e-1a02-4c29-a8b0-001001000006',
		},
		userBanned: {
			message: 'Cannot invite a banned user as moderator.',
			code: 'USER_BANNED',
			id: 'e0460b5e-1a02-4c29-a8b0-001001000007',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
		userId: { type: 'string', format: 'misskey:id' },
	},
	required: ['channelId', 'userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private channelModerationService: ChannelModerationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				await this.channelModerationService.inviteModerator(ps.channelId, me.id, ps.userId);
			} catch (e: any) {
				switch (e.message) {
					case 'ACCESS_DENIED': throw new ApiError(meta.errors.accessDenied);
					case 'CANNOT_INVITE_SELF': throw new ApiError(meta.errors.cannotInviteSelf);
					case 'CANNOT_INVITE_ADMIN': throw new ApiError(meta.errors.cannotInviteAdmin);
					case 'ALREADY_MODERATOR': throw new ApiError(meta.errors.alreadyModerator);
					case 'ALREADY_INVITED': throw new ApiError(meta.errors.alreadyInvited);
					case 'USER_BANNED': throw new ApiError(meta.errors.userBanned);
					default: throw new ApiError(meta.errors.noSuchChannel);
				}
			}
		});
	}
}
