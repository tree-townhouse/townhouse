/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { UsersRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { ApiError } from '../../error.js';
import { applyModerationAction, CANCELLABLE_LOG_TYPES, getOriginalModerationLogInfo, isCancelledModerationLog, SANCTION_HISTORY_KEY } from './moderation-log-utils.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:restore-moderation-log',

	errors: {
		noSuchLog: {
			message: 'No such cancelled moderation log.',
			code: 'NO_SUCH_LOG',
			id: 'b7a8c1e0-4001-4f00-a001-000000000001',
		},
		unsupportedLogType: {
			message: 'This log type cannot be restored.',
			code: 'UNSUPPORTED_LOG_TYPE',
			id: 'b7a8c1e0-4001-4f00-a001-000000000002',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		logId: { type: 'string', format: 'misskey:id' },
	},
	required: ['logId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const log = await this.moderationLogService.findById(ps.logId);
			if (log == null || !isCancelledModerationLog(log)) {
				throw new ApiError(meta.errors.noSuchLog);
			}

			if (!CANCELLABLE_LOG_TYPES.includes(log.type)) {
				throw new ApiError(meta.errors.unsupportedLogType);
			}

			const targetUserId = log.info.userId;
			if (!targetUserId) {
				throw new ApiError(meta.errors.unsupportedLogType);
			}

			await applyModerationAction(this.usersRepository, log);

			const history = log.info[SANCTION_HISTORY_KEY];
			const { [SANCTION_HISTORY_KEY]: _, ...baseInfo } = log.info;
			const restoredInfo = history?.previousStatus === 'edited'
				? {
					...baseInfo,
					[SANCTION_HISTORY_KEY]: {
						status: 'edited',
						original: history.original ?? getOriginalModerationLogInfo(log.info),
						...(history.modifiedAt != null ? { modifiedAt: history.modifiedAt } : {}),
					},
				}
				: baseInfo;

			await this.moderationLogService.log(me, 'restoreModerationLog', {
				userId: targetUserId,
				logId: ps.logId,
				logType: log.type,
				logInfo: restoredInfo,
			});

			await this.moderationLogService.updateInfo(ps.logId, restoredInfo);
		});
	}
}
