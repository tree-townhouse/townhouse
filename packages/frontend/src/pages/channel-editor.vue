<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px;">
		<div v-if="channelId == null || channel != null" class="_gaps_m">
			<!-- Admin-only settings (channel owner / server moderator) -->
			<template v-if="isChannelAdmin">
				<MkInput v-model="name">
					<template #label>{{ i18n.ts.name }}</template>
				</MkInput>

				<MkTextarea v-model="description" mfmAutocomplete :mfmPreview="true">
					<template #label>{{ i18n.ts.description }}</template>
				</MkTextarea>

				<MkColorInput v-model="color">
					<template #label>{{ i18n.ts.color }}</template>
				</MkColorInput>

				<MkSwitch v-model="isSensitive">
					<template #label>{{ i18n.ts.sensitive }}</template>
				</MkSwitch>

				<MkSwitch v-model="allowRenoteToExternal">
					<template #label>{{ i18n.ts._channel.allowRenoteToExternal }}</template>
				</MkSwitch>

				<div>
					<MkButton v-if="bannerId == null" @click="setBannerImage"><i class="ti ti-plus"></i> {{ i18n.ts._channel.setBanner }}</MkButton>
					<div v-else-if="bannerUrl">
						<img :src="bannerUrl" style="width: 100%;"/>
						<MkButton @click="removeBannerImage()"><i class="ti ti-trash"></i> {{ i18n.ts._channel.removeBanner }}</MkButton>
					</div>
				</div>
			</template>

			<!-- Pinned Notes (admin + moderator) -->
			<MkFolder :defaultOpen="true">
				<template #label>{{ i18n.ts.pinnedNotes }}</template>

				<div class="_gaps">
					<MkButton primary rounded @click="addPinnedNote()"><i class="ti ti-plus"></i></MkButton>

					<Sortable
						v-model="pinnedNotes"
						itemKey="id"
						:handle="'.' + $style.pinnedNoteHandle"
						:animation="150"
					>
						<template #item="{element,index}">
							<div :class="$style.pinnedNote">
								<button class="_button" :class="$style.pinnedNoteHandle"><i class="ti ti-menu"></i></button>
								{{ element.id }}
								<button class="_button" :class="$style.pinnedNoteRemove" @click="removePinnedNote(index)"><i class="ti ti-x"></i></button>
							</div>
						</template>
					</Sortable>
				</div>
			</MkFolder>

			<!-- Moderator Management (admin only) -->
			<MkFolder v-if="isChannelAdmin && channelId">
				<template #label><i class="ti ti-shield-check ti-fw" style="margin-right: 0.5em;"></i>{{ i18n.ts.channelModerators }}</template>

				<div class="_gaps">
					<MkButton primary rounded @click="addModerator()"><i class="ti ti-plus"></i> {{ i18n.ts.addModerator }}</MkButton>

					<div v-if="moderators.length === 0" style="text-align: center; opacity: 0.5;">{{ i18n.ts.noModerators }}</div>
					<div v-for="mod in moderators" :key="mod.userId" :class="$style.moderatorItem">
						<MkAvatar :user="mod.user" :class="$style.moderatorAvatar"/>
						<MkUserName :user="mod.user" :class="$style.moderatorName"/>
						<MkButton danger small @click="removeModerator(mod)"><i class="ti ti-x"></i></MkButton>
					</div>
				</div>
			</MkFolder>

			<!-- Ban Management (admin + moderator) -->
			<MkFolder v-if="(isChannelAdmin || isChannelModerator) && channelId">
				<template #label><i class="ti ti-ban ti-fw" style="margin-right: 0.5em;"></i>{{ i18n.ts.channelBannedUsers }}</template>

				<div class="_gaps">
					<MkButton primary rounded @click="banUser()"><i class="ti ti-plus"></i> {{ i18n.ts.banUser }}</MkButton>

					<div v-if="bannedUsers.length === 0" style="text-align: center; opacity: 0.5;">{{ i18n.ts.noBannedUsers }}</div>
					<div v-for="ban in bannedUsers" :key="ban.id" :class="$style.moderatorItem">
						<MkAvatar :user="ban.user" :class="$style.moderatorAvatar"/>
						<MkUserName :user="ban.user" :class="$style.moderatorName"/>
						<span v-if="ban.expiresAt" style="opacity: 0.7; font-size: 0.85em; margin-left: 0.5em;">{{ banRemainingLabel(ban.expiresAt) }}</span>
						<span v-else style="opacity: 0.7; font-size: 0.85em; margin-left: 0.5em;">{{ i18n.ts.banPermanent }}</span>
						<MkButton danger small @click="unbanUser(ban)"><i class="ti ti-x"></i></MkButton>
					</div>
				</div>
			</MkFolder>

			<div class="_buttons">
				<MkButton v-if="isChannelAdmin" primary @click="save()"><i class="ti ti-device-floppy"></i> {{ channelId ? i18n.ts.save : i18n.ts.create }}</MkButton>
				<MkButton v-else-if="isChannelModerator" primary @click="savePinnedOnly()"><i class="ti ti-device-floppy"></i> {{ i18n.ts.save }}</MkButton>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, ref, watch, defineAsyncComponent } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkColorInput from '@/components/MkColorInput.vue';
import { selectFile } from '@/utility/drive.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import MkFolder from '@/components/MkFolder.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import { useRouter } from '@/router.js';
import { $i, iAmModerator } from '@/i.js';

const Sortable = defineAsyncComponent(() => import('vuedraggable').then(x => x.default));

const router = useRouter();

const props = defineProps<{
	channelId?: string;
}>();

const channel = ref<Misskey.entities.Channel | null>(null);
const name = ref<string>('');
const description = ref<string | null>(null);
const bannerUrl = ref<string | null>(null);
const bannerId = ref<string | null>(null);
const color = ref('#000');
const isSensitive = ref(false);
const allowRenoteToExternal = ref(true);
const pinnedNotes = ref<{ id: Misskey.entities.Note['id'] }[]>([]);
const moderators = ref<any[]>([]);
const bannedUsers = ref<any[]>([]);

const isChannelAdmin = computed(() => {
	if (!channel.value || !$i) return props.channelId == null; // new channel = admin
	return $i.id === channel.value.userId || iAmModerator;
});

const isChannelModerator = computed(() => {
	if (!channel.value || !$i) return false;
	return channel.value.isChannelModerator ?? false;
});

watch(() => bannerId.value, async () => {
	if (bannerId.value == null) {
		bannerUrl.value = null;
	} else {
		bannerUrl.value = (await misskeyApi('drive/files/show', {
			fileId: bannerId.value,
		})).url;
	}
});

async function fetchChannel() {
	if (props.channelId == null) return;

	const result = await misskeyApi('channels/show', {
		channelId: props.channelId,
	});

	name.value = result.name;
	description.value = result.description;
	bannerId.value = result.bannerId;
	bannerUrl.value = result.bannerUrl;
	isSensitive.value = result.isSensitive;
	pinnedNotes.value = result.pinnedNoteIds.map(id => ({
		id,
	}));
	color.value = result.color;
	allowRenoteToExternal.value = result.allowRenoteToExternal;

	channel.value = result;

	// Fetch moderators and banned users
	await Promise.all([
		fetchModerators(),
		fetchBannedUsers(),
	]);
}

async function fetchModerators() {
	if (!props.channelId) return;
	try {
		moderators.value = await misskeyApi('channels/moderator/list', {
			channelId: props.channelId,
		});
	} catch {
		moderators.value = [];
	}
}

async function fetchBannedUsers() {
	if (!props.channelId) return;
	try {
		bannedUsers.value = await misskeyApi('channels/ban/list', {
			channelId: props.channelId,
		});
	} catch {
		bannedUsers.value = [];
	}
}

fetchChannel();

async function addPinnedNote() {
	const { canceled, result: value } = await os.inputText({
		title: i18n.ts.noteIdOrUrl,
	});
	if (canceled || value == null) return;
	const fromUrl = value.includes('/') ? value.split('/').pop() : null;
	const note = await os.apiWithDialog('notes/show', {
		noteId: fromUrl ?? value,
	});
	pinnedNotes.value = [{
		id: note.id,
	}, ...pinnedNotes.value];
}

function removePinnedNote(index: number) {
	pinnedNotes.value.splice(index, 1);
}

function save() {
	const params = {
		name: name.value,
		description: description.value,
		bannerId: bannerId.value,
		color: color.value,
		isSensitive: isSensitive.value,
		allowRenoteToExternal: allowRenoteToExternal.value,
	} satisfies Misskey.entities.ChannelsCreateRequest;

	if (props.channelId != null) {
		os.apiWithDialog('channels/update', {
			...params,
			channelId: props.channelId,
			pinnedNoteIds: pinnedNotes.value.map(x => x.id),
		});
	} else {
		os.apiWithDialog('channels/create', params).then(created => {
			router.push('/channels/:channelId', {
				params: {
					channelId: created.id,
				},
			});
		});
	}
}

function savePinnedOnly() {
	if (props.channelId == null) return;
	os.apiWithDialog('channels/update', {
		channelId: props.channelId,
		pinnedNoteIds: pinnedNotes.value.map(x => x.id),
	});
}

async function addModerator() {
	if (!props.channelId) return;
	const user = await os.selectUser();
	if (!user) return;

	await os.apiWithDialog('channels/moderator/add', {
		channelId: props.channelId,
		userId: user.id,
	});

	os.alert({
		type: 'success',
		text: i18n.ts.moderatorInvitationSent,
	});
}

async function removeModerator(mod: any) {
	if (!props.channelId) return;

	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.ts.removeModeratorConfirm,
	});
	if (canceled) return;

	await os.apiWithDialog('channels/moderator/remove', {
		channelId: props.channelId,
		userId: mod.user.id,
	});

	await fetchModerators();
}

async function banUser() {
	if (!props.channelId) return;
	const user = await os.selectUser();
	if (!user) return;

	const { canceled, result: period } = await os.select({
		title: i18n.ts.banDuration,
		items: [{
			value: 'oneDay', label: i18n.ts.ban1Day,
		}, {
			value: 'oneWeek', label: i18n.ts.ban7Days,
		}, {
			value: 'oneMonth', label: i18n.ts.ban30Days,
		}, {
			value: 'permanent', label: i18n.ts.banPermanent,
		}],
		default: 'permanent',
	});
	if (canceled) return;

	const expiresAt = period === 'oneDay' ? Date.now() + (1000 * 60 * 60 * 24)
		: period === 'oneWeek' ? Date.now() + (1000 * 60 * 60 * 24 * 7)
		: period === 'oneMonth' ? Date.now() + (1000 * 60 * 60 * 24 * 30)
		: null;

	await os.apiWithDialog('channels/ban/create', {
		channelId: props.channelId,
		userId: user.id,
		expiresAt,
	});

	await fetchBannedUsers();
}

function banRemainingLabel(expiresAt: string): string {
	const remaining = new Date(expiresAt).getTime() - Date.now();
	if (remaining <= 0) return i18n.ts.banExpired;
	const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
	const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	if (days > 0) return i18n.tsx.banRemainingDays({ days: days.toString() });
	return i18n.tsx.banRemainingHours({ hours: hours.toString() });
}

async function unbanUser(ban: any) {
	if (!props.channelId) return;

	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.ts.unbanUserConfirm,
	});
	if (canceled) return;

	await os.apiWithDialog('channels/ban/delete', {
		channelId: props.channelId,
		userId: ban.user.id,
	});

	await fetchBannedUsers();
}

function setBannerImage(evt) {
	selectFile({
		anchorElement: evt.currentTarget ?? evt.target,
		multiple: false,
	}).then(file => {
		bannerId.value = file.id;
	});
}

function removeBannerImage() {
	bannerId.value = null;
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: props.channelId ? i18n.ts.channelSettings : i18n.ts._channel.create,
	icon: 'ti ti-device-tv',
}));
</script>

<style lang="scss" module>
.pinnedNote {
	position: relative;
	display: block;
	line-height: 2.85rem;
	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
	color: var(--MI_THEME-navFg);
}

.pinnedNoteRemove {
	position: absolute;
	z-index: 10000;
	width: 32px;
	height: 32px;
	color: #ff2a2a;
	right: 8px;
	opacity: 0.8;
}

.pinnedNoteHandle {
	cursor: move;
	width: 32px;
	height: 32px;
	margin: 0 8px;
	opacity: 0.5;
}

.moderatorItem {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px;
}

.moderatorAvatar {
	width: 32px;
	height: 32px;
}

.moderatorName {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
