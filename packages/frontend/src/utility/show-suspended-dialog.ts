/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

export function showSuspendedDialog(opts?: { title?: string; text?: string }) {
	return os.alert({
		type: 'error',
		title: opts?.title || i18n.ts.yourAccountSuspendedTitle,
		text: opts?.text || i18n.ts.yourAccountSuspendedDescription,
	});
}
