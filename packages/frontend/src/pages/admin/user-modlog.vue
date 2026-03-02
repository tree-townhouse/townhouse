<!--
SPDX-FileCopyrightText: noridev and cherrypick-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps">
	<MkSelect v-model="logTypeFilter" :items="logTypeFilterDef">
		<template #label>{{ i18n.ts.filter }}</template>
	</MkSelect>

	<MkPagination :paginator="paginator">
		<template #default="{ items }">
			<div class="_gaps_s">
				<div v-for="log in items" :key="log.id" v-panel :class="$style.logItem">
					<div :class="$style.logHeader">
						<span :class="$style.logIcon">
							<i v-if="log.type === 'silence'" class="ti ti-volume-off" style="color: var(--MI_THEME-warn);"></i>
							<i v-else-if="log.type === 'unsilence'" class="ti ti-volume" style="color: var(--MI_THEME-success);"></i>
							<i v-else-if="log.type === 'warn'" class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i>
							<i v-else-if="log.type === 'resetWarning'" class="ti ti-alert-triangle-off" style="color: var(--MI_THEME-success);"></i>
							<i v-else-if="log.type === 'suspend'" class="ti ti-user-x" style="color: var(--MI_THEME-error);"></i>
							<i v-else-if="log.type === 'unsuspend'" class="ti ti-user-check" style="color: var(--MI_THEME-success);"></i>
							<i v-else class="ti ti-file-info"></i>
						</span>
						<span :class="$style.logType">{{ i18n.ts._moderationLogTypes[log.type] ?? log.type }}</span>
						<span :class="$style.logTime"><MkTime :time="log.createdAt" mode="detail"/></span>
					</div>

					<div :class="$style.logBody">
						<div :class="$style.logModerator">
							{{ i18n.ts.moderator }}: <MkA :to="`/admin/user/${log.userId}`" class="_link">@{{ log.user?.username }}</MkA>
						</div>

						<!-- Silence details -->
						<template v-if="log.type === 'silence'">
							<div>{{ i18n.ts.reason }}: {{ log.info.reason }}</div>
							<div v-if="log.info.expiresAt">{{ i18n.ts.period }}: {{ new Date(log.info.expiresAt).toLocaleString() }}</div>
							<div v-else>{{ i18n.ts.period }}: {{ i18n.ts.indefinitely }}</div>
						</template>

						<!-- Warn details -->
						<template v-else-if="log.type === 'warn'">
							<div>{{ i18n.ts.reason }}: {{ log.info.reason }}</div>
						</template>

						<!-- Suspend details -->
						<template v-else-if="log.type === 'suspend'">
							<div>{{ i18n.ts.reason }}: {{ log.info.reason }}</div>
						</template>

						<!-- Reset warning details -->
						<template v-else-if="log.type === 'resetWarning'">
							<div>{{ i18n.tsx.warningCount({ count: log.info.previousCount }) }}</div>
						</template>
					</div>

					<!-- Edit/Delete buttons (admin only) -->
					<div v-if="iAmAdmin" :class="$style.logActions">
						<MkButton v-if="isEditableType(log.type)" small @click="editLog(log)">
							<i class="ti ti-pencil"></i> {{ i18n.ts.edit }}
						</MkButton>
						<MkButton small danger @click="deleteLog(log)">
							<i class="ti ti-trash"></i> {{ i18n.ts.delete }}
						</MkButton>
					</div>
				</div>
			</div>
		</template>

		<template #empty>
			<div :class="$style.empty">
				{{ i18n.ts.noModerationHistory }}
			</div>
		</template>
	</MkPagination>
</div>
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import MkPagination from '@/components/MkPagination.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { iAmAdmin } from '@/i.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	userId: string;
}>();

const emit = defineEmits<{
	(ev: 'refresh'): void;
}>();

const MODERATION_TYPES = [
	'silence', 'unsilence', 'warn', 'resetWarning', 'suspend', 'unsuspend',
];

const {
	model: logTypeFilter,
	def: logTypeFilterDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'all' },
		{ label: i18n.ts._moderationLogTypes.silence ?? 'Silence', value: 'silence' },
		{ label: i18n.ts._moderationLogTypes.warn ?? 'Warn', value: 'warn' },
		{ label: i18n.ts._moderationLogTypes.suspend ?? 'Suspend', value: 'suspend' },
	],
	initialValue: 'all',
});

const paginator = markRaw(new Paginator('admin/show-moderation-logs', {
	limit: 20,
	computedParams: computed(() => {
		const params: Record<string, any> = {
			targetUserId: props.userId,
		};
		if (logTypeFilter.value !== 'all') {
			params.type = logTypeFilter.value;
		}
		return params;
	}),
}));

function isEditableType(type: string): boolean {
	return ['silence', 'suspend', 'warn'].includes(type);
}

async function editLog(log: any) {
	if (log.type === 'silence') {
		await editSilenceLog(log);
	} else if (log.type === 'suspend') {
		await editSuspendLog(log);
	} else if (log.type === 'warn') {
		await editWarnLog(log);
	}
}

async function editSilenceLog(log: any) {
	const { canceled: canceledReason, result: reason } = await os.inputText({
		title: i18n.ts.reason,
		default: log.info.reason,
	});
	if (canceledReason) return;

	const { canceled: canceledPeriod, result: period } = await os.select({
		title: i18n.ts.silencePeriod,
		items: [{
			value: 'keep', label: i18n.ts.noChange ?? '変更なし',
		}, {
			value: 'indefinitely', label: i18n.ts.indefinitely,
		}, {
			value: 'oneHour', label: i18n.ts.oneHour,
		}, {
			value: 'oneDay', label: i18n.ts.oneDay,
		}, {
			value: 'oneWeek', label: i18n.ts.oneWeek,
		}, {
			value: 'oneMonth', label: i18n.ts.oneMonth,
		}],
		default: 'keep',
	});
	if (canceledPeriod) return;

	const params: Record<string, any> = {
		logId: log.id,
	};

	if (reason !== log.info.reason) {
		params.reason = reason;
	}

	if (period !== 'keep') {
		// Recalculate expiresAt based on original action time
		const actionTime = new Date(log.createdAt).getTime();
		params.expiresAt = period === 'indefinitely' ? null
			: period === 'oneHour' ? actionTime + (1000 * 60 * 60)
			: period === 'oneDay' ? actionTime + (1000 * 60 * 60 * 24)
			: period === 'oneWeek' ? actionTime + (1000 * 60 * 60 * 24 * 7)
			: period === 'oneMonth' ? actionTime + (1000 * 60 * 60 * 24 * 30)
			: null;
	}

	await os.apiWithDialog('admin/update-moderation-log', params);
	paginator.reload();
	emit('refresh');
}

async function editSuspendLog(log: any) {
	const { canceled, result: reason } = await os.inputText({
		title: i18n.ts.reason,
		default: log.info.reason,
	});
	if (canceled) return;

	await os.apiWithDialog('admin/update-moderation-log', {
		logId: log.id,
		reason,
	});
	paginator.reload();
	emit('refresh');
}

async function editWarnLog(log: any) {
	const { canceled, result: reason } = await os.inputText({
		title: i18n.ts.reason,
		default: log.info.reason,
	});
	if (canceled) return;

	await os.apiWithDialog('admin/update-moderation-log', {
		logId: log.id,
		reason,
	});
	paginator.reload();
	emit('refresh');
}

async function deleteLog(log: any) {
	const confirm = await os.confirm({
		type: 'warning',
		title: i18n.ts.deleteModerationLog,
		text: i18n.ts.confirmDeleteModerationLog,
	});
	if (confirm.canceled) return;

	await os.apiWithDialog('admin/delete-moderation-log', {
		logId: log.id,
	});
	paginator.reload();
	emit('refresh');
}
</script>

<style lang="scss" module>
.logItem {
	padding: 12px 16px;
	border-radius: 8px;
}

.logHeader {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px;
}

.logIcon {
	font-size: 1.2em;
}

.logType {
	font-weight: bold;
	flex: 1;
}

.logTime {
	font-size: 0.85em;
	opacity: 0.7;
}

.logBody {
	font-size: 0.95em;
	margin-bottom: 8px;

	> div {
		margin: 2px 0;
	}
}

.logModerator {
	opacity: 0.7;
	font-size: 0.9em;
}

.logActions {
	display: flex;
	gap: 8px;
	justify-content: flex-end;
	margin-top: 4px;
}

.empty {
	text-align: center;
	padding: 32px;
	opacity: 0.7;
}
</style>
