/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ChannelModerationService } from '@/core/ChannelModerationService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['channels', 'notes'],

	requireCredential: true,

	prohibitRestricted: true,

	kind: 'write:channels',

	errors: {
		accessDenied: {
			message: 'You do not have permission.',
			code: 'ACCESS_DENIED',
			id: 'e0460b5e-1a02-4c29-a8b0-003001000001',
		},
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: 'e0460b5e-1a02-4c29-a8b0-003001000002',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
		noteId: { type: 'string', format: 'misskey:id' },
	},
	required: ['channelId', 'noteId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private channelModerationService: ChannelModerationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				await this.channelModerationService.deleteNote(ps.channelId, me.id, ps.noteId);
			} catch (e: any) {
				switch (e.message) {
					case 'ACCESS_DENIED': throw new ApiError(meta.errors.accessDenied);
					case 'NO_SUCH_NOTE': throw new ApiError(meta.errors.noSuchNote);
					default: throw e;
				}
			}
		});
	}
}
