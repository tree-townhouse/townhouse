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
import type { DriveFilesRepository } from '@/models/_.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';

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

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private moderationLogService: ModerationLogService,
		private globalEventService: GlobalEventService,
		private searchService: SearchService,
		private noteEntityService: NoteEntityService,
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

			this.moderationLogService.log(me, 'updateNoteBlind', {
				noteId: note.id,
				noteUserId: user.id,
				noteUserUsername: user.username,
				noteUserHost: user.host,
				before: beforeBlinded,
				after: afterBlinded,
			});

			note.isBlinded = afterBlinded;
			this.searchService.unindexNote(note);
			this.searchService.indexNote(note);

			// If unblinding, we should supply the original content so the client can restore it without a reload.
			let contentPayload = {};
			if (!afterBlinded) {
				const packed = await this.noteEntityService.pack(note, null, { skipHide: true });
				contentPayload = {
					cw: packed.cw,
					text: packed.text,
					fileIds: packed.fileIds,
					files: packed.files,
					poll: packed.poll,
					event: packed.event,
				};
			}

			this.globalEventService.publishNoteStream(note.id, 'updated', {
				deleteAt: note.deleteAt ?? null,
				isBlinded: note.isBlinded,
				...contentPayload,
			});

			this.globalEventService.publishBroadcastStream('noteUpdated', {
				id: note.id,
				type: 'updated',
				body: {
					deleteAt: note.deleteAt ?? null,
					isBlinded: note.isBlinded,
					...contentPayload,
				},
			});
		});
	}
}
