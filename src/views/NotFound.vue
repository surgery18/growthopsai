<template>
	<div class="flex flex-col items-center justify-center h-[60vh] text-center">
		<h2 class="text-2xl font-bold text-white mb-3">Page Not Found</h2>
		<p class="text-gray-400 mb-6 max-w-md">That route doesn't exist. Head back to the dashboard.</p>
		<RouterLink to="/" class="glass-btn">Go Home</RouterLink>
	</div>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router"
</script>
