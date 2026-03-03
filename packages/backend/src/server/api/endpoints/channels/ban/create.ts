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
		accessDenied: {
			message: 'You do not have permission.',
			code: 'ACCESS_DENIED',
			id: 'e0460b5e-1a02-4c29-a8b0-002001000001',
		},
		cannotBanAdmin: {
			message: 'You cannot ban the channel admin.',
			code: 'CANNOT_BAN_ADMIN',
			id: 'e0460b5e-1a02-4c29-a8b0-002001000002',
		},
		alreadyBanned: {
			message: 'The user is already banned from this channel.',
			code: 'ALREADY_BANNED',
			id: 'e0460b5e-1a02-4c29-a8b0-002001000003',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
		userId: { type: 'string', format: 'misskey:id' },
		expiresAt: { type: 'integer', nullable: true, description: 'Expiration timestamp in milliseconds. Null or omitted for permanent ban.' },
		reason: { type: 'string', maxLength: 512, default: '' },
	},
	required: ['channelId', 'userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private channelModerationService: ChannelModerationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const expiresAt = ps.expiresAt ? new Date(ps.expiresAt) : null;
			try {
				await this.channelModerationService.banUser(ps.channelId, me.id, ps.userId, expiresAt, ps.reason ?? '');
			} catch (e: any) {
				switch (e.message) {
					case 'ACCESS_DENIED': throw new ApiError(meta.errors.accessDenied);
					case 'CANNOT_BAN_ADMIN': throw new ApiError(meta.errors.cannotBanAdmin);
					default: throw e;
				}
			}
		});
	}
}
