<template>
	<h3 :class="classes" v-bind="titleAttrs">
		<slot />
	</h3>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()

const classes = computed(() => {
return twMerge("font-semibold leading-none tracking-tight", clsx(attrs.class))
})

const titleAttrs = computed(() => {
	const { class: _class, ...rest } = attrs
	return rest
})
</script>
