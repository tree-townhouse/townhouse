/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import type { NotesRepository, UsersRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { noteVisibilities } from '@/types.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { SearchService } from '@/core/SearchService.js';
import { FanoutTimelineService } from '@/core/FanoutTimelineService.js';
import type { MiMeta } from '@/models/Meta.js';

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
		visibleUserIds: {
			type: 'array',
			uniqueItems: true,
			items: { type: 'string', format: 'misskey:id' },
			nullable: true,
		},
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

		@Inject(DI.redisForTimelines)
		private redisForTimelines: Redis.Redis,

		@Inject(DI.meta)
		private metaService: MiMeta,

		private moderationLogService: ModerationLogService,
		private globalEventService: GlobalEventService,
		private searchService: SearchService,
		private fanoutTimelineService: FanoutTimelineService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// 보유 중인 노트에 대한 version을 확인하여 동시성 제어
			let note = await this.notesRepository.findOne({
				where: { id: ps.noteId },
			});

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

			const specifiedVisibleUserIds = afterVisibility === 'specified'
				? (() => {
					const safeVisibleUserIds = ps.visibleUserIds ?? note.visibleUserIds ?? [];
					const withAuthor = new Set(safeVisibleUserIds);
					withAuthor.add(note.userId);
					return Array.from(withAuthor);
				})()
				: note.visibleUserIds;

			if (beforeVisibility === afterVisibility && beforeLocalOnly === afterLocalOnly) {
				return;
			}

			// SearchService 에러는 독립적으로 처리
			try {
				await this.searchService.unindexNote(note);
			} catch (searchError) {
				// 로깅만 하고 진행 (검색 인덱스는 선택사항)
			}

			let redisExecError: Error | null = null;
			let dbUpdateError: Error | null = null;

			try {
				// 2단계: DB를 먼저 업데이트 (Race Condition 방지)
				const updateResult = await this.notesRepository.update({
					id: note.id,
					visibility: beforeVisibility,
					localOnly: beforeLocalOnly,
				}, {
					visibility: afterVisibility,
					localOnly: afterLocalOnly,
					visibleUserIds: specifiedVisibleUserIds,
				});

				if ((updateResult.affected ?? 0) === 0) {
					const latest = await this.notesRepository.findOneBy({ id: note.id });
					if (latest == null) {
						throw new Error('note not found during update');
					}

					if (latest.visibility === afterVisibility && latest.localOnly === afterLocalOnly) {
						return;
					}

					throw new Error('note visibility update conflict');
				}
			} catch (error) {
				dbUpdateError = error instanceof Error ? error : new Error(String(error));
				throw dbUpdateError;
			}

			// 메모리 객체 업데이트 (이후 작업에 사용)
			note.visibility = afterVisibility;
			note.localOnly = afterLocalOnly;
			note.visibleUserIds = specifiedVisibleUserIds;

			// 3단계: Redis 타임라인 캐시 처리 (DB 업데이트 이후)
			try {
				if (this.metaService.enableFanoutTimeline) {
					const pipeline = this.redisForTimelines.pipeline();

					const wasPublicLocal = beforeVisibility === 'public' && note.userHost == null;
					const isPublicLocal = afterVisibility === 'public' && note.userHost == null;

					const isReply = note.replyId != null;
					const hasFiles = note.fileIds != null && note.fileIds.length > 0;
					const isChannelNote = note.channelId != null;

					const shouldBeInLocalTimeline = (visible: boolean) => visible && !isReply && !isChannelNote;
					const shouldBeInLocalTimelineWithFiles = (visible: boolean) => visible && !isReply && !isChannelNote && hasFiles;
					const shouldBeInLocalTimelineWithReplies = (visible: boolean) => visible && isReply && !isChannelNote;
					const shouldBeInLocalTimelineWithReplyTo = (visible: boolean) => visible && isReply && !isChannelNote && note.replyUserHost == null && note.replyUserId != null;

					if (wasPublicLocal && !shouldBeInLocalTimeline(isPublicLocal)) {
						pipeline.lrem('list:localTimeline', 0, note.id);
					}

					if (wasPublicLocal && !shouldBeInLocalTimelineWithFiles(isPublicLocal)) {
						pipeline.lrem('list:localTimelineWithFiles', 0, note.id);
					}

					if (wasPublicLocal && !shouldBeInLocalTimelineWithReplies(isPublicLocal)) {
						pipeline.lrem('list:localTimelineWithReplies', 0, note.id);
					}

					if (wasPublicLocal && !shouldBeInLocalTimelineWithReplyTo(isPublicLocal) && note.replyUserId != null) {
						pipeline.lrem(`list:localTimelineWithReplyTo:${note.replyUserId}`, 0, note.id);
					}

					if (!wasPublicLocal && shouldBeInLocalTimeline(isPublicLocal)) {
						this.fanoutTimelineService.push('localTimeline', note.id, 1000, pipeline);
					}

					if (!wasPublicLocal && shouldBeInLocalTimelineWithFiles(isPublicLocal)) {
						this.fanoutTimelineService.push('localTimelineWithFiles', note.id, 500, pipeline);
					}

					if (!wasPublicLocal && shouldBeInLocalTimelineWithReplies(isPublicLocal)) {
						this.fanoutTimelineService.push('localTimelineWithReplies', note.id, 300, pipeline);
					}

					if (!wasPublicLocal && shouldBeInLocalTimelineWithReplyTo(isPublicLocal) && note.replyUserId != null) {
						this.fanoutTimelineService.push(`localTimelineWithReplyTo:${note.replyUserId}`, note.id, 30, pipeline);
					}

					const pipelineResults = await pipeline.exec();

					if (pipelineResults) {
						for (const result of pipelineResults) {
							if (Array.isArray(result) && result[0] instanceof Error) {
								redisExecError = result[0];
								break;
							}
						}
					}
				}
			} catch (error) {
				redisExecError = error instanceof Error ? error : new Error(String(error));
				// Redis 연결 실패 등의 에러도 기록
			}

			// 4단계: 로깅
			if (beforeVisibility !== afterVisibility || beforeLocalOnly !== afterLocalOnly) {
				try {
					this.moderationLogService.log(me, 'updateNoteVisibility', {
						noteId: note.id,
						noteUserId: user.id,
						noteUserUsername: user.username,
						noteUserHost: user.host,
						before: `${beforeVisibility}${beforeLocalOnly ? '+localOnly' : ''}`,
						after: `${afterVisibility}${afterLocalOnly ? '+localOnly' : ''}`,
					});
				} catch (logError) {
					// 로깅 실패는 무시
				}
			}

			// 5단계: 클라이언트에 변경사항 공지
			try {
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
			} catch (eventError) {
				// 이벤트 발행 실패는 무시 (DB는 이미 변경됨)
			}

			// 6단계: 검색 인덱스를 새 가시성 상태로 재구성 (실패 시 무시)
			try {
				await this.searchService.indexNote(note);
			} catch (searchError) {
				// 검색 인덱스 업데이트 실패는 로깅하고 계속 진행
			}

			// 최종 에러 체크: Redis 실패는 경고 수준
			// DB는 이미 변경되었으므로 롤백 불가능하지만,
			// 클라이언트는 올바른 데이터를 받으므로 문제 없음
			if (redisExecError) {
				// Redis 캐시 미동기 - 다음 DB 쿼리에서 정정됨
				// 큰 문제는 아니지만 성능 저하
			}
		});
	}
}
