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
		noInvitation: {
			message: 'No pending invitation found.',
			code: 'NO_INVITATION',
			id: 'e0460b5e-1a02-4c29-a8b0-001003000001',
		},
		userBanned: {
			message: 'Cannot accept invitation while banned from the channel.',
			code: 'USER_BANNED',
			id: 'e0460b5e-1a02-4c29-a8b0-001003000002',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
	},
	required: ['channelId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private channelModerationService: ChannelModerationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				await this.channelModerationService.acceptModeratorInvitation(ps.channelId, me.id);
			} catch (e: any) {
				if (e.message === 'NO_INVITATION') throw new ApiError(meta.errors.noInvitation);
				if (e.message === 'USER_BANNED') throw new ApiError(meta.errors.userBanned);
				throw e;
			}
		});
	}
}
