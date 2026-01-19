<template>
	<div :class="classes" v-bind="contentAttrs">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()

const classes = computed(() => {
return twMerge("pt-0", clsx(attrs.class))
})

const contentAttrs = computed(() => {
	const { class: _class, ...rest } = attrs
	return rest
})
</script>
