<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker markerId="serverRules" :keywords="['rules']">
	<MkFolder>
		<template #icon><SearchIcon><i class="ti ti-checkbox"></i></SearchIcon></template>
		<template #label><SearchLabel>{{ i18n.ts.serverRules }}</SearchLabel></template>

		<div class="_gaps_m">
			<div><SearchText>{{ i18n.ts._serverRules.description }}</SearchText></div>

			<Sortable
				v-model="serverRulesEditable"
				class="_gaps_m"
				:itemKey="(_, i) => i"
				:animation="150"
				:handle="'.' + $style.itemHandle"
				@start="e => e.item.classList.add('active')"
				@end="e => e.item.classList.remove('active')"
			>
				<template #item="{element,index}">
					<div :class="$style.item">
						<div :class="$style.itemHeader">
							<div :class="$style.itemNumber" v-text="String(index + 1)"/>
							<span :class="$style.itemHandle"><i class="ti ti-menu"/></span>
							<button class="_button" :class="$style.itemRemove" @click="remove(index)"><i class="ti ti-x"></i></button>
						</div>
						<div :class="$style.itemInputs">
							<MkInput v-model="serverRulesEditable[index].name">
								<template #label>{{ i18n.ts.ruleName }}</template>
							</MkInput>
							<MkInput v-model="serverRulesEditable[index].url">
								<template #label>{{ i18n.ts.ruleUrl }}</template>
								<template #prefix><i class="ti ti-link"></i></template>
							</MkInput>
						</div>
					</div>
				</template>
			</Sortable>
			<div :class="$style.commands">
				<MkButton rounded @click="addRule"><i class="ti ti-plus"></i> {{ i18n.ts.add }}</MkButton>
				<MkButton primary rounded @click="save"><i class="ti ti-check"></i> {{ i18n.ts.save }}</MkButton>
			</div>
		</div>
	</MkFolder>
</SearchMarker>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, ref } from 'vue';
import * as os from '@/os.js';
import { fetchInstance, instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkFolder from '@/components/MkFolder.vue';

const Sortable = defineAsyncComponent(() => import('vuedraggable').then(x => x.default));

type RuleEntry = { name: string; url: string };

function parseRule(html: string): RuleEntry {
	const match = html.match(/href="([^"]*)"[^>]*>([^<]*)/);
	if (match) {
		return { name: match[2].trim(), url: match[1] };
	}
	return { name: html, url: '' };
}

function buildRule(entry: RuleEntry): string {
	if (entry.url) {
		return `<div><a href="${entry.url}" class="_link" target="_blank">${entry.name} <i class="ti ti-external-link"></i></a></div>`;
	}
	return entry.name;
}

const serverRulesEditable = ref<RuleEntry[]>(
	instance.serverRules.map(r => parseRule(r)),
);

const addRule = () => {
	serverRulesEditable.value.push({ name: '', url: '' });
};

const save = async () => {
	const rules = serverRulesEditable.value
		.filter(r => r.name.trim() !== '')
		.map(r => buildRule(r));
	await os.apiWithDialog('admin/update-meta', {
		serverRules: rules,
	});
	fetchInstance(true);
};

const remove = (index: number): void => {
	serverRulesEditable.value.splice(index, 1);
};
</script>

<style lang="scss" module>
.item {
	display: block;
	color: var(--MI_THEME-navFg);
}

.itemHeader {
	display: flex;
	margin-bottom: 8px;
	align-items: center;
}

.itemHandle {
	display: flex;
	width: 40px;
	height: 40px;
	align-items: center;
	justify-content: center;
	cursor: move;
}

.itemNumber {
	display: flex;
	background-color: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
	font-size: 14px;
	font-weight: bold;
	width: 28px;
	height: 28px;
	align-items: center;
	justify-content: center;
	border-radius: 999px;
	margin-right: 8px;
}

.itemEdit {
	width: 100%;
	max-width: 100%;
	min-width: 100%;
}

.itemInputs {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.itemRemove {
	width: 40px;
	height: 40px;
	color: var(--MI_THEME-error);
	margin-left: auto;
	border-radius: 6px;

	&:hover {
		background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));
	}
}

.commands {
	display: flex;
	gap: 16px;
}
</style>
