/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ChannelModerationService } from '@/core/ChannelModerationService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['channels'],

	requireCredential: true,

	kind: 'write:channels',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				userId: {
					type: 'string',
					optional: false, nullable: false,
				},
				bannedById: {
					type: 'string',
					optional: false, nullable: false,
				},
				expiresAt: {
					type: 'string',
					optional: false, nullable: true,
					format: 'date-time',
				},
				user: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'UserLite',
				},
			},
		},
	},

	errors: {
		accessDenied: {
			message: 'You do not have permission.',
			code: 'ACCESS_DENIED',
			id: 'e0460b5e-1a02-4c29-a8b0-002003000001',
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
		private userEntityService: UserEntityService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Channel admin/moderators or server admin can view banned users
			const isServerAdmin = await this.roleService.isAdministrator({ id: me.id });
			if (!isServerAdmin && !await this.channelModerationService.hasChannelManagePermission(ps.channelId, me.id)) {
				throw new ApiError(meta.errors.accessDenied);
			}

			const bans = await this.channelModerationService.getBannedUsers(ps.channelId);
			return await Promise.all(bans.map(async (ban: { userId: string; bannedById: string; expiresAt: Date | null }) => {
				const user = await this.userEntityService.pack(ban.userId, me);
				return {
					...ban,
					user,
				};
			}));
		});
	}
}
