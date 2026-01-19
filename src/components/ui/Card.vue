<template>
	<div :class="classes" v-bind="cardAttrs">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

defineOptions({ inheritAttrs: false })

type Variant = "default" | "glass"

const props = withDefaults(
	defineProps<{
		variant?: Variant
	}>(),
	{
		variant: "glass",
	},
)

const attrs = useAttrs()

const classes = computed(() => {
	const base =
		props.variant === "glass"
			? "glass-card"
			: "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl"
return twMerge(base, "p-6", clsx(attrs.class))
})

const cardAttrs = computed(() => {
	const { class: _class, ...rest } = attrs
	return rest
})
</script>
