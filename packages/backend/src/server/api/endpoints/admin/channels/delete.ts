/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelsRepository, NotesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin', 'channels'],

	requireCredential: true,
	requireAdmin: true,
	kind: 'write:admin:channels',

	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'e0460b5e-1a02-4c29-a8b0-004001000001',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
	},
	required: ['channelId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({ id: ps.channelId });
			if (!channel) {
				throw new ApiError(meta.errors.noSuchChannel);
			}

			// Delete all notes in the channel
			await this.notesRepository.delete({ channelId: channel.id });

			// Delete the channel (cascade will clean up followings, favorites, muting, moderators, bans)
			await this.channelsRepository.delete(channel.id);

			// Log moderation action
			await this.moderationLogService.log(me, 'deleteChannel', {
				channelId: channel.id,
				channelName: channel.name,
			});
		});
	}
}
