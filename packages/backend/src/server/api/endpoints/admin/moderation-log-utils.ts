/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiModerationLog } from '@/models/ModerationLog.js';
import type { UsersRepository } from '@/models/_.js';

export const SANCTION_HISTORY_KEY = '_sanctionHistory';

export const DELETABLE_LOG_TYPES = ['silence', 'restrict', 'suspend', 'warn', 'unsilence', 'unrestrict', 'unsuspend', 'resetWarning'];
export const CANCELLABLE_LOG_TYPES = ['silence', 'restrict', 'suspend', 'warn'];

export function isCancelledModerationLog(log: MiModerationLog): boolean {
	return log.info[SANCTION_HISTORY_KEY]?.status === 'cancelled';
}

export function getOriginalModerationLogInfo(info: Record<string, any>): Record<string, any> {
	const history = info[SANCTION_HISTORY_KEY];
	if (history?.original != null && typeof history.original === 'object') {
		return history.original;
	}

	const { [SANCTION_HISTORY_KEY]: _, ...originalInfo } = info;
	return originalInfo;
}

export async function revertModerationAction(usersRepository: UsersRepository, log: MiModerationLog): Promise<void> {
	const targetUserId = log.info.userId;
	if (!targetUserId) return;

	const user = await usersRepository.findOneBy({ id: targetUserId });
	if (!user) return;

	switch (log.type) {
		case 'silence':
			if (user.isSilenced) {
				await usersRepository.update(targetUserId, {
					isSilenced: false,
					silencedUntil: null,
				});
			}
			break;

		case 'restrict':
			if (user.isRestricted) {
				await usersRepository.update(targetUserId, {
					isRestricted: false,
					restrictedUntil: null,
				});
			}
			break;

		case 'suspend':
			if (user.isSuspended) {
				await usersRepository.update(targetUserId, {
					isSuspended: false,
					suspendReason: null,
					suspendMessage: null,
				});
			}
			break;

		case 'warn':
			if (user.warningCount > 0) {
				await usersRepository.decrement({ id: targetUserId }, 'warningCount', 1);
			}
			break;
	}
}

export async function applyModerationAction(usersRepository: UsersRepository, log: MiModerationLog): Promise<void> {
	const targetUserId = log.info.userId;
	if (!targetUserId) return;

	const user = await usersRepository.findOneBy({ id: targetUserId });
	if (!user) return;

	switch (log.type) {
		case 'silence':
			await usersRepository.update(targetUserId, {
				isSilenced: true,
				silencedUntil: log.info.expiresAt == null ? null : new Date(log.info.expiresAt),
			});
			break;

		case 'restrict':
			await usersRepository.update(targetUserId, {
				isRestricted: true,
				restrictedUntil: log.info.expiresAt == null ? null : new Date(log.info.expiresAt),
			});
			break;

		case 'suspend':
			await usersRepository.update(targetUserId, {
				isSuspended: true,
				suspendReason: log.info.reason ?? null,
				suspendMessage: log.info.message ?? null,
			});
			break;

		case 'warn':
			await usersRepository.increment({ id: targetUserId }, 'warningCount', 1);
			break;
	}
}
