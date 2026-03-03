/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ChannelModerationService } from '@/core/ChannelModerationService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['channels'],

	requireCredential: true,

	kind: 'read:channels',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
				},
				userId: {
					type: 'string',
					optional: false, nullable: false,
				},
				type: {
					type: 'string',
					optional: false, nullable: false,
				},
				info: {
					type: 'object',
					optional: false, nullable: false,
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
			id: 'e0460b5e-1a02-4c29-a8b0-005001000001',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		type: { type: 'string', nullable: true },
	},
	required: ['channelId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private channelModerationService: ChannelModerationService,
		private userEntityService: UserEntityService,
		private roleService: RoleService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Only channel admin/moderators or server admin can view logs
			const isServerAdmin = await this.roleService.isAdministrator({ id: me.id });
			if (!isServerAdmin && !await this.channelModerationService.hasChannelManagePermission(ps.channelId, me.id)) {
				throw new ApiError(meta.errors.accessDenied);
			}

			const logs = await this.channelModerationService.getLog(ps.channelId, ps.limit, ps.sinceId, ps.untilId, ps.type ?? undefined);

			return await Promise.all(logs.map(async (log: { id: string; userId: string; type: string; info: Record<string, any> }) => {
				const user = await this.userEntityService.pack(log.userId, me);
				const targetUser = log.info.targetUserId
					? await this.userEntityService.pack(log.info.targetUserId, me).catch(() => null)
					: null;
				const createdAt = this.idService.parse(log.id).date.toISOString();
				return {
					...log,
					createdAt,
					user,
					targetUser,
				};
			}));
		});
	}
}
