<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkFolder>
	<template #label>
		<b
			:class="{
				[$style.logGreen]: [
					'createRole',
					'addCustomEmoji',
					'createGlobalAnnouncement',
					'createUserAnnouncement',
					'createAd',
					'createInvitation',
					'createAvatarDecoration',
					'createSystemWebhook',
					'createAbuseReportNotificationRecipient',
					'approve',
					'unsilence',
					'unrestrict',
					'unsuspend',
					'approveChannel',
				].includes(log.type),
				[$style.logYellow]: [
					'markSensitiveDriveFile',
					'resetPassword',
					'suspendRemoteInstance',
					'updateNoteVisibility',
					'resetWarning',
					'silence',
					'restrict',
					'warn',
					'updateNoteBlind',
					'updateChannel',
					'transferChannelOwnership',
				].includes(log.type),
				[$style.logRed]: [
					'suspend',
					'deleteRole',
					'deleteGlobalAnnouncement',
					'deleteUserAnnouncement',
					'deleteCustomEmoji',
					'deleteNote',
					'deleteDriveFile',
					'deleteAd',
					'deleteAvatarDecoration',
					'deleteSystemWebhook',
					'deleteAbuseReportNotificationRecipient',
					'deleteAccount',
					'deletePage',
					'deleteFlash',
					'deleteGalleryPost',
					'deleteChatRoom',
					'decline',
					'deleteChannel',
				].includes(log.type)
			}"
		>{{ i18n.ts._moderationLogTypes[log.type] }}</b>
		<span v-if="log.type === 'updateUserNote'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'suspend'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'unsuspend'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'approve'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'decline'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'resetPassword'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'assignRole'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }} <i class="ti ti-arrow-right"></i> {{ log.info.roleName }}</span>
		<span v-else-if="log.type === 'unassignRole'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }} <i class="ti ti-equal-not"></i> {{ log.info.roleName }}</span>
		<span v-else-if="log.type === 'createRole'">: {{ log.info.role.name }}</span>
		<span v-else-if="log.type === 'updateRole'">: {{ log.info.before.name }}</span>
		<span v-else-if="log.type === 'deleteRole'">: {{ log.info.role.name }}</span>
		<span v-else-if="log.type === 'addCustomEmoji'">: {{ log.info.emoji.name }}</span>
		<span v-else-if="log.type === 'updateCustomEmoji'">: {{ log.info.before.name }}</span>
		<span v-else-if="log.type === 'deleteCustomEmoji'">: {{ log.info.emoji.name }}</span>
		<span v-else-if="log.type === 'markSensitiveDriveFile'">: @{{ log.info.fileUserUsername }}{{ log.info.fileUserHost ? '@' + log.info.fileUserHost : '' }}</span>
		<span v-else-if="log.type === 'unmarkSensitiveDriveFile'">: @{{ log.info.fileUserUsername }}{{ log.info.fileUserHost ? '@' + log.info.fileUserHost : '' }}</span>
		<span v-else-if="log.type === 'suspendRemoteInstance'">: {{ log.info.host }}</span>
		<span v-else-if="log.type === 'unsuspendRemoteInstance'">: {{ log.info.host }}</span>
		<span v-else-if="log.type === 'createGlobalAnnouncement'">: {{ log.info.announcement.title }}</span>
		<span v-else-if="log.type === 'updateGlobalAnnouncement'">: {{ log.info.before.title }}</span>
		<span v-else-if="log.type === 'deleteGlobalAnnouncement'">: {{ log.info.announcement.title }}</span>
		<span v-else-if="log.type === 'createUserAnnouncement'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'updateUserAnnouncement'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'deleteUserAnnouncement'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'updateNoteVisibility'">: @{{ log.info.noteUserUsername }}{{ log.info.noteUserHost ? '@' + log.info.noteUserHost : '' }}</span>
		<span v-else-if="log.type === 'deleteNote'">: @{{ log.info.noteUserUsername }}{{ log.info.noteUserHost ? '@' + log.info.noteUserHost : '' }}</span>
		<span v-else-if="log.type === 'deleteDriveFile'">: @{{ log.info.fileUserUsername }}{{ log.info.fileUserHost ? '@' + log.info.fileUserHost : '' }}</span>
		<span v-else-if="log.type === 'createAvatarDecoration'">: {{ log.info.avatarDecoration.name }}</span>
		<span v-else-if="log.type === 'updateAvatarDecoration'">: {{ log.info.before.name }}</span>
		<span v-else-if="log.type === 'deleteAvatarDecoration'">: {{ log.info.avatarDecoration.name }}</span>
		<span v-else-if="log.type === 'createSystemWebhook'">: {{ log.info.webhook.name }}</span>
		<span v-else-if="log.type === 'updateSystemWebhook'">: {{ log.info.before.name }}</span>
		<span v-else-if="log.type === 'deleteSystemWebhook'">: {{ log.info.webhook.name }}</span>
		<span v-else-if="log.type === 'createAbuseReportNotificationRecipient'">: {{ log.info.recipient.name }}</span>
		<span v-else-if="log.type === 'updateAbuseReportNotificationRecipient'">: {{ log.info.before.name }}</span>
		<span v-else-if="log.type === 'deleteAbuseReportNotificationRecipient'">: {{ log.info.recipient.name }}</span>
		<span v-else-if="log.type === 'deleteAccount'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'deletePage'">: @{{ log.info.pageUserUsername }}</span>
		<span v-else-if="log.type === 'deleteFlash'">: @{{ log.info.flashUserUsername }}</span>
		<span v-else-if="log.type === 'deleteGalleryPost'">: @{{ log.info.postUserUsername }}</span>
		<span v-else-if="log.type === 'deleteChatRoom'">: @{{ log.info.room.name }}</span>
		<span v-else-if="log.type === 'silence'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'unsilence'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'restrict'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'unrestrict'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'warn'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'updateNoteBlind'">: @{{ log.info.noteUserUsername }}{{ log.info.noteUserHost ? '@' + log.info.noteUserHost : '' }}</span>
		<span v-else-if="log.type === 'resetWarning'">: @{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</span>
		<span v-else-if="log.type === 'deleteChannel'">: {{ log.info.channelName }}</span>
		<span v-else-if="log.type === 'approveChannel'">: {{ log.info.channelName }}</span>
		<span v-else-if="log.type === 'updateChannel'">: {{ log.info.channelName }}</span>
		<span v-else-if="log.type === 'transferChannelOwnership'">: {{ log.info.channelId }}</span>
	</template>
	<template #icon>
		<i v-if="log.type === 'updateServerSettings'" class="ti ti-settings"></i>
		<i v-else-if="log.type === 'updateUserNote'" class="ti ti-pencil"></i>
		<i v-else-if="log.type === 'suspend'" class="ti ti-user-x"></i>
		<i v-else-if="log.type === 'unsuspend'" class="ti ti-user-check"></i>
		<i v-else-if="log.type === 'resetPassword'" class="ti ti-key"></i>
		<i v-else-if="log.type === 'assignRole'" class="ti ti-user-plus"></i>
		<i v-else-if="log.type === 'unassignRole'" class="ti ti-user-minus"></i>
		<i v-else-if="log.type === 'createRole'" class="ti ti-plus"></i>
		<i v-else-if="log.type === 'updateRole'" class="ti ti-pencil"></i>
		<i v-else-if="log.type === 'deleteRole'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'addCustomEmoji'" class="ti ti-plus"></i>
		<i v-else-if="log.type === 'updateCustomEmoji'" class="ti ti-pencil"></i>
		<i v-else-if="log.type === 'deleteCustomEmoji'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'markSensitiveDriveFile'" class="ti ti-eye-exclamation"></i>
		<i v-else-if="log.type === 'unmarkSensitiveDriveFile'" class="ti ti-eye"></i>
		<i v-else-if="log.type === 'suspendRemoteInstance'" class="ti ti-x"></i>
		<i v-else-if="log.type === 'unsuspendRemoteInstance'" class="ti ti-check"></i>
		<i v-else-if="log.type === 'createGlobalAnnouncement'" class="ti ti-plus"></i>
		<i v-else-if="log.type === 'updateGlobalAnnouncement'" class="ti ti-pencil"></i>
		<i v-else-if="log.type === 'deleteGlobalAnnouncement'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'createUserAnnouncement'" class="ti ti-plus"></i>
		<i v-else-if="log.type === 'updateUserAnnouncement'" class="ti ti-pencil"></i>
		<i v-else-if="log.type === 'deleteUserAnnouncement'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'updateNoteVisibility'" class="ti ti-eye"></i>
		<i v-else-if="log.type === 'deleteNote'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'deleteDriveFile'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'createAd'" class="ti ti-plus"></i>
		<i v-else-if="log.type === 'updateAd'" class="ti ti-pencil"></i>
		<i v-else-if="log.type === 'deleteAd'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'createAvatarDecoration'" class="ti ti-plus"></i>
		<i v-else-if="log.type === 'updateAvatarDecoration'" class="ti ti-pencil"></i>
		<i v-else-if="log.type === 'deleteAvatarDecoration'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'createSystemWebhook'" class="ti ti-plus"></i>
		<i v-else-if="log.type === 'updateSystemWebhook'" class="ti ti-pencil"></i>
		<i v-else-if="log.type === 'deleteSystemWebhook'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'createAbuseReportNotificationRecipient'" class="ti ti-plus"></i>
		<i v-else-if="log.type === 'updateAbuseReportNotificationRecipient'" class="ti ti-pencil"></i>
		<i v-else-if="log.type === 'deleteAbuseReportNotificationRecipient'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'deleteAccount'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'deletePage'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'deleteFlash'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'deleteGalleryPost'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'deleteChatRoom'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'resetWarning'" class="ti ti-alert-triangle-off"></i>
		<i v-else-if="log.type === 'silence'" class="ti ti-volume-off"></i>
		<i v-else-if="log.type === 'unsilence'" class="ti ti-volume"></i>
		<i v-else-if="log.type === 'restrict'" class="ti ti-lock"></i>
		<i v-else-if="log.type === 'unrestrict'" class="ti ti-lock-open"></i>
		<i v-else-if="log.type === 'warn'" class="ti ti-alert-triangle"></i>
		<i v-else-if="log.type === 'updateNoteBlind'" class="ti ti-eye-off"></i>
		<i v-else-if="log.type === 'deleteChannel'" class="ti ti-trash"></i>
		<i v-else-if="log.type === 'approveChannel'" class="ti ti-check"></i>
		<i v-else-if="log.type === 'updateChannel'" class="ti ti-pencil"></i>
		<i v-else-if="log.type === 'transferChannelOwnership'" class="ti ti-transfer"></i>
	</template>
	<template #suffix>
		<MkTime :time="log.createdAt"/>
	</template>

	<div>
		<div style="display: flex; gap: var(--MI-margin); flex-wrap: wrap;">
			<div style="flex: 1;">{{ i18n.ts.moderator }}: <MkA :to="`/admin/user/${log.userId}`" class="_link">@{{ log.user?.username }}</MkA></div>
			<div style="flex: 1;">{{ i18n.ts.dateAndTime }}: <MkTime :time="log.createdAt" mode="detail"/></div>
		</div>

		<template v-if="log.type === 'updateServerSettings'">
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="JSON5.stringify(log.info.before, null, '\t')" :newString="JSON5.stringify(log.info.after, null, '\t')" language="javascript" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateUserNote'">
			<div>{{ i18n.ts.user }}: {{ log.info.userId }}</div>
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="log.info.before ?? ''" :newString="log.info.after ?? ''" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateNoteVisibility'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.noteUserId}`" class="_link">@{{ log.info.noteUserUsername }}{{ log.info.noteUserHost ? '@' + log.info.noteUserHost : '' }}</MkA></div>
			<div>{{ i18n.ts.note }}: <MkA :to="`/notes/${log.info.noteId}`" class="_link">{{ log.info.noteId }}</MkA></div>
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="log.info.before" :newString="log.info.after" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateNoteBlind'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.noteUserId}`" class="_link">@{{ log.info.noteUserUsername }}{{ log.info.noteUserHost ? '@' + log.info.noteUserHost : '' }}</MkA></div>
			<div>{{ i18n.ts.note }}: <MkA :to="`/notes/${log.info.noteId}`" class="_link">{{ log.info.noteId }}</MkA></div>
			<div>{{ log.info.before ? 'blinded' : 'visible' }} → {{ log.info.after ? 'blinded' : 'visible' }}</div>
		</template>
		<template v-else-if="log.type === 'silence'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.userId}`" class="_link">@{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</MkA></div>
			<div>{{ i18n.ts.reason }}: {{ log.info.reason }}</div>
			<div v-if="log.info.expiresAt">{{ i18n.ts.period }}: {{ new Date(log.info.expiresAt).toLocaleString() }}</div>
		</template>
		<template v-else-if="log.type === 'unsilence'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.userId}`" class="_link">@{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</MkA></div>
		</template>
		<template v-else-if="log.type === 'restrict'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.userId}`" class="_link">@{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</MkA></div>
			<div>{{ i18n.ts.reason }}: {{ log.info.reason }}</div>
			<div v-if="log.info.expiresAt">{{ i18n.ts.period }}: {{ new Date(log.info.expiresAt).toLocaleString() }}</div>
		</template>
		<template v-else-if="log.type === 'unrestrict'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.userId}`" class="_link">@{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</MkA></div>
		</template>
		<template v-else-if="log.type === 'warn'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.userId}`" class="_link">@{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</MkA></div>
			<div>{{ i18n.ts.reason }}: {{ log.info.reason }}</div>
		</template>
		<template v-else-if="log.type === 'resetWarning'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.userId}`" class="_link">@{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</MkA></div>
			<div>{{ i18n.tsx.warningCount({ count: log.info.previousCount }) }}</div>
		</template>
		<template v-else-if="log.type === 'suspend'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.userId}`" class="_link">@{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</MkA></div>
			<div>{{ i18n.ts.reason }}: {{ log.info.reason }}</div>
		</template>
		<template v-else-if="log.type === 'unsuspend'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.userId}`" class="_link">@{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</MkA></div>
		</template>
		<template v-else-if="log.type === 'approve'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.userId}`" class="_link">@{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</MkA></div>
		</template>
		<template v-else-if="log.type === 'decline'">
			<div>{{ i18n.ts.user }}: <MkA :to="`/admin/user/${log.info.userId}`" class="_link">@{{ log.info.userUsername }}{{ log.info.userHost ? '@' + log.info.userHost : '' }}</MkA></div>
		</template>
		<template v-else-if="log.type === 'updateRole'">
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="JSON5.stringify(log.info.before, null, '\t')" :newString="JSON5.stringify(log.info.after, null, '\t')" language="javascript" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'assignRole'">
			<div>{{ i18n.ts.user }}: {{ log.info.userId }}</div>
			<div>{{ i18n.ts.role }}: {{ log.info.roleName }} [{{ log.info.roleId }}]</div>
		</template>
		<template v-else-if="log.type === 'unassignRole'">
			<div>{{ i18n.ts.user }}: {{ log.info.userId }}</div>
			<div>{{ i18n.ts.role }}: {{ log.info.roleName }} [{{ log.info.roleId }}]</div>
		</template>
		<template v-else-if="log.type === 'updateCustomEmoji'">
			<div>{{ i18n.ts.emoji }}: {{ log.info.emojiId }}</div>
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="JSON5.stringify(log.info.before, null, '\t')" :newString="JSON5.stringify(log.info.after, null, '\t')" language="javascript" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateAd'">
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="JSON5.stringify(log.info.before, null, '\t')" :newString="JSON5.stringify(log.info.after, null, '\t')" language="javascript" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateGlobalAnnouncement'">
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="JSON5.stringify(log.info.before, null, '\t')" :newString="JSON5.stringify(log.info.after, null, '\t')" language="javascript" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateUserAnnouncement'">
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="JSON5.stringify(log.info.before, null, '\t')" :newString="JSON5.stringify(log.info.after, null, '\t')" language="javascript" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateAvatarDecoration'">
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="JSON5.stringify(log.info.before, null, '\t')" :newString="JSON5.stringify(log.info.after, null, '\t')" language="javascript" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateRemoteInstanceNote'">
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="log.info.before ?? ''" :newString="log.info.after ?? ''" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateSystemWebhook'">
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="JSON5.stringify(log.info.before, null, '\t')" :newString="JSON5.stringify(log.info.after, null, '\t')" language="javascript" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateAbuseReportNotificationRecipient'">
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="JSON5.stringify(log.info.before, null, '\t')" :newString="JSON5.stringify(log.info.after, null, '\t')" language="javascript" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateAbuseReportNote'">
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="log.info.before ?? ''" :newString="log.info.after ?? ''" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'updateProxyAccountDescription'">
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="log.info.before ?? ''" :newString="log.info.after ?? ''" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'deleteChannel'">
			<div>{{ i18n.ts.channel }}: {{ log.info.channelName }} [{{ log.info.channelId }}]</div>
		</template>
		<template v-else-if="log.type === 'approveChannel'">
			<div>{{ i18n.ts.channel }}: {{ log.info.channelName }} [{{ log.info.channelId }}]</div>
		</template>
		<template v-else-if="log.type === 'updateChannel'">
			<div>{{ i18n.ts.channel }}: {{ log.info.channelName }} [{{ log.info.channelId }}]</div>
			<div :class="$style.diff">
				<CodeDiff :context="5" :hideHeader="true" :oldString="JSON5.stringify(log.info.before, null, '\t')" :newString="JSON5.stringify(log.info.after, null, '\t')" language="javascript" maxHeight="300px"/>
			</div>
		</template>
		<template v-else-if="log.type === 'transferChannelOwnership'">
			<div>{{ i18n.ts.channel }}: {{ log.info.channelId }}</div>
			<div>New Owner: {{ log.info.newOwnerId }}</div>
		</template>

		<details>
			<summary>raw</summary>
			<pre>{{ JSON5.stringify(log, null, '\t') }}</pre>
		</details>
	</div>
</MkFolder>
</template>

<script lang="ts" setup>
import * as Misskey from 'cherrypick-js';
import { CodeDiff } from 'v-code-diff';
import JSON5 from 'json5';
import { i18n } from '@/i18n.js';
import MkFolder from '@/components/MkFolder.vue';

const props = defineProps<{
	log: Misskey.entities.ModerationLog;
}>();
</script>

<style lang="scss" module>
.diff {
	background: #fff;
	color: #000;
	border-radius: 6px;
	overflow: clip;
}

.logYellow {
	color: var(--MI_THEME-warn);
}

.logRed {
	color: var(--MI_THEME-error);
}

.logGreen {
	color: var(--MI_THEME-success);
}
</style>
