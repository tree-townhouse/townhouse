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
import { DELETABLE_LOG_TYPES, isCancelledModerationLog, revertModerationAction } from './moderation-log-utils.js';

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

			// A cancelled sanction was already reverted when it was cancelled.
			if (!isCancelledModerationLog(log)) {
				await revertModerationAction(this.usersRepository, log);
			}

			await this.moderationLogService.log(me, 'deleteModerationLog', {
				logId: ps.logId,
				logType: log.type,
				logInfo: log.info,
			});

			await this.moderationLogService.deleteLog(ps.logId);
		});
	}
}
