/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository, UsersRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { noteVisibilities } from '@/types.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { SearchService } from '@/core/SearchService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	kind: 'write:admin:update-note-visibility',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
		visibility: { type: 'string', enum: noteVisibilities },
		localOnly: { type: 'boolean' },
	},
	required: ['noteId', 'visibility', 'localOnly'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private moderationLogService: ModerationLogService,
		private globalEventService: GlobalEventService,
		private searchService: SearchService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.notesRepository.findOneBy({ id: ps.noteId });

			if (note == null) {
				throw new Error('note not found');
			}

			const user = await this.usersRepository.findOneBy({ id: note.userId });

			if (user == null) {
				throw new Error('user not found');
			}

			const beforeVisibility = note.visibility;
			const afterVisibility = ps.visibility as typeof noteVisibilities[number];

			const beforeLocalOnly = note.localOnly;
			const afterLocalOnly = ps.localOnly;

			if (beforeVisibility === afterVisibility && beforeLocalOnly === afterLocalOnly) {
				return;
			}

			// 구 가시성 상태에서 먼저 기존 검색 인덱스 제거
			await this.searchService.unindexNote(note);

			await this.notesRepository.update({ id: note.id }, {
				visibility: afterVisibility,
				localOnly: afterLocalOnly,
			});

			if (beforeVisibility !== afterVisibility) {
				this.moderationLogService.log(me, 'updateNoteVisibility', {
					noteId: note.id,
					noteUserId: user.id,
					noteUserUsername: user.username,
					noteUserHost: user.host,
					before: beforeVisibility,
					after: afterVisibility,
				});
			}

			note.visibility = afterVisibility;
			note.localOnly = afterLocalOnly;
			this.globalEventService.publishNoteStream(note.id, 'updated', {
				visibility: afterVisibility,
				localOnly: afterLocalOnly,
			});

			this.globalEventService.publishBroadcastStream('noteUpdated', {
				id: note.id,
				type: 'updated',
				body: {
					visibility: afterVisibility,
					localOnly: afterLocalOnly,
				},
			});

			// 새 가시성 상태로 검색 인덱스 재구성
			await this.searchService.indexNote(note);
		});
	}
}
