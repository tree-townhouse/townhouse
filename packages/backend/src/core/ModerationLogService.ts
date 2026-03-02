/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { ModerationLogsRepository } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import type { MiModerationLog } from '@/models/ModerationLog.js';
import { IdService } from '@/core/IdService.js';
import { bindThis } from '@/decorators.js';
import type { ModerationLogPayloads } from '@/types.js';
import { moderationLogTypes } from '@/types.js';

// Moderation log types that target a specific user (userId in info payload)
const USER_TARGET_LOG_TYPES = [
	'suspend', 'unsuspend', 'silence', 'unsilence', 'warn', 'resetWarning',
	'approve', 'decline', 'updateUserNote', 'resetPassword',
	'unsetUserAvatar', 'unsetUserBanner', 'deleteAccount',
	'assignRole', 'unassignRole',
	'createUserAnnouncement', 'updateUserAnnouncement', 'deleteUserAnnouncement',
];

@Injectable()
export class ModerationLogService {
	constructor(
		@Inject(DI.moderationLogsRepository)
		private moderationLogsRepository: ModerationLogsRepository,

		private idService: IdService,
	) {
	}

	@bindThis
	public async log<T extends typeof moderationLogTypes[number]>(moderator: { id: MiUser['id'] }, type: T, info?: ModerationLogPayloads[T]) {
		const infoObj = (info as any) ?? {};
		const targetUserId = USER_TARGET_LOG_TYPES.includes(type) && infoObj.userId ? infoObj.userId : null;

		await this.moderationLogsRepository.insert({
			id: this.idService.gen(),
			userId: moderator.id,
			targetUserId: targetUserId,
			type: type,
			info: infoObj,
		});
	}

	@bindThis
	public async findById(logId: string): Promise<MiModerationLog | null> {
		return await this.moderationLogsRepository.findOneBy({ id: logId });
	}

	@bindThis
	public async updateInfo(logId: string, info: Record<string, any>): Promise<void> {
		await this.moderationLogsRepository.update(logId, { info });
	}

	@bindThis
	public async deleteLog(logId: string): Promise<void> {
		await this.moderationLogsRepository.delete(logId);
	}
}
