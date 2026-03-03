/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelsRepository, NotesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['channels'],

	requireCredential: true,
	kind: 'write:channels',

	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'e0460b5e-1a02-4c29-a8b0-006001000001',
		},
		notChannelOwner: {
			message: 'You are not the owner of this channel.',
			code: 'NOT_CHANNEL_OWNER',
			id: 'e0460b5e-1a02-4c29-a8b0-006001000002',
		},
		channelAlreadyApproved: {
			message: 'This channel is already approved.',
			code: 'CHANNEL_ALREADY_APPROVED',
			id: 'e0460b5e-1a02-4c29-a8b0-006001000003',
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
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({ id: ps.channelId });
			if (!channel) {
				throw new ApiError(meta.errors.noSuchChannel);
			}

			if (channel.userId !== me.id) {
				throw new ApiError(meta.errors.notChannelOwner);
			}

			if (channel.isApproved) {
				throw new ApiError(meta.errors.channelAlreadyApproved);
			}

			// Delete all notes in the channel (if any)
			await this.notesRepository.delete({ channelId: channel.id });

			// Delete the channel
			await this.channelsRepository.delete(channel.id);
		});
	}
}
