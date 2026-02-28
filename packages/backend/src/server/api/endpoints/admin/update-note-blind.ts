/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository, UsersRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { SearchService } from '@/core/SearchService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	kind: 'write:admin:update-note-blind',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
		isBlinded: { type: 'boolean' },
	},
	required: ['noteId', 'isBlinded'],
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

			const beforeBlinded = note.isBlinded;
			const afterBlinded = ps.isBlinded;

			if (beforeBlinded === afterBlinded) {
				return;
			}

			await this.notesRepository.update({ id: note.id }, {
				isBlinded: afterBlinded,
			});

			this.moderationLogService.log(me, 'updateNoteVisibility', {
				noteId: note.id,
				noteUserId: user.id,
				noteUserUsername: user.username,
				noteUserHost: user.host,
				beforeBlinded,
				afterBlinded,
			});

			note.isBlinded = afterBlinded;
			this.searchService.unindexNote(note);
			this.searchService.indexNote(note);

			this.globalEventService.publishNoteStream(note.id, 'updated', {
				cw: note.cw,
				text: note.text,
				disableRightClick: note.disableRightClick,
				deleteAt: note.deleteAt ?? null,
				isBlinded: note.isBlinded,
			});
		});
	}
}
