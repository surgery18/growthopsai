<template>
	<div class="space-y-8 pb-20">
		<div v-if="selectedProjectId === null" class="view-section flex flex-col items-center justify-center h-[60vh] text-center">
			<div class="bg-brand-primary/10 p-6 rounded-full mb-6">
				<FolderOpen class="w-16 h-16 text-brand-primary" />
			</div>
			<h2 class="text-2xl font-bold text-white mb-3">No Project Selected</h2>
			<p class="text-gray-400 mb-6 max-w-md">
				Select an active project to view its brand bible, or complete an intake to generate brand data.
			</p>
			<RouterLink to="/projects">
				<Button class="px-6">
					<FolderOpen class="w-4 h-4 mr-2" />
					Go to Portfolio
				</Button>
			</RouterLink>
		</div>

		<div v-else class="grid grid-cols-1 md:grid-cols-2 gap-8">
			<div>
				<h3 class="font-bold text-white mb-4 flex items-center gap-2">
					<Fingerprint class="text-brand-accent h-5 w-5" /> Core Identity
				</h3>
				<Card class="p-6 space-y-4">
					<div>
						<label class="text-xs text-gray-500 uppercase font-bold">Brand Voice</label>
						<p class="text-gray-200 mt-1">{{ brandVoiceSummary || "No brand voice data yet." }}</p>
					</div>
					<div>
						<label class="text-xs text-gray-500 uppercase font-bold">Target Persona</label>
						<p class="text-gray-200 mt-1">{{ targetPersona || "No target persona captured yet." }}</p>
					</div>
					<div>
						<label class="text-xs text-gray-500 uppercase font-bold">Value Prop</label>
						<p class="text-gray-200 mt-1">{{ valueProp || "No value proposition defined yet." }}</p>
					</div>
				</Card>
			</div>

			<div>
				<h3 class="font-bold text-white mb-4 flex items-center gap-2">
					<TriangleAlert class="text-brand-accent h-5 w-5" /> Constraints
				</h3>
				<Card class="p-6 space-y-6">
					<div>
						<div class="flex items-center gap-2 mb-2">
							<div class="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center text-black font-bold text-[10px]">✓</div>
							<span class="font-bold text-white">DO SAY</span>
						</div>
						<div class="flex flex-wrap gap-2">
							<span
								v-for="word in doSay"
								:key="word"
								class="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/30 rounded text-xs"
							>
								{{ word }}
							</span>
							<span v-if="doSay.length === 0" class="text-xs text-gray-500">No approved phrases yet.</span>
						</div>
					</div>
					<div>
						<div class="flex items-center gap-2 mb-2">
							<div class="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-[10px]">✕</div>
							<span class="font-bold text-white">DO NOT SAY</span>
						</div>
						<div class="flex flex-wrap gap-2">
							<span
								v-for="word in doNotSay"
								:key="word"
								class="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-xs"
							>
								{{ word }}
							</span>
							<span v-if="doNotSay.length === 0" class="text-xs text-gray-500">No restricted phrases yet.</span>
						</div>
					</div>
				</Card>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRoute, RouterLink } from "vue-router"
import { storeToRefs } from "pinia"
import { useAppStore } from "@/stores/app"
import { useProjectQuerySync } from "@/composables/useProjectQuerySync"
import Card from "@/components/ui/Card.vue"
import Button from "@/components/ui/Button.vue"
import { Fingerprint, TriangleAlert, FolderOpen } from "lucide-vue-next"

useProjectQuerySync()

type BrandVoiceData = {
	personality?: Record<string, number>
	core_values?: string[]
	words_to_use?: string[]
	words_to_avoid?: string[]
	topics_focus?: string[]
}

type TargetAudienceData = {
	ideal_customer_description?: string
	demographics?: string
	geographic_focus?: string
}

const route = useRoute()
const { selectedProjectId } = storeToRefs(useAppStore())

const brandVoice = ref<BrandVoiceData | null>(null)
const targetAudience = ref<TargetAudienceData | null>(null)
const productDescription = ref<string | null>(null)

const parseJson = <T,>(value: string | null): T | null => {
	if (!value) return null
	try {
		return JSON.parse(value) as T
	} catch {
		return null
	}
}

const toStringOrNull = (value: unknown) => {
	if (typeof value !== "string") return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

const normalizeList = (value: unknown): string[] => {
	if (!value) return []
	if (Array.isArray(value)) {
		return value
			.map((item) => (typeof item === "string" ? item : ""))
			.map((item) => item.trim())
			.filter((item) => item.length > 0)
	}
	if (typeof value === "string") {
		return value
			.split(/\n|,|;|\|/)
			.map((item) => item.replace(/^\s*\d+[.)]\s*/, "").trim())
			.filter((item) => item.length > 0)
	}
	return []
}

const normalizeNumberMap = (value: Record<string, unknown> | undefined) => {
	if (!value) return undefined
	const entries = Object.entries(value)
	const numeric: Record<string, number> = {}
	for (const [key, val] of entries) {
		if (typeof val === "number" && Number.isFinite(val)) {
			numeric[key] = val
		}
	}
	return Object.keys(numeric).length > 0 ? numeric : undefined
}

const buildProductDescriptionFromIntake = (intakeData: Record<string, any>) => {
	const businessSummary = intakeData.business_summary || {}
	const offerFunnel = intakeData.offer_funnel || {}
	const parts: string[] = []
	const summary = toStringOrNull(businessSummary.short_description)
	if (summary) parts.push(`Summary: ${summary}`)
	const details = toStringOrNull(businessSummary.product_or_service_description)
	if (details) parts.push(`Details: ${details}`)
	const offer = toStringOrNull(offerFunnel.primary_offer)
	if (offer) parts.push(`Primary Offer: ${offer}`)
	const pricing = toStringOrNull(offerFunnel.pricing_range)
	if (pricing) parts.push(`Pricing: ${pricing}`)
	const cta = toStringOrNull(offerFunnel.primary_call_to_action)
	if (cta) parts.push(`Primary CTA: ${cta}`)
	const goal = toStringOrNull(businessSummary.primary_goal)
	if (goal) parts.push(`Primary Goal: ${goal}`)
	const geo = toStringOrNull(businessSummary.geographic_focus)
	if (geo) parts.push(`Geographic Focus: ${geo}`)
	return parts.length > 0 ? parts.join("\n") : null
}

const buildBrandVoiceFromIntake = (
	intakeData: Record<string, any>,
): BrandVoiceData => {
	const brandVoice = intakeData.brand_voice || {}
	const channels = intakeData.channels || {}
	return {
		personality: normalizeNumberMap(brandVoice) || undefined,
		core_values: normalizeList(brandVoice.brand_values),
		words_to_use: normalizeList(brandVoice.words_we_like),
		words_to_avoid: normalizeList(brandVoice.words_we_avoid),
		topics_focus: normalizeList(channels.topics_focus),
	}
}

const buildTargetAudienceFromIntake = (
	intakeData: Record<string, any>,
): TargetAudienceData => {
	const targetAudience = intakeData.target_audience || {}
	const businessSummary = intakeData.business_summary || {}
	return {
		ideal_customer_description: toStringOrNull(targetAudience.ideal_customer_description) || undefined,
		demographics: toStringOrNull(targetAudience.demographics) || undefined,
		geographic_focus: toStringOrNull(businessSummary.geographic_focus) || undefined,
	}
}

const getValueProp = (productDescriptionValue: string | null) => {
	if (!productDescriptionValue) return null
	const lines = productDescriptionValue
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
	const prefixes = ["Primary Offer:", "Summary:", "Details:", "Primary CTA:"]
	for (const prefix of prefixes) {
		const match = lines.find((line) => line.startsWith(prefix))
		if (match) return match.slice(prefix.length).trim()
	}
	return lines.join(" ")
}

const formatPersonality = (personality: Record<string, number>) => {
	const labels: Record<string, [string, string]> = {
		prof_casual: ["Professional", "Casual"],
		play_serious: ["Playful", "Serious"],
		bold_reserved: ["Bold", "Reserved"],
		tech_simple: ["Technical", "Simple"],
	}
	const formatted = Object.entries(personality)
		.map(([key, value]) => {
			const label = labels[key]
			if (!label) return null
			const [left, right] = label
			const leaning = value >= 50 ? left : right
			return `${leaning} ${Math.round(value)}`
		})
		.filter(Boolean)
	if (formatted.length > 0) return formatted.join(", ")
	return Object.entries(personality)
		.map(([key, value]) => `${key}: ${Math.round(value)}`)
		.join(", ")
}

const fetchBrand = async () => {
	const projectId = route.query.projectId as string | undefined
	if (!projectId) {
		brandVoice.value = null
		targetAudience.value = null
		productDescription.value = null
		return
	}

	const apiUrl = new URL("/api/brand/identity", window.location.origin)
	apiUrl.searchParams.set("projectId", projectId)

	try {
		const response = await fetch(apiUrl.toString())
		const data = (await response.json()) as any

		if (data.source === "knowledge") {
			brandVoice.value = data.brandVoice
			targetAudience.value = data.targetAudience
			productDescription.value = data.productDescription
			return
		}

		if (data.source === "intake") {
			const intakeData = data.data_json ? parseJson<Record<string, any>>(data.data_json) : null
			if (!intakeData) throw new Error("No intake data")
			brandVoice.value = buildBrandVoiceFromIntake(intakeData)
			targetAudience.value = buildTargetAudienceFromIntake(intakeData)
			productDescription.value = buildProductDescriptionFromIntake(intakeData)
		}
	} catch (error) {
		console.error("Brand loader error", error)
		brandVoice.value = null
		targetAudience.value = null
		productDescription.value = null
	}
}

const brandVoiceSummary = computed(() => {
	if (brandVoice.value?.core_values?.length) return brandVoice.value.core_values.join(", ")
	if (brandVoice.value?.words_to_use?.length) return brandVoice.value.words_to_use.join(", ")
	if (brandVoice.value?.personality) return formatPersonality(brandVoice.value.personality)
	return null
})

const targetPersona = computed(() => {
	return (
		targetAudience.value?.ideal_customer_description ||
		targetAudience.value?.demographics ||
		targetAudience.value?.geographic_focus ||
		null
	)
})

const valueProp = computed(() => getValueProp(productDescription.value))
const doSay = computed(() => brandVoice.value?.words_to_use || [])
const doNotSay = computed(() => brandVoice.value?.words_to_avoid || [])

onMounted(fetchBrand)

watch(
	() => route.query.projectId,
	() => {
		fetchBrand()
	},
)
</script>
