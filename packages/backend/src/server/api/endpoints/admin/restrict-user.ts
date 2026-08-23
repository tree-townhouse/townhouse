/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { UsersRepository } from '@/models/_.js';
import { UserRestrictionService } from '@/core/UserRestrictionService.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	kind: 'write:admin:restrict-user',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		reason: { type: 'string', minLength: 1, maxLength: 512 },
		message: { type: 'string', maxLength: 2048 },
		expiresAt: { type: 'integer', nullable: true },
	},
	required: ['userId', 'reason'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		private userRestrictionService: UserRestrictionService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const user = await this.usersRepository.findOneBy({ id: ps.userId });
			if (user == null) {
				throw new Error('user not found');
			}
			if (user.host != null) {
				throw new Error('cannot restrict remote user');
			}
			if (await this.roleService.isModerator(user)) {
				throw new Error('cannot restrict moderator account');
			}

			const expiresAt = ps.expiresAt != null ? new Date(ps.expiresAt) : null;
			if (expiresAt != null && expiresAt.getTime() <= Date.now()) {
				throw new Error('expiresAt must be in the future');
			}

			await this.userRestrictionService.restrict(user, me, ps.reason, ps.message ?? '', expiresAt);
		});
	}
}
