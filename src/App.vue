<template>
	<RouterView />
	<Toaster rich-colors close-button />
</template>

<script setup lang="ts">
import { RouterView } from "vue-router"
import { Toaster } from "vue-sonner"
</script>
