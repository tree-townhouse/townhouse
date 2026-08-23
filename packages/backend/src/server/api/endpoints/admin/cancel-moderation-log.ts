/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { UsersRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { ApiError } from '../../error.js';
import { CANCELLABLE_LOG_TYPES, getOriginalModerationLogInfo, isCancelledModerationLog, revertModerationAction, SANCTION_HISTORY_KEY } from './moderation-log-utils.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	kind: 'write:admin:cancel-moderation-log',

	errors: {
		noSuchLog: {
			message: 'No such moderation log.',
			code: 'NO_SUCH_LOG',
			id: 'b7a8c1e0-3001-4f00-a001-000000000001',
		},
		unsupportedLogType: {
			message: 'This log type cannot be cancelled.',
			code: 'UNSUPPORTED_LOG_TYPE',
			id: 'b7a8c1e0-3001-4f00-a001-000000000002',
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
		private notificationService: NotificationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const log = await this.moderationLogService.findById(ps.logId);
			if (log == null || isCancelledModerationLog(log)) {
				throw new ApiError(meta.errors.noSuchLog);
			}

			if (!CANCELLABLE_LOG_TYPES.includes(log.type)) {
				throw new ApiError(meta.errors.unsupportedLogType);
			}

			const targetUserId = log.info.userId;
			if (!targetUserId) {
				throw new ApiError(meta.errors.unsupportedLogType);
			}

			await revertModerationAction(this.usersRepository, log);

			const cancelledInfo = {
				...log.info,
				[SANCTION_HISTORY_KEY]: {
					status: 'cancelled',
					original: getOriginalModerationLogInfo(log.info),
				},
			};

			await this.moderationLogService.log(me, 'cancelModerationLog', {
				userId: targetUserId,
				logId: ps.logId,
				logType: log.type,
				logInfo: cancelledInfo,
			});

			await this.moderationLogService.updateInfo(ps.logId, cancelledInfo);

			this.notificationService.createSystemNotification(targetUserId, {
				header: '제재가 취소되었습니다',
				body: '회원님에게 적용된 제재가 취소되었습니다. 프로필의 제재 내역 탭에서 확인할 수 있습니다.',
			});
		});
	}
}
