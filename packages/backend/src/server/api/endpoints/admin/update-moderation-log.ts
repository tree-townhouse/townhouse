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
import { getOriginalModerationLogInfo, isCancelledModerationLog, SANCTION_HISTORY_KEY } from './moderation-log-utils.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:update-moderation-log',

	errors: {
		noSuchLog: {
			message: 'No such moderation log.',
			code: 'NO_SUCH_LOG',
			id: 'b7a8c1e0-1001-4f00-a001-000000000001',
		},
		unsupportedLogType: {
			message: 'This log type cannot be edited.',
			code: 'UNSUPPORTED_LOG_TYPE',
			id: 'b7a8c1e0-1001-4f00-a001-000000000002',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		logId: { type: 'string', format: 'misskey:id' },
		reason: { type: 'string', minLength: 1, maxLength: 512, nullable: true },
		expiresAt: { type: 'integer', nullable: true },
	},
	required: ['logId'],
} as const;

// Log types that can be edited and how they affect user state
const EDITABLE_LOG_TYPES = ['silence', 'restrict', 'suspend', 'warn'];

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
			if (log == null) {
				throw new ApiError(meta.errors.noSuchLog);
			}

			if (!EDITABLE_LOG_TYPES.includes(log.type)) {
				throw new ApiError(meta.errors.unsupportedLogType);
			}

			if (isCancelledModerationLog(log)) {
				throw new ApiError(meta.errors.noSuchLog);
			}

			const targetUserId = log.info.userId;
			if (!targetUserId) {
				throw new ApiError(meta.errors.unsupportedLogType);
			}

			const beforeInfo = { ...log.info };
			const newInfo = { ...log.info };

			// Update reason if provided
			if (ps.reason !== undefined && ps.reason !== null) {
				newInfo.reason = ps.reason;
			}

			// Handle type-specific updates
			if (log.type === 'silence' && ps.expiresAt !== undefined) {
				// Recalculate expiresAt based on original action time
				if (ps.expiresAt === null) {
					// Change to indefinite
					newInfo.expiresAt = null;
				} else {
					const newExpiresAtDate = new Date(ps.expiresAt);
					newInfo.expiresAt = newExpiresAtDate.toISOString();
				}
			}

			if (log.type === 'restrict' && ps.expiresAt !== undefined) {
				if (ps.expiresAt === null) {
					newInfo.expiresAt = null;
				} else {
					const newExpiresAtDate = new Date(ps.expiresAt);
					newInfo.expiresAt = newExpiresAtDate.toISOString();
				}
			}

			if (beforeInfo.reason === newInfo.reason && beforeInfo.expiresAt === newInfo.expiresAt) {
				return;
			}

			if (log.type === 'silence' && ps.expiresAt !== undefined) {
				await this.usersRepository.update(targetUserId, {
					silencedUntil: newInfo.expiresAt == null ? null : new Date(newInfo.expiresAt),
				});
			}

			if (log.type === 'restrict' && ps.expiresAt !== undefined) {
				await this.usersRepository.update(targetUserId, {
					restrictedUntil: newInfo.expiresAt == null ? null : new Date(newInfo.expiresAt),
				});
			}

			if (log.type === 'suspend' && ps.reason !== undefined && ps.reason !== null) {
				await this.usersRepository.update(targetUserId, {
					suspendReason: ps.reason,
				});
			}

			// Keep the first version so the sanctioned user can see what was changed.
			newInfo[SANCTION_HISTORY_KEY] = {
				status: 'edited',
				original: getOriginalModerationLogInfo(log.info),
				modifiedAt: new Date().toISOString(),
			};

			// Save updated info to the log
			await this.moderationLogService.updateInfo(ps.logId, newInfo);

			// Log this edit action
			await this.moderationLogService.log(me, 'editModerationLog', {
				logId: ps.logId,
				logType: log.type,
				before: beforeInfo,
				after: newInfo,
			});

			this.notificationService.createSystemNotification(targetUserId, {
				header: '제재 내역이 수정되었습니다',
				body: '회원님에게 적용된 제재의 내용이 수정되었습니다. 프로필의 제재 내역 탭에서 변경 내용을 확인해 주세요.',
			});
		});
	}
}
