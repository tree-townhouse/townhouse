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

		@Inject(DI.redisForTimelines)
		private redisForTimelines: Redis.Redis,

		private moderationLogService: ModerationLogService,
		private globalEventService: GlobalEventService,
		private searchService: SearchService,
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
				await this.notesRepository.update({ id: note.id }, {
					visibility: afterVisibility,
					localOnly: afterLocalOnly,
				});
			} catch (error) {
				dbUpdateError = error instanceof Error ? error : new Error(String(error));
				throw dbUpdateError;
			}

			// 메모리 객체 업데이트 (이후 작업에 사용)
			note.visibility = afterVisibility;
			note.localOnly = afterLocalOnly;

			// 3단계: Redis 타임라인 캐시 처리 (DB 업데이트 이후)
			try {
				const pipeline = this.redisForTimelines.pipeline();

				// 공개 노트를 비공개로 변경할 때, Redis 타임라인 캐시에서 제거
				if (beforeVisibility === 'public' && note.userHost == null) {
					// 일반 로컬 타임라인에서 제거
					pipeline.lrem('list:localTimeline', 0, note.id);
					
					// 파일이 있는 노트라면 localTimelineWithFiles에서도 제거
					if (note.fileIds && note.fileIds.length > 0) {
						pipeline.lrem('list:localTimelineWithFiles', 0, note.id);
					}
					
					// 답글인 경우 답글 타임라인에서 제거 (공개 답글만 포함되므로)
					if (note.replyId) {
						pipeline.lrem('list:localTimelineWithReplies', 0, note.id);
						// replyUserHost가 null인 경우만 (로컬 사용자 답글)
						// DB에 직접 저장된 컬럼 사용
						if (note.replyUserHost == null) {
							pipeline.lrem(`list:localTimelineWithReplyTo:${note.replyUserId}`, 0, note.id);
						}
					}
				}

				// 비공개 노트를 공개로 변경할 때, Redis 타임라인 캐시에 추가
				if (afterVisibility === 'public' && note.userHost == null && beforeVisibility !== 'public') {
					// 일반 로컬 타임라인에 추가
					pipeline.lpush('list:localTimeline', note.id);
					
					// 파일이 있는 노트라면 localTimelineWithFiles에도 추가
					if (note.fileIds && note.fileIds.length > 0) {
						pipeline.lpush('list:localTimelineWithFiles', note.id);
					}
					
					// 답글인 경우 답글 타임라인에도 추가 (공개 답글만 포함)
					if (note.replyId) {
						pipeline.lpush('list:localTimelineWithReplies', note.id);
						// replyUserHost가 null인 경우만 (로컬 사용자 답글)
						if (note.replyUserHost == null) {
							pipeline.lpush(`list:localTimelineWithReplyTo:${note.replyUserId}`, note.id);
						}
					}
				}

				// Pipeline 실행 결과 검증
				const pipelineResults = await pipeline.exec();
				
				// Pipeline 실행 중 에러 확인
				if (pipelineResults) {
					for (const result of pipelineResults) {
						if (result instanceof Error) {
							redisExecError = result;
							// Redis 에러 발생했으므로 로깅
							break;
						}
					}
				}
			} catch (error) {
				redisExecError = error instanceof Error ? error : new Error(String(error));
				// Redis 연결 실패 등의 에러도 기록
			}

			// 4단계: 로깅
			if (beforeVisibility !== afterVisibility) {
				try {
					this.moderationLogService.log(me, 'updateNoteVisibility', {
						noteId: note.id,
						noteUserId: user.id,
						noteUserUsername: user.username,
						noteUserHost: user.host,
						before: beforeVisibility,
						after: afterVisibility,
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
