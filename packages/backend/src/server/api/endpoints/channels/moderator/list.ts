/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelModeratorsRepository, UsersRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';

export const meta = {
	tags: ['channels'],

	requireCredential: false,

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
				status: {
					type: 'string',
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
		@Inject(DI.channelModeratorsRepository)
		private channelModeratorsRepository: ChannelModeratorsRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const moderators = await this.channelModeratorsRepository.findBy({
				channelId: ps.channelId,
				status: 'accepted',
			});

			const result = await Promise.all(moderators.map(async (m: { userId: string; status: string }) => {
				const user = await this.userEntityService.pack(m.userId, me);
				return {
					userId: m.userId,
					status: m.status,
					user,
				};
			}));

			return result;
		});
	}
}
