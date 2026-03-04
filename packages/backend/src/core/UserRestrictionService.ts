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
export class UserRestrictionService {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private moderationLogService: ModerationLogService,
		private announcementService: AnnouncementService,
		private metaService: MetaService,
	) {
	}

	@bindThis
	public async restrict(user: MiUser, moderator: MiUser, reason: string, expiresAt: Date | null): Promise<void> {
		await this.usersRepository.update(user.id, {
			isRestricted: true,
			restrictedUntil: expiresAt,
		});

		this.moderationLogService.log(moderator, 'restrict', {
			userId: user.id,
			userUsername: user.username,
			userHost: user.host,
			reason: reason,
			expiresAt: expiresAt ? expiresAt.toISOString() : null,
		});

		// Send announcement to the restricted user
		const meta = await this.metaService.fetch();
		const periodText = this.formatPeriod(expiresAt);
		const dateText = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
		const endDateText = expiresAt ? expiresAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '무기한';
		const title = (meta.restrictAnnouncementTitle ?? '{reason}')
			.replace('{reason}', reason)
			.replace('{period}', periodText)
			.replace('{date}', dateText)
			.replace('{enddate}', endDateText);
		const text = (meta.restrictAnnouncementText ?? '{reason}\n\n{period}')
			.replace('{reason}', reason)
			.replace('{period}', periodText)
			.replace('{date}', dateText)
			.replace('{enddate}', endDateText);

		await this.announcementService.create({
			title: title,
			text: text,
			icon: 'warning',
			display: 'dialog',
			userId: user.id,
			needConfirmationToRead: true,
			forExistingUsers: false,
			silence: false,
		}, moderator);
	}

	@bindThis
	public async unrestrict(user: MiUser, moderator: MiUser): Promise<void> {
		await this.usersRepository.update(user.id, {
			isRestricted: false,
			restrictedUntil: null,
		});

		this.moderationLogService.log(moderator, 'unrestrict', {
			userId: user.id,
			userUsername: user.username,
			userHost: user.host,
		});
	}

	@bindThis
	public isEffectivelyRestricted(user: Pick<MiUser, 'isRestricted' | 'restrictedUntil'>): boolean {
		if (!user.isRestricted) return false;
		if (user.restrictedUntil == null) return true; // indefinite
		return new Date() < user.restrictedUntil;
	}

	private formatPeriod(expiresAt: Date | null): string {
		if (expiresAt == null) return '무기한';
		const now = Date.now();
		const diff = expiresAt.getTime() - now;
		const hours = Math.round(diff / (1000 * 60 * 60));
		if (hours < 24) return `${hours}시간`;
		const days = Math.round(diff / (1000 * 60 * 60 * 24));
		if (days < 7) return `${days}일`;
		if (days < 30) return `${Math.round(days / 7)}주`;
		if (days < 365) return `${Math.round(days / 30)}개월`;
		return `${Math.round(days / 365)}년`;
	}
}
