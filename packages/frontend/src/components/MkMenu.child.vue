<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="el" :class="$style.root">
	<MkMenu :items="items" :align="align" :width="width" :asDrawer="false" @close="onChildClosed"/>
</div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, provide, useTemplateRef, watch } from 'vue';
import MkMenu from './MkMenu.vue';
import type { MenuItem } from '@/types/menu.js';

const props = defineProps<{
	items: MenuItem[];
	anchorElement: HTMLElement;
	rootElement: HTMLElement;
	width?: number;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
	(ev: 'actioned'): void;
}>();

provide('isNestingMenu', true);

const el = useTemplateRef('el');
const align = 'left';

const SCROLLBAR_THICKNESS = 16;

function setPosition() {
	if (el.value == null) return;
	const parentRect = props.anchorElement.getBoundingClientRect();
	const myRect = el.value.getBoundingClientRect();

	// デフォルト: アンカーの右隣
	let left = parentRect.right;
	let top = parentRect.top - 8;

	// 右端を超える場合は左側に表示
	if (left + myRect.width >= (window.innerWidth - SCROLLBAR_THICKNESS)) {
		left = parentRect.left - myRect.width;
	}

	// 下端を超える場合は上にずらす
	const maxTop = window.innerHeight - SCROLLBAR_THICKNESS - myRect.height;
	if (top > maxTop) {
		top = maxTop;
	}
	if (top < 0) {
		top = 0;
	}

	el.value.style.left = left + 'px';
	el.value.style.top = top + 'px';
}

function onChildClosed(actioned?: boolean) {
	if (actioned) {
		emit('actioned');
	} else {
		emit('closed');
	}
}

watch(() => props.anchorElement, () => {
	setPosition();
});

const ro = new ResizeObserver((entries, observer) => {
	setPosition();
});

function onScroll() {
	setPosition();
}

onMounted(() => {
	if (el.value) ro.observe(el.value);
	props.rootElement.addEventListener('scroll', onScroll, { passive: true });
	setPosition();
	nextTick(() => {
		setPosition();
	});
});

onUnmounted(() => {
	ro.disconnect();
	props.rootElement.removeEventListener('scroll', onScroll);
});

defineExpose({
	checkHit: (ev: MouseEvent) => {
		return (ev.target === el.value || el.value?.contains(ev.target as Node));
	},
});
</script>

<style lang="scss" module>
.root {
	position: fixed;
	max-height: calc(100dvh - 32px);
	overflow-y: auto;
	overscroll-behavior: contain;
}
</style>
