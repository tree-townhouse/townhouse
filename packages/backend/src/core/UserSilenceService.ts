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
export class UserSilenceService {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private moderationLogService: ModerationLogService,
		private announcementService: AnnouncementService,
		private metaService: MetaService,
	) {
	}

	@bindThis
	public async silence(user: MiUser, moderator: MiUser, reason: string, expiresAt: Date | null): Promise<void> {
		await this.usersRepository.update(user.id, {
			isSilenced: true,
			silencedUntil: expiresAt,
		});

		this.moderationLogService.log(moderator, 'silence', {
			userId: user.id,
			userUsername: user.username,
			userHost: user.host,
			reason: reason,
			expiresAt: expiresAt ? expiresAt.toISOString() : null,
		});

		// Send announcement to the silenced user
		const meta = await this.metaService.fetch();
		const periodText = this.formatPeriod(expiresAt);
		const title = (meta.silenceAnnouncementTitle ?? '{reason}')
			.replace('{reason}', reason)
			.replace('{period}', periodText);
		const text = (meta.silenceAnnouncementText ?? '{reason}\n\n{period}')
			.replace('{reason}', reason)
			.replace('{period}', periodText);

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
	public async unsilence(user: MiUser, moderator: MiUser): Promise<void> {
		await this.usersRepository.update(user.id, {
			isSilenced: false,
			silencedUntil: null,
		});

		this.moderationLogService.log(moderator, 'unsilence', {
			userId: user.id,
			userUsername: user.username,
			userHost: user.host,
		});
	}

	@bindThis
	public isEffectivelySilenced(user: Pick<MiUser, 'isSilenced' | 'silencedUntil'>): boolean {
		if (!user.isSilenced) return false;
		if (user.silencedUntil == null) return true; // indefinite
		return new Date() < user.silencedUntil;
	}

	private formatPeriod(expiresAt: Date | null): string {
		if (expiresAt == null) return '무기한';
		const now = Date.now();
		const diff = expiresAt.getTime() - now;
		const hours = Math.round(diff / (1000 * 60 * 60));
		if (hours < 24) return `${hours}시간`;
		const days = Math.round(diff / (1000 * 60 * 60 * 24));
		if (days < 7) return `${days}일`;
		const weeks = Math.round(days / 7);
		if (weeks < 5) return `${weeks}주`;
		const months = Math.round(days / 30);
		return `${months}개월`;
	}
}
