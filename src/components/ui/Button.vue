<template>
	<button :class="classes" v-bind="buttonAttrs">
		<slot />
	</button>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

defineOptions({ inheritAttrs: false })

type Variant = "primary" | "secondary" | "glass" | "ghost" | "danger"

type Size = "sm" | "md" | "lg" | "icon"

const props = withDefaults(
	defineProps<{
		variant?: Variant
		size?: Size
	}>(),
	{
		variant: "primary",
		size: "md",
	},
)

const attrs = useAttrs()

const classes = computed(() => {
	const base =
		"inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
	const variants: Record<Variant, string> = {
		primary: "bg-brand-primary text-white hover:bg-blue-600 shadow-sm",
		secondary:
			"bg-white/10 text-white hover:bg-white/20 border border-white/10",
		glass: "glass-btn text-white",
		ghost: "hover:bg-white/10 text-gray-300 hover:text-white",
		danger:
			"bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20",
	}
	const sizes: Record<Size, string> = {
		sm: "h-8 px-3 text-xs",
		md: "h-10 px-4 py-2",
		lg: "h-12 px-8 text-lg",
		icon: "h-10 w-10",
	}

return twMerge(base, variants[props.variant], sizes[props.size], clsx(attrs.class))
})

const buttonAttrs = computed(() => {
	const { class: _class, ...rest } = attrs
	return rest
})
</script>
