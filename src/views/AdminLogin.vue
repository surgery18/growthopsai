<template>
	<div
		class="flex h-screen items-center justify-center bg-[#0a0a0f] text-white">
		<div
			class="w-full max-w-md p-8 rounded-xl bg-white/5 border border-white/10 shadow-2xl">
			<h1 class="text-2xl font-bold mb-6 text-center">Admin Login</h1>

			<!-- Step 1: Email -->
			<form
				v-if="step === 1"
				@submit.prevent="handleSendCode"
				class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-400 mb-1"
						>Email Address</label
					>
					<input
						v-model="email"
						type="email"
						required
						class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-primary transition-colors"
						placeholder="admin@growthopsai.com"
						autofocus />
				</div>
				<button
					type="submit"
					class="w-full bg-brand-primary hover:bg-brand-primary/80 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center"
					:disabled="loading">
					<span v-if="loading">Sending Code...</span>
					<span v-else>Send Login Code</span>
				</button>
			</form>

			<!-- Step 2: Code -->
			<form v-else @submit.prevent="handleLogin" class="space-y-4">
				<div class="text-center text-sm text-gray-400 mb-4">
					Code sent to {{ email }}
					<button
						type="button"
						@click="step = 1"
						class="text-brand-primary hover:underline ml-1">
						Change
					</button>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-400 mb-1"
						>Verification Code</label
					>
					<input
						v-model="code"
						type="text"
						required
						class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-primary transition-colors text-center tracking-widest text-xl"
						placeholder="123456"
						autofocus />
				</div>
				<button
					type="submit"
					class="w-full bg-brand-primary hover:bg-brand-primary/80 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center"
					:disabled="loading">
					<span v-if="loading">Verifying...</span>
					<span v-else>Login</span>
				</button>
			</form>

			<p
				v-if="error"
				class="mt-4 text-center text-red-400 text-sm bg-red-500/10 py-2 rounded">
				{{ error }}
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref } from "vue"
	import { useRouter } from "vue-router"

	const router = useRouter()
	const step = ref(1)
	const email = ref("") // Default seed email not hardcoded here to allow testing others (which will fail)
	const code = ref("")
	const loading = ref(false)
	const error = ref("")

	const handleSendCode = async () => {
		if (!email.value) return

		loading.value = true
		error.value = ""

		try {
			const res = await fetch("/api/auth/send-code", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.value }),
			})

			const data = (await res.json()) as any

			if (res.ok) {
				step.value = 2
			} else {
				error.value = data.error || "Failed to send code"
			}
		} catch (e) {
			error.value = "Request failed"
		} finally {
			loading.value = false
		}
	}

	const handleLogin = async () => {
		if (!code.value) return

		loading.value = true
		error.value = ""

		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.value, code: code.value }),
			})

			const data = (await res.json()) as any

			if (res.ok) {
				router.push("/dashboard")
			} else {
				error.value = data.error || "Invalid code"
			}
		} catch (e) {
			error.value = "Login failed"
		} finally {
			loading.value = false
		}
	}
</script>
