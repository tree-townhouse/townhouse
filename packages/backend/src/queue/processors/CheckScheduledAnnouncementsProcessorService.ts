/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { AnnouncementsRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { AnnouncementEntityService } from '@/core/entities/AnnouncementEntityService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

@Injectable()
export class CheckScheduledAnnouncementsProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.announcementsRepository)
		private announcementsRepository: AnnouncementsRepository,

		private globalEventService: GlobalEventService,
		private announcementEntityService: AnnouncementEntityService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('check-scheduled-announcements');
	}

	@bindThis
	public async process(): Promise<void> {
		const now = new Date();

		// Publish scheduled announcements
		const toPublish = await this.announcementsRepository.createQueryBuilder('announcement')
			.where('announcement."publishAt" IS NOT NULL')
			.andWhere('announcement."publishAt" <= :now', { now })
			.andWhere('announcement."isActive" = false')
			.getMany();

		for (const announcement of toPublish) {
			this.logger.info(`Publishing scheduled announcement: ${announcement.id}`);
			await this.announcementsRepository.update(announcement.id, {
				isActive: true,
				publishAt: null,
			});

			const packed = await this.announcementEntityService.pack({
				...announcement,
				isActive: true,
				publishAt: null,
				isRead: false,
			});

			if (announcement.userId) {
				this.globalEventService.publishMainStream(announcement.userId, 'announcementCreated', {
					announcement: packed,
				});
			} else {
				this.globalEventService.publishBroadcastStream('announcementCreated', {
					announcement: packed,
				});
			}
		}

		// Archive announcements with expired closesAt
		const toArchive = await this.announcementsRepository.createQueryBuilder('announcement')
			.where('announcement."closesAt" IS NOT NULL')
			.andWhere('announcement."closesAt" <= :now', { now })
			.andWhere('announcement."isActive" = true')
			.getMany();

		for (const announcement of toArchive) {
			this.logger.info(`Archiving scheduled announcement: ${announcement.id}`);
			await this.announcementsRepository.update(announcement.id, {
				isActive: false,
				closesAt: null,
			});
		}

		if (toPublish.length > 0 || toArchive.length > 0) {
			this.logger.succ(`Published ${toPublish.length}, archived ${toArchive.length} announcements.`);
		}
	}
}
