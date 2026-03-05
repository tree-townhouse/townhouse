<!--
SPDX-FileCopyrightText: noridev and cherrypick-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 700px;">
	<div class="_gaps">
		<MkPagination v-slot="{items}" :paginator="paginator">
			<div v-if="items.length === 0" class="_fullinfo">
				<div>{{ i18n.ts.noSanctionHistory }}</div>
			</div>
			<div v-else class="_gaps">
				<div v-for="item in items" :key="item.id" class="_panel" :class="$style.item">
					<div :class="$style.header">
						<span :class="$style.badge" :style="{ background: getBadgeColor(item.type) }">{{ getTypeLabel(item.type) }}</span>
						<span :class="$style.date"><MkTime :time="item.createdAt" mode="detail"/></span>
					</div>
					<div :class="$style.reason">
						<span :class="$style.reasonLabel">{{ i18n.ts.reason }}</span>
						<span>{{ item.reason ?? '-' }}</span>
					</div>
					<div v-if="item.expiresAt" :class="$style.expires">
						<span :class="$style.reasonLabel">{{ i18n.ts.expiration }}</span>
						<span><MkTime :time="item.expiresAt" mode="detail"/></span>
					</div>
				</div>
			</div>
		</MkPagination>
	</div>
</div>
</template>

<script lang="ts" setup>
import { markRaw } from 'vue';
import MkPagination from '@/components/MkPagination.vue';
import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';

const paginator = markRaw(new Paginator('i/sanctions', {
	limit: 20,
}));

function getTypeLabel(type: string): string {
	switch (type) {
		case 'warn': return i18n.ts.warn;
		case 'silence': return i18n.ts.silence;
		case 'restrict': return i18n.ts.restrict;
		case 'suspend': return i18n.ts.suspend;
		default: return type;
	}
}

function getBadgeColor(type: string): string {
	switch (type) {
		case 'warn': return 'var(--MI_THEME-warn)';
		case 'silence': return 'var(--MI_THEME-warn)';
		case 'restrict': return '#e67e22';
		case 'suspend': return 'var(--MI_THEME-error)';
		default: return 'var(--MI_THEME-accent)';
	}
}
</script>

<style lang="scss" module>
.item {
	padding: 16px;
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12px;
}

.badge {
	display: inline-block;
	padding: 2px 10px;
	border-radius: 4px;
	color: #fff;
	font-weight: bold;
	font-size: 90%;
}

.date {
	opacity: 0.7;
	font-size: 85%;
}

.reason {
	display: flex;
	gap: 8px;
	align-items: baseline;
	word-break: break-word;
}

.reasonLabel {
	flex-shrink: 0;
	font-weight: bold;
	opacity: 0.7;
}

.expires {
	display: flex;
	gap: 8px;
	align-items: baseline;
	margin-top: 8px;
	padding-top: 8px;
	border-top: solid 0.5px var(--MI_THEME-divider);
}
</style>
