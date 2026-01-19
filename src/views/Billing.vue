<template>
	<div class="space-y-6 pb-20">
		<div class="max-w-4xl mx-auto bg-white text-gray-900 rounded-lg shadow-2xl overflow-hidden">
			<div class="p-8 border-b border-gray-200">
				<div class="flex flex-wrap justify-between items-center gap-6">
					<div>
						<h2 class="text-3xl font-bold text-gray-900">INVOICE</h2>
						<p class="text-gray-500 mt-1">GrowthOpsAI Inc.</p>
						<p class="text-xs text-gray-400 mt-2">Live usage snapshot</p>
					</div>
					<div class="text-right">
						<div class="text-sm text-gray-500">Invoice #: {{ invoiceNumber }}</div>
						<div class="text-sm text-gray-500">{{ asOfDate.toLocaleString() }}</div>
					</div>
				</div>
			</div>

			<div class="p-8">
				<div class="flex flex-wrap justify-between gap-6 mb-8">
					<div>
						<h4 class="font-bold text-xs uppercase text-gray-500 mb-2">Bill To</h4>
						<p class="font-bold">{{ billToLabel }}</p>
						<p class="text-sm text-gray-600">Owner Account</p>
					</div>
					<div class="text-right">
						<h4 class="font-bold text-xs uppercase text-gray-500 mb-2">Status</h4>
						<span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
							PAID (Owner)
						</span>
					</div>
				</div>

				<div
					v-if="state.error"
					class="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
				>
					{{ state.error }}
				</div>

				<table class="w-full text-sm mb-8">
					<thead class="bg-gray-50 text-gray-500 uppercase font-mono text-xs">
						<tr>
							<th class="py-3 px-4 text-left">Description</th>
							<th class="py-3 px-4 text-center">Requests</th>
							<th class="py-3 px-4 text-right">Input Tokens</th>
							<th class="py-3 px-4 text-right">Output Tokens</th>
							<th class="py-3 px-4 text-right">Amount</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						<tr v-if="state.lineItems.length === 0">
							<td colspan="5" class="py-6 px-4 text-center text-gray-400">
								No usage recorded yet.
							</td>
						</tr>
						<tr v-for="item in state.lineItems" :key="`${item.model}-${item.operation}`">
							<td class="py-3 px-4">
								<div class="font-medium text-gray-900">{{ modelLabel(item.model) }}</div>
								<div class="text-xs text-gray-500 uppercase tracking-wide">
									{{ item.operation }}
								</div>
							</td>
							<td class="py-3 px-4 text-center font-mono">{{ formatNumber(item.requestCount) }}</td>
							<td class="py-3 px-4 text-right font-mono">{{ formatNumber(item.inputTokens) }}</td>
							<td class="py-3 px-4 text-right font-mono">{{ formatNumber(item.outputTokens) }}</td>
							<td class="py-3 px-4 text-right font-mono">{{ formatCurrency(item.totalCost) }}</td>
						</tr>
					</tbody>
				</table>

				<div class="flex flex-col sm:flex-row justify-end gap-6">
					<div class="w-full sm:w-72 space-y-3">
						<div class="flex justify-between text-sm">
							<span class="text-gray-500">Subtotal</span>
							<span class="font-mono">{{ formatCurrency(state.totals.totalCost || 0) }}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-gray-500">Discount</span>
							<span class="font-mono">-{{ formatCurrency(state.totals.totalCost || 0) }}</span>
						</div>
						<div class="h-px bg-gray-200" />
						<div class="flex justify-between text-lg font-bold">
							<span>Total Due</span>
							<span class="font-mono">$0.00</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from "vue"
import { useRoute } from "vue-router"
import { useProjectQuerySync } from "@/composables/useProjectQuerySync"

useProjectQuerySync()

const route = useRoute()

const MODEL_LABELS: Record<string, string> = {
	"gemini-flash-lite-latest": "Gemini Flash Lite",
	"text-embedding-004": "Text Embedding 004",
}

const state = reactive({
	projectId: null as string | null,
	project: null as any,
	totals: {
		requestCount: 0,
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		totalCost: 0,
		firstEvent: null as string | null,
		lastEvent: null as string | null,
	},
	lineItems: [] as any[],
	error: null as string | null,
})

const formatCurrency = (value: number) =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 6,
	}).format(value)

const formatNumber = (value: number) =>
	new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)

const modelLabel = (model: string) => MODEL_LABELS[model] || model

const asOfDate = computed(() =>
	state.totals.lastEvent ? new Date(state.totals.lastEvent) : new Date(),
)

const invoiceNumber = computed(() => {
	if (!state.totals.lastEvent) return "INV-LIVE"
	const date = asOfDate.value
	return `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`
})

const billToLabel = computed(() => {
	if (state.project?.name) return state.project.name
	if (state.projectId) return `Project ${state.projectId}`
	return "All Projects"
})

const fetchUsage = async () => {
	const projectId = (route.query.projectId as string | undefined) || null
	state.projectId = projectId

	const apiUrl = new URL("/api/billing/usage", window.location.origin)
	if (projectId) apiUrl.searchParams.set("projectId", projectId)

	try {
		const response = await fetch(apiUrl.toString(), {
			headers: { "x-org-id": "demo-org" },
		})
		if (!response.ok) {
			throw new Error("Failed to load usage data")
		}
		const data = (await response.json()) as typeof state
		state.projectId = data.projectId
		state.project = data.project
		state.totals = data.totals
		state.lineItems = data.lineItems
		state.error = data.error
	} catch (error) {
		state.project = null
		state.totals = {
			requestCount: 0,
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			totalCost: 0,
			firstEvent: null,
			lastEvent: null,
		}
		state.lineItems = []
		state.error = "Failed to load usage data"
	}
}

let refreshTimer: number | undefined

onMounted(() => {
	fetchUsage()
	refreshTimer = window.setInterval(() => {
		if (document.visibilityState === "visible") {
			fetchUsage()
		}
	}, 10000)
})

watch(
	() => route.query.projectId,
	() => fetchUsage(),
)

onBeforeUnmount(() => {
	if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>
