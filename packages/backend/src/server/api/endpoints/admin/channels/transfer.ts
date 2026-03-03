/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ChannelModerationService } from '@/core/ChannelModerationService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin', 'channels'],

	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:channels',

	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'e0460b5e-1a02-4c29-a8b0-004004000001',
		},
		accessDenied: {
			message: 'You do not have permission.',
			code: 'ACCESS_DENIED',
			id: 'e0460b5e-1a02-4c29-a8b0-004004000002',
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
		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				await this.channelModerationService.transferOwnership(ps.channelId, me.id, ps.userId);
			} catch (e: any) {
				if (e.message === 'NO_SUCH_CHANNEL') throw new ApiError(meta.errors.noSuchChannel);
				if (e.message === 'ACCESS_DENIED') throw new ApiError(meta.errors.accessDenied);
				throw e;
			}

			await this.moderationLogService.log(me, 'transferChannelOwnership', {
				channelId: ps.channelId,
				newOwnerId: ps.userId,
			});
		});
	}
}
