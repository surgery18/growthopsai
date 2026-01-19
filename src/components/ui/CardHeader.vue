<template>
	<div :class="classes" v-bind="headerAttrs">
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
return twMerge("flex flex-col space-y-1.5 pb-4", clsx(attrs.class))
})

const headerAttrs = computed(() => {
	const { class: _class, ...rest } = attrs
	return rest
})
</script>
