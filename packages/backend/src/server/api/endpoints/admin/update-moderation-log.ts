/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { UsersRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '../../error.js';

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
const EDITABLE_LOG_TYPES = ['silence', 'suspend', 'warn'];

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		private moderationLogService: ModerationLogService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const log = await this.moderationLogService.findById(ps.logId);
			if (log == null) {
				throw new ApiError(meta.errors.noSuchLog);
			}

			if (!EDITABLE_LOG_TYPES.includes(log.type)) {
				throw new ApiError(meta.errors.unsupportedLogType);
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
					await this.usersRepository.update(targetUserId, {
						silencedUntil: null,
					});
				} else {
					const newExpiresAtDate = new Date(ps.expiresAt);
					newInfo.expiresAt = newExpiresAtDate.toISOString();
					await this.usersRepository.update(targetUserId, {
						silencedUntil: newExpiresAtDate,
					});
				}
			}

			if (log.type === 'suspend' && ps.reason !== undefined && ps.reason !== null) {
				// Update the suspend reason on the user
				await this.usersRepository.update(targetUserId, {
					suspendReason: ps.reason,
				});
			}

			// Save updated info to the log
			await this.moderationLogService.updateInfo(ps.logId, newInfo);

			// Log this edit action
			await this.moderationLogService.log(me, 'editModerationLog', {
				logId: ps.logId,
				logType: log.type,
				before: beforeInfo,
				after: newInfo,
			});
		});
	}
}
