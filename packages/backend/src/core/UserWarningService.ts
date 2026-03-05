/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UsersRepository } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { AnnouncementService } from '@/core/AnnouncementService.js';
import { MetaService } from '@/core/MetaService.js';

@Injectable()
export class UserWarningService {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private moderationLogService: ModerationLogService,
		private announcementService: AnnouncementService,
		private metaService: MetaService,
	) {
	}

	@bindThis
	public async warn(user: MiUser, moderator: MiUser, reason: string): Promise<void> {
		await this.usersRepository.increment({ id: user.id }, 'warningCount', 1);

		const newWarningCount = (user.warningCount ?? 0) + 1;

		this.moderationLogService.log(moderator, 'warn', {
			userId: user.id,
			userUsername: user.username,
			userHost: user.host,
			reason: reason,
		});

		// Send announcement to the warned user
		const meta = await this.metaService.fetch();
		const dateText = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
		const title = (meta.warningAnnouncementTitle ?? '{reason}')
			.replace('{reason}', reason)
			.replace('{date}', dateText)
			.replace('{count}', String(newWarningCount));
		const text = (meta.warningAnnouncementText ?? '{reason}')
			.replace('{reason}', reason)
			.replace('{date}', dateText)
			.replace('{count}', String(newWarningCount));

		await this.announcementService.create({
			title: title,
			text: text,
			icon: 'warning',
			display: 'dialog',
			userId: user.id,
			needConfirmationToRead: false,
			forExistingUsers: false,
			silence: false,
			closedOnly: true,
		}, moderator);
	}
}
