<template>
	<div class="space-y-6 pb-20">
		<div class="flex justify-between items-start flex-wrap gap-4">
			<div>
				<h2 class="text-2xl font-bold text-white mb-2">Event Scout</h2>
				<p class="text-gray-400">
					Source: <span class="text-brand-accent">AI Web Search</span>
					<span v-if="latestScan"> • Last scan {{ formatDate(latestScan.created_at) }}</span>
				</p>
			</div>
		</div>

		<Card class="p-5 space-y-4">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label class="text-xs uppercase text-gray-400">Zip</label>
					<input
						v-model="searchLocation"
						class="w-full glass-input mt-2"
						placeholder="Zip code"
					/>
				</div>
				<div>
					<label class="text-xs uppercase text-gray-400">Radius (miles)</label>
					<input
						v-model.number="radius"
						type="number"
						class="w-full glass-input mt-2"
						min="5"
						max="200"
					/>
				</div>
				<div class="flex items-end">
					<Button class="w-full" variant="primary" :disabled="isScanning" @click="runScan">
						<CheckCircle class="w-4 h-4 mr-2" /> Start Scan
					</Button>
				</div>
			</div>
			<div v-if="error" class="text-sm text-red-400">{{ error }}</div>
		</Card>

		<div v-if="isLoading" class="text-gray-400">Loading events...</div>
		<div v-else class="grid grid-cols-1 gap-4">
			<Card v-for="event in events" :key="event.id" class="p-5 space-y-3">
				<div class="flex justify-between items-start">
					<div>
						<h3 class="text-lg font-semibold text-white">{{ event.name }}</h3>
						<p class="text-xs text-gray-500">{{ event.event_date || "TBD" }} • {{ event.location || "Location TBD" }}</p>
					</div>
					<div class="text-xs" :class="getRelevanceClass(event.relevance_score)">
						{{ getRelevanceLabel(event.relevance_score) }}
					</div>
				</div>
				<p class="text-sm text-gray-400">{{ event.description }}</p>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2 text-xs text-gray-500">
						<MapPin class="w-3 h-3" /> {{ event.distance || "" }}
					</div>
					<div class="flex items-center gap-2">
						<Button size="sm" variant="ghost" @click="updateEventStatus(event.id, 'INTERESTED')">
							<CheckCircle class="w-4 h-4 mr-1" /> Interested
						</Button>
						<a v-if="event.source_url" :href="event.source_url" target="_blank" rel="noopener" class="text-xs text-brand-accent hover:underline">
							<LinkIcon class="w-3 h-3 inline-block mr-1" /> Source
						</a>
						<Button size="sm" variant="ghost" class="text-red-400" @click="deleteEvent(event.id)">
							<Trash2 class="w-4 h-4" />
						</Button>
					</div>
				</div>
			</Card>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue"
import { useRoute } from "vue-router"
import { useProjectQuerySync } from "@/composables/useProjectQuerySync"
import Button from "@/components/ui/Button.vue"
import Card from "@/components/ui/Card.vue"
import { CheckCircle, Link as LinkIcon, MapPin, Trash2 } from "lucide-vue-next"

interface Event {
	id: string
	name: string
	description: string
	event_date: string
	location: string
	distance: string
	source_url: string
	source_name: string
	relevance_score: number
	relevance_reasoning: string
	event_type: string
	status: string
}

interface Scan {
	id: string
	status: string
	total_events_found: number
	iteration_count: number
	created_at: number
	error_message?: string
}

useProjectQuerySync()

const route = useRoute()
const projectId = ref<string>(String(route.query.projectId || "1"))

const events = ref<Event[]>([])
const latestScan = ref<Scan | null>(null)
const isScanning = ref(false)
const isLoading = ref(true)
const error = ref<string | null>(null)
const searchLocation = ref("")
const radius = ref(50)

const fetchEvents = async () => {
	try {
		const res = await fetch(`/api/projects/${projectId.value}/events`)
		const data = await res.json()
		events.value = data.results || []
	} catch (err) {
		console.error("Failed to fetch events:", err)
	}
}

const fetchLatestScan = async () => {
	try {
		const res = await fetch(`/api/projects/${projectId.value}/event-scans`)
		const data = await res.json()
		if (data.results && data.results.length > 0) {
			latestScan.value = data.results[0]
			return data.results[0]
		}
	} catch (err) {
		console.error("Failed to fetch scans:", err)
	}
	return null
}

const pollForCompletion = async (scanId: string) => {
	const maxAttempts = 60
	let attempts = 0

	const poll = async () => {
		attempts++
		try {
			const res = await fetch(`/api/event-scans/${scanId}`)
			const data = await res.json()

			if (data.scan?.status === "COMPLETED") {
				isScanning.value = false
				latestScan.value = data.scan
				events.value = data.events || []
				return
			}

			if (data.scan?.status === "FAILED") {
				isScanning.value = false
				error.value = `Scan failed: ${data.scan.error_message || "Unknown error"}`
				return
			}

			if (attempts < maxAttempts) {
				setTimeout(poll, 5000)
			} else {
				isScanning.value = false
				error.value = "Scan timed out"
			}
		} catch (err) {
			if (attempts < maxAttempts) setTimeout(poll, 5000)
		}
	}

	poll()
}

const runScan = async () => {
	isScanning.value = true
	error.value = null

	try {
		const res = await fetch(`/api/projects/${projectId.value}/event-scans`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ radius: radius.value, location: searchLocation.value.trim() || undefined }),
		})

		if (!res.ok) {
			const data = await res.json()
			throw new Error(data.error || "Failed to start scan")
		}

		const data = await res.json()
		pollForCompletion(data.scanId)
	} catch (err: any) {
		isScanning.value = false
		error.value = err?.message || "Unknown error"
	}
}

const updateEventStatus = async (eventId: string, status: string) => {
	try {
		await fetch(`/api/events/${eventId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status }),
		})
		events.value = events.value.map((event) => (event.id === eventId ? { ...event, status } : event))
	} catch (err) {
		console.error("Failed to update event:", err)
	}
}

const deleteEvent = async (eventId: string) => {
	if (!confirm("Are you sure you want to delete this event?")) return
	try {
		await fetch(`/api/events/${eventId}`, { method: "DELETE" })
		events.value = events.value.filter((event) => event.id !== eventId)
	} catch (err) {
		console.error("Failed to delete event:", err)
	}
}

const getRelevanceClass = (score: number) => {
	if (score >= 80) return "text-green-400"
	if (score >= 60) return "text-yellow-400"
	return "text-gray-400"
}

const getRelevanceLabel = (score: number) => {
	if (score >= 80) return "High"
	if (score >= 60) return "Med"
	return "Low"
}

const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString()

onMounted(async () => {
	isLoading.value = true
	const scan = await fetchLatestScan()
	if (scan?.status === "RUNNING" || scan?.status === "PENDING") {
		isScanning.value = true
		pollForCompletion(scan.id)
	}
	await fetchEvents()
	isLoading.value = false
})

watch(
	() => route.query.projectId,
	(newValue) => {
		projectId.value = String(newValue || "1")
		fetchEvents()
		fetchLatestScan()
	},
)
</script>
