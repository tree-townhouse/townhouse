/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import type { ModerationLogsRepository } from '@/models/_.js';
import type { MiModerationLog } from '@/models/ModerationLog.js';
import { IdService } from '@/core/IdService.js';

const SANCTION_TYPES = ['warn', 'silence', 'restrict', 'suspend'] as const;

export const meta = {
	tags: ['account'],

	requireCredential: true,
	kind: 'read:account',

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
					format: 'id',
				},
				createdAt: {
					type: 'string',
					optional: false, nullable: false,
					format: 'date-time',
				},
				type: {
					type: 'string',
					optional: false, nullable: false,
				},
				reason: {
					type: 'string',
					optional: false, nullable: true,
				},
				status: {
					type: 'string',
					optional: false, nullable: false,
					enum: ['active', 'edited', 'cancelled'],
				},
				modifiedAt: {
					type: 'string',
					optional: false, nullable: true,
					format: 'date-time',
				},
				cancelledAt: {
					type: 'string',
					optional: false, nullable: true,
					format: 'date-time',
				},
				originalReason: {
					type: 'string',
					optional: false, nullable: true,
				},
				expiresAt: {
					type: 'string',
					optional: true, nullable: true,
					format: 'date-time',
				},
				originalExpiresAt: {
					type: 'string',
					optional: false, nullable: true,
					format: 'date-time',
				},
				warningCount: {
					type: 'integer',
					optional: false, nullable: true,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.moderationLogsRepository)
		private moderationLogsRepository: ModerationLogsRepository,

		private queryService: QueryService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(
				this.moderationLogsRepository.createQueryBuilder('log'),
				ps.sinceId,
				ps.untilId,
			)
				.andWhere('log.targetUserId = :userId', { userId: me.id })
				.andWhere('log.type IN (:...types)', { types: SANCTION_TYPES });

			const logs = await query.limit(ps.limit).getMany();

			return logs.map((log: MiModerationLog) => {
				const history = log.info?._sanctionHistory;
				const status = history?.status === 'edited' || history?.status === 'cancelled'
					? history.status
					: 'active';
				const original = status === 'edited' && history?.original != null
					? history.original
					: null;

				return {
					id: log.id,
					createdAt: this.idService.parse(log.id).date.toISOString(),
					type: log.type,
					reason: log.info?.reason ?? null,
					status,
					modifiedAt: history?.modifiedAt ?? null,
					cancelledAt: history?.cancelledAt ?? null,
					originalReason: original?.reason ?? null,
					expiresAt: log.info?.expiresAt ?? null,
					originalExpiresAt: original?.expiresAt ?? null,
					warningCount: log.info?.warningCount ?? null,
				};
			});
		});
	}
}
