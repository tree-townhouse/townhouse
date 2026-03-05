<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :tabs="headerTabs">
	<!-- メールサーバー設定タブ -->
	<div v-if="tab === 'settings'" class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<SearchMarker path="/admin/email-settings" :label="i18n.ts.emailServerSettings" :keywords="['email']" icon="ti ti-mail">
			<div class="_gaps_m">
				<SearchMarker>
					<MkSwitch v-model="enableEmail">
						<template #label><SearchLabel>{{ i18n.ts.enableEmail }}</SearchLabel> ({{ i18n.ts.recommended }})</template>
						<template #caption><SearchText>{{ i18n.ts.emailConfigInfo }}</SearchText></template>
					</MkSwitch>
				</SearchMarker>

				<template v-if="enableEmail">
					<SearchMarker>
						<MkInput v-model="email" type="email">
							<template #label><SearchLabel>{{ i18n.ts.emailAddress }}</SearchLabel></template>
						</MkInput>
					</SearchMarker>

					<SearchMarker>
						<FormSection>
							<template #label><SearchLabel>{{ i18n.ts.smtpConfig }}</SearchLabel></template>

							<div class="_gaps_m">
								<FormSplit :minWidth="280">
									<SearchMarker>
										<MkInput v-model="smtpHost">
											<template #label><SearchLabel>{{ i18n.ts.smtpHost }}</SearchLabel></template>
										</MkInput>
									</SearchMarker>
									<SearchMarker>
										<MkInput v-model="smtpPort" type="number">
											<template #label><SearchLabel>{{ i18n.ts.smtpPort }}</SearchLabel></template>
										</MkInput>
									</SearchMarker>
								</FormSplit>

								<FormSplit :minWidth="280">
									<SearchMarker>
										<MkInput v-model="smtpUser">
											<template #label><SearchLabel>{{ i18n.ts.smtpUser }}</SearchLabel></template>
										</MkInput>
									</SearchMarker>
									<SearchMarker>
										<MkInput v-model="smtpPass" type="password">
											<template #label><SearchLabel>{{ i18n.ts.smtpPass }}</SearchLabel></template>
										</MkInput>
									</SearchMarker>
								</FormSplit>

								<FormInfo>{{ i18n.ts.emptyToDisableSmtpAuth }}</FormInfo>

								<SearchMarker>
									<MkSwitch v-model="smtpSecure">
										<template #label><SearchLabel>{{ i18n.ts.smtpSecure }}</SearchLabel></template>
										<template #caption><SearchText>{{ i18n.ts.smtpSecureInfo }}</SearchText></template>
									</MkSwitch>
								</SearchMarker>
							</div>
						</FormSection>
					</SearchMarker>
				</template>
			</div>
		</SearchMarker>
	</div>

	<!-- メール送信タブ -->
	<div v-else-if="tab === 'send'" class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps_m">
			<MkRadios v-model="recipientMode">
				<template #label>{{ i18n.ts.emailRecipient }}</template>
				<option value="direct"><i class="ti ti-keyboard"></i> {{ i18n.ts.emailRecipientDirect }}</option>
				<option value="user"><i class="ti ti-user"></i> {{ i18n.ts.emailRecipientSelectUser }}</option>
			</MkRadios>

			<MkInput v-if="recipientMode === 'direct'" v-model="sendTo" type="email">
				<template #label>{{ i18n.ts.emailAddress }}</template>
				<template #prefix><i class="ti ti-mail"></i></template>
			</MkInput>

			<div v-else-if="recipientMode === 'user'" class="_gaps_s">
				<MkButton rounded @click="pickUser"><i class="ti ti-user-search"></i> {{ i18n.ts.emailSelectUser }}</MkButton>
				<div v-if="selectedUser" :class="$style.selectedUser">
					<MkAvatar :user="selectedUser" :class="$style.selectedUserAvatar"/>
					<div :class="$style.selectedUserInfo">
						<MkUserName :user="selectedUser" :class="$style.selectedUserName"/>
						<MkAcct :user="selectedUser" :class="$style.selectedUserAcct"/>
						<div v-if="selectedUserEmail" :class="$style.selectedUserEmail"><i class="ti ti-mail"></i> {{ selectedUserEmail }}</div>
						<div v-else :class="$style.noEmail"><i class="ti ti-alert-triangle"></i> {{ i18n.ts.emailNoEmailWarning }}</div>
					</div>
				</div>
			</div>

			<MkInput v-model="sendSubject">
				<template #label>{{ i18n.ts.emailSubject }}</template>
				<template #prefix><i class="ti ti-text-caption"></i></template>
			</MkInput>

			<MkTextarea v-model="sendBody" :rows="10">
				<template #label>{{ i18n.ts.emailBody }}</template>
			</MkTextarea>
		</div>
	</div>

	<template #footer>
		<div :class="$style.footer">
			<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 16px;">
				<div v-if="tab === 'settings'" class="_buttons">
					<MkButton primary rounded @click="save"><i class="ti ti-check"></i> {{ i18n.ts.save }}</MkButton>
					<MkButton rounded @click="testEmail"><i class="ti ti-send"></i> {{ i18n.ts.testEmail }}</MkButton>
				</div>
				<div v-else-if="tab === 'send'" class="_buttons">
					<MkButton primary rounded @click="sendEmail" :disabled="!canSend"><i class="ti ti-send"></i> {{ i18n.ts.sendEmail }}</MkButton>
				</div>
			</div>
		</div>
	</template>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkSwitch from '@/components/MkSwitch.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkRadios from '@/components/MkRadios.vue';
import FormInfo from '@/components/MkInfo.vue';
import FormSplit from '@/components/form/split.vue';
import FormSection from '@/components/form/section.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance, instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkButton from '@/components/MkButton.vue';

const meta = await misskeyApi('admin/meta');

const tab = ref('settings');

// Settings tab
const enableEmail = ref(meta.enableEmail);
const email = ref(meta.email);
const smtpSecure = ref(meta.smtpSecure);
const smtpHost = ref(meta.smtpHost);
const smtpPort = ref(meta.smtpPort);
const smtpUser = ref(meta.smtpUser);
const smtpPass = ref(meta.smtpPass);

// Send tab
const recipientMode = ref<'direct' | 'user'>('direct');
const sendTo = ref('');
const sendSubject = ref('');
const sendBody = ref('');
const selectedUser = ref<Misskey.entities.UserDetailed | null>(null);
const selectedUserEmail = ref<string | null>(null);

const canSend = computed(() => {
	const hasRecipient = recipientMode.value === 'direct'
		? sendTo.value.trim() !== ''
		: selectedUser.value != null && selectedUserEmail.value != null;
	return hasRecipient && sendSubject.value.trim() !== '' && sendBody.value.trim() !== '';
});

async function pickUser() {
	const user = await os.selectUser({ localOnly: true, includeSelf: true });
	selectedUser.value = user;

	// Fetch user email from admin API
	try {
		const userDetail = await misskeyApi('admin/show-user', { userId: user.id });
		selectedUserEmail.value = (userDetail as any).email ?? null;
	} catch {
		selectedUserEmail.value = null;
	}
}

async function testEmail() {
	const { canceled, result: destination } = await os.inputText({
		title: 'To',
		type: 'email',
		default: instance.maintainerEmail ?? '',
		placeholder: 'test@example.com',
		minLength: 1,
	});
	if (canceled) return;
	os.apiWithDialog('admin/send-email', {
		to: destination,
		subject: 'Test email',
		text: 'Yo',
	});
}

async function sendEmail() {
	const recipient = recipientMode.value === 'direct' ? sendTo.value : selectedUserEmail.value;
	if (!recipient) return;

	const { canceled } = await os.confirm({
		type: 'info',
		text: i18n.ts.emailSendConfirm,
	});
	if (canceled) return;

	await os.apiWithDialog('admin/send-email', {
		to: recipient,
		subject: sendSubject.value,
		text: sendBody.value,
	});

	// Clear form after successful send
	sendTo.value = '';
	sendSubject.value = '';
	sendBody.value = '';
	selectedUser.value = null;
	selectedUserEmail.value = null;
}

function save() {
	os.apiWithDialog('admin/update-meta', {
		enableEmail: enableEmail.value,
		email: email.value,
		smtpSecure: smtpSecure.value,
		smtpHost: smtpHost.value,
		smtpPort: smtpPort.value,
		smtpUser: smtpUser.value,
		smtpPass: smtpPass.value,
	}).then(() => {
		fetchInstance(true);
	});
}

const headerTabs = computed(() => [{
	key: 'settings',
	title: i18n.ts.emailServerSettings,
	icon: 'ti ti-server',
}, {
	key: 'send',
	title: i18n.ts.sendEmail,
	icon: 'ti ti-send',
}]);

definePage(() => ({
	title: i18n.ts.email,
	icon: 'ti ti-mail',
}));
</script>

<style lang="scss" module>
.footer {
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
}

.selectedUser {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 16px;
	border-radius: 8px;
	background: var(--MI_THEME-panel);
}

.selectedUserAvatar {
	width: 48px;
	height: 48px;
	border-radius: 50%;
}

.selectedUserInfo {
	flex: 1;
	min-width: 0;
}

.selectedUserName {
	font-weight: bold;
	display: block;
}

.selectedUserAcct {
	opacity: 0.7;
	font-size: 0.9em;
	display: block;
}

.selectedUserEmail {
	margin-top: 4px;
	font-size: 0.9em;
	color: var(--MI_THEME-accent);
}

.noEmail {
	margin-top: 4px;
	font-size: 0.9em;
	color: var(--MI_THEME-warn);
}
</style>
