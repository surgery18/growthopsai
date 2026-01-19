<template>
	<div :class="classes" v-bind="avatarAttrs">
		<img
			v-if="src"
			class="aspect-square h-full w-full object-cover"
			:src="src"
			:alt="fallback"
		/>
		<span v-else>{{ fallback }}</span>
	</div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

defineOptions({ inheritAttrs: false })

const props = defineProps<{
	src?: string
	fallback: string
}>()

const attrs = useAttrs()

const classes = computed(() => {
	return twMerge(
		"relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10 items-center justify-center text-sm font-medium text-white border border-white/10",
		clsx(attrs.class),
	)
})

const avatarAttrs = computed(() => {
	const { class: _class, ...rest } = attrs
	return rest
})
</script>
