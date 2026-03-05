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
			<MkInput v-model="sendTo" type="email">
				<template #label>{{ i18n.ts.emailRecipient }}</template>
				<template #prefix><i class="ti ti-mail"></i></template>
			</MkInput>

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
import MkSwitch from '@/components/MkSwitch.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
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
const sendTo = ref('');
const sendSubject = ref('');
const sendBody = ref('');

const canSend = computed(() => {
	return sendTo.value.trim() !== '' && sendSubject.value.trim() !== '' && sendBody.value.trim() !== '';
});

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
	const { canceled } = await os.confirm({
		type: 'info',
		text: i18n.ts.emailSendConfirm,
	});
	if (canceled) return;

	await os.apiWithDialog('admin/send-email', {
		to: sendTo.value,
		subject: sendSubject.value,
		text: sendBody.value,
	});

	// Clear form after successful send
	sendTo.value = '';
	sendSubject.value = '';
	sendBody.value = '';
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
</style>
