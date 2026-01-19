<template>
	<span :class="classes" v-bind="badgeAttrs">
		<slot />
	</span>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

defineOptions({ inheritAttrs: false })

type Variant = "default" | "success" | "warning" | "danger" | "info"

const props = withDefaults(
	defineProps<{
		variant?: Variant
	}>(),
	{
		variant: "default",
	},
)

const attrs = useAttrs()

const classes = computed(() => {
	const variants: Record<Variant, string> = {
		default: "bg-gray-500/10 text-gray-400 border-gray-500/20",
		success: "bg-green-500/10 text-green-400 border-green-500/20",
		warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
		danger: "bg-red-500/10 text-red-400 border-red-500/20",
		info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
	}
	return twMerge(
		"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
		variants[props.variant],
		clsx(attrs.class),
	)
})

const badgeAttrs = computed(() => {
	const { class: _class, ...rest } = attrs
	return rest
})
</script>
