<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px;">
		<!-- Settings -->
		<div v-if="tab === 'settings'" class="_gaps_m">
			<MkSwitch v-model="requireChannelApproval" @update:modelValue="saveSettings">
				<template #label>{{ i18n.ts.requireChannelApproval }}</template>
				<template #caption>{{ i18n.ts.requireChannelApprovalDescription }}</template>
			</MkSwitch>
		</div>

		<!-- Pending Channels -->
		<div v-else-if="tab === 'pending'" class="_gaps_m">
			<div v-if="pendingChannels.length === 0" style="text-align: center; opacity: 0.5; padding: 16px;">
				{{ i18n.ts.noPendingChannels }}
			</div>
			<div v-for="ch in pendingChannels" :key="ch.id" class="_panel" :class="$style.channelItem">
				<div :class="$style.channelInfo">
					<b>{{ ch.name }}</b>
					<span v-if="ch.description" :class="$style.channelDescription">{{ ch.description }}</span>
				</div>
				<div :class="$style.channelActions">
					<MkButton primary small @click="approveChannel(ch)"><i class="ti ti-check"></i> {{ i18n.ts.approve }}</MkButton>
					<MkButton danger small @click="deleteChannel(ch)"><i class="ti ti-trash"></i> {{ i18n.ts.delete }}</MkButton>
				</div>
			</div>
		</div>

		<!-- All Channels (for delete) -->
		<div v-else-if="tab === 'all'" class="_gaps_m">
			<MkInput v-model="searchQuery" @enter="searchChannels()">
				<template #prefix><i class="ti ti-search"></i></template>
				<template #label>{{ i18n.ts.search }}</template>
			</MkInput>
			<MkButton primary rounded @click="searchChannels()">{{ i18n.ts.search }}</MkButton>

			<div v-if="allChannels.length === 0" style="text-align: center; opacity: 0.5; padding: 16px;">
				{{ i18n.ts.nothing }}
			</div>
			<div v-for="ch in allChannels" :key="ch.id" class="_panel" :class="$style.channelItem">
				<div :class="$style.channelInfo">
					<b>{{ ch.name }}</b>
					<span :class="$style.channelMeta">
						<i class="ti ti-users"></i> {{ ch.usersCount }}
						<i class="ti ti-pencil" style="margin-left: 8px;"></i> {{ ch.notesCount }}
					</span>
				</div>
				<div :class="$style.channelActions">
					<MkButton small @click="transferOwnership(ch)"><i class="ti ti-transfer"></i> {{ i18n.ts.transferOwnership }}</MkButton>
					<MkButton small @click="manageModerators(ch)"><i class="ti ti-shield"></i> {{ i18n.ts.channelModerators }}</MkButton>
					<MkButton danger small @click="deleteChannel(ch)"><i class="ti ti-trash"></i> {{ i18n.ts.delete }}</MkButton>
				</div>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkInput from '@/components/MkInput.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

const tab = ref('settings');
const requireChannelApproval = ref(false);
const pendingChannels = ref<any[]>([]);
const allChannels = ref<any[]>([]);
const searchQuery = ref('');

// Fetch initial settings
misskeyApi('admin/meta').then(meta => {
	requireChannelApproval.value = meta.requireChannelApproval ?? false;
});

async function saveSettings() {
	await misskeyApi('admin/update-meta', {
		requireChannelApproval: requireChannelApproval.value,
	});
	os.success();
}

async function fetchPendingChannels() {
	try {
		pendingChannels.value = await misskeyApi('admin/channels/pending', {});
	} catch {
		pendingChannels.value = [];
	}
}

async function searchChannels() {
	try {
		allChannels.value = await misskeyApi('channels/search', {
			query: searchQuery.value,
			limit: 30,
		});
	} catch {
		allChannels.value = [];
	}
}

async function approveChannel(ch: any) {
	const { canceled } = await os.confirm({
		type: 'info',
		text: i18n.tsx.approveChannelConfirm({ name: ch.name }),
	});
	if (canceled) return;

	await os.apiWithDialog('admin/channels/approve', {
		channelId: ch.id,
	});

	await fetchPendingChannels();
}

async function deleteChannel(ch: any) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.tsx.deleteChannelConfirm({ name: ch.name }),
	});
	if (canceled) return;

	await os.apiWithDialog('admin/channels/delete', {
		channelId: ch.id,
	});

	// Refresh both lists
	await Promise.all([
		fetchPendingChannels(),
		allChannels.value.length > 0 ? searchChannels() : Promise.resolve(),
	]);
}

async function transferOwnership(ch: any) {
	const user = await os.selectUser();
	if (!user) return;

	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.tsx.transferOwnershipConfirm({ name: ch.name, user: user.username }),
	});
	if (canceled) return;

	await os.apiWithDialog('admin/channels/transfer', {
		channelId: ch.id,
		userId: user.id,
	});

	if (allChannels.value.length > 0) await searchChannels();
}

async function manageModerators(ch: any) {
	// Fetch current moderators
	let moderators: any[] = [];
	try {
		moderators = await misskeyApi('channels/moderator/list', {
			channelId: ch.id,
		});
	} catch {
		moderators = [];
	}

	const { canceled, result } = await os.select({
		title: i18n.tsx.channelModeratorsOf({ name: ch.name }),
		items: [{
			value: 'add', label: i18n.ts.addModerator,
		}, {
			value: 'remove', label: i18n.ts.removeModerator,
		}],
	});
	if (canceled) return;

	if (result === 'add') {
		const user = await os.selectUser();
		if (!user) return;

		await os.apiWithDialog('channels/moderator/add', {
			channelId: ch.id,
			userId: user.id,
		});
	} else if (result === 'remove') {
		if (moderators.length === 0) {
			os.alert({ type: 'info', text: i18n.ts.noModerators });
			return;
		}

		const { canceled: canceled2, result: userId } = await os.select({
			title: i18n.ts.removeModerator,
			items: moderators.map((m: any) => ({
				value: m.user.id,
				label: m.user.username,
			})),
		});
		if (canceled2) return;

		await os.apiWithDialog('channels/moderator/remove', {
			channelId: ch.id,
			userId,
		});
	}
}

// Watch tab changes to load data
watch(tab, (newTab) => {
	if (newTab === 'pending') {
		fetchPendingChannels();
	}
}, { immediate: true });

const headerActions = computed(() => []);

const headerTabs = computed(() => [{
	key: 'settings',
	title: i18n.ts.settings,
	icon: 'ti ti-settings',
}, {
	key: 'pending',
	title: i18n.ts.pendingChannels,
	icon: 'ti ti-clock',
}, {
	key: 'all',
	title: i18n.ts.allChannels,
	icon: 'ti ti-list',
}]);

definePage(() => ({
	title: i18n.ts.channelManagement,
	icon: 'ti ti-device-tv',
}));
</script>

<style lang="scss" module>
.channelItem {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px;
	gap: 12px;
}

.channelInfo {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	flex: 1;
}

.channelDescription {
	font-size: 0.85em;
	opacity: 0.7;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.channelMeta {
	font-size: 0.85em;
	opacity: 0.7;
}

.channelActions {
	display: flex;
	gap: 8px;
	flex-shrink: 0;
}
</style>
