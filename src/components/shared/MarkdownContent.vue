<template>
	<div class="prose prose-invert max-w-none" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from "vue"
import { marked } from "marked"

const props = withDefaults(
	defineProps<{
		content?: string
	}>(),
	{
		content: "",
	},
)

const html = computed(() => marked.parse(props.content) as string)
</script>
