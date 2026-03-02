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

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:delete-moderation-log',

	errors: {
		noSuchLog: {
			message: 'No such moderation log.',
			code: 'NO_SUCH_LOG',
			id: 'b7a8c1e0-2001-4f00-a001-000000000001',
		},
		unsupportedLogType: {
			message: 'This log type cannot be deleted.',
			code: 'UNSUPPORTED_LOG_TYPE',
			id: 'b7a8c1e0-2001-4f00-a001-000000000002',
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

// Log types that can be deleted and their revert behavior
const DELETABLE_LOG_TYPES = ['silence', 'restrict', 'suspend', 'warn', 'unsilence', 'unrestrict', 'unsuspend', 'resetWarning'];

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const log = await this.moderationLogService.findById(ps.logId);
			if (log == null) {
				throw new ApiError(meta.errors.noSuchLog);
			}

			if (!DELETABLE_LOG_TYPES.includes(log.type)) {
				throw new ApiError(meta.errors.unsupportedLogType);
			}

			const targetUserId = log.info.userId;

			// Auto-detect: if the action is currently active, revert it
			if (targetUserId) {
				const user = await this.usersRepository.findOneBy({ id: targetUserId });
				if (user) {
					switch (log.type) {
						case 'silence':
							// Only revert if user is currently silenced
							if (user.isSilenced) {
								await this.usersRepository.update(targetUserId, {
									isSilenced: false,
									silencedUntil: null,
								});
							}
							break;
							case 'restrict':
								// Only revert if user is currently restricted
								if (user.isRestricted) {
									await this.usersRepository.update(targetUserId, {
										isRestricted: false,
										restrictedUntil: null,
									});
								}
								break;
						case 'suspend':
							// Only revert if user is currently suspended
							if (user.isSuspended) {
								await this.usersRepository.update(targetUserId, {
									isSuspended: false,
									suspendReason: null,
								});
							}
							break;

						case 'warn':
							// Decrement warning count if > 0
							if (user.warningCount > 0) {
								await this.usersRepository.decrement({ id: targetUserId }, 'warningCount', 1);
							}
							break;

						// For unsilence/unsuspend/resetWarning: just delete the log,
						// don't re-apply the original action
						case 'unsilence':
						case 'unrestrict':
						case 'unsuspend':
						case 'resetWarning':
							break;
					}
				}
			}

			// Log this deletion before actually deleting
			await this.moderationLogService.log(me, 'deleteModerationLog', {
				logId: ps.logId,
				logType: log.type,
				logInfo: log.info,
			});

			// Delete the log entry
			await this.moderationLogService.deleteLog(ps.logId);
		});
	}
}
