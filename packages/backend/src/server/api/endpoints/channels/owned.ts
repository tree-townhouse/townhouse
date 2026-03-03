/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelsRepository, ChannelModeratorsRepository } from '@/models/_.js';
import { QueryService } from '@/core/QueryService.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['channels', 'account'],

	requireCredential: true,

	kind: 'read:channels',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Channel',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 5 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.channelModeratorsRepository)
		private channelModeratorsRepository: ChannelModeratorsRepository,

		private channelEntityService: ChannelEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Get channel IDs where user is a moderator (accepted)
			const moderatedChannelIds = await this.channelModeratorsRepository
				.find({ where: { userId: me.id, status: 'accepted' }, select: ['channelId'] })
				.then(rows => rows.map(r => r.channelId));

			const query = this.queryService.makePaginationQuery(this.channelsRepository.createQueryBuilder('channel'), ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate);

			if (moderatedChannelIds.length > 0) {
				query.andWhere('(channel.userId = :userId OR (channel.id IN (:...moderatedChannelIds) AND channel.isApproved = TRUE))', {
					userId: me.id,
					moderatedChannelIds,
				});
			} else {
				query.andWhere('channel.userId = :userId', { userId: me.id });
			}

			const channels = await query
				.limit(ps.limit)
				.getMany();

			return await Promise.all(channels.map(x => this.channelEntityService.pack(x, me)));
		});
	}
}
