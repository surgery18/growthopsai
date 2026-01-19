<template>
	<div class="flex h-screen flex-col bg-[#0a0a0f] text-slate-200 font-sans overflow-hidden">
		<header class="flex items-center justify-between border-b border-white/5 bg-black/20 px-6 py-4 backdrop-blur-md shrink-0">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-purple-600 shadow-lg shadow-brand-primary/20">
					<Bot class="h-6 w-6 text-white" />
				</div>
				<div>
					<h1 class="text-lg font-bold text-white tracking-wide">{{ currentCampaignName }}</h1>
					<div class="flex items-center gap-2">
						<span class="relative flex h-2 w-2">
							<span
								:class="[
									'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
									isLocked ? 'bg-red-400' : 'bg-emerald-400',
								]"
							></span>
							<span
								:class="[
									'relative inline-flex h-2 w-2 rounded-full',
									isLocked ? 'bg-red-500' : 'bg-emerald-500',
								]"
							></span>
						</span>
						<span :class="['text-xs font-medium', isLocked ? 'text-red-500' : 'text-emerald-500']">
							{{ isLocked ? "Campaign Locked" : "Elena Online" }}
						</span>
					</div>
				</div>
			</div>
		</header>

		<div class="flex-1 flex gap-6 p-6 overflow-hidden">
			<div class="w-64 flex flex-col gap-2 shrink-0">
				<div class="flex items-center justify-between mb-2">
					<h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Campaigns</h2>
					<Button size="sm" variant="ghost" @click="handleCreateCampaign">+</Button>
				</div>

				<button
					v-for="campaign in campaigns"
					:key="campaign.id"
					class="text-left px-4 py-3 rounded-lg text-sm font-medium transition-all border relative"
					:class="
						selectedDoId === campaign.do_id
							? 'bg-brand-primary/10 border-brand-primary/50 text-white shadow-md shadow-brand-primary/20'
							: 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5 hover:text-gray-200'
					"
					@click="switchToCampaign(campaign.do_id)"
				>
					<div class="flex justify-between items-center">
						<span class="font-bold truncate pr-4">{{ campaign.name }}</span>
						<div v-if="isCampaignLocked(campaign.status)" class="h-2 w-2 rounded-full bg-red-500" title="Locked"></div>
					</div>
					<div class="text-xs opacity-70 mt-1 flex justify-between">
						{{ new Date(campaign.created_at).toLocaleDateString() }}
						<span
							class="text-[10px] uppercase"
							:class="campaign.status === 'READY_TO_PUBLISH' ? 'text-green-400' : 'text-gray-500'"
						>
							{{ campaign.status?.replace(/_/g, " ") }}
						</span>
					</div>
				</button>

				<div v-if="campaigns.length === 0" class="text-sm text-gray-500 italic p-4 text-center border border-dashed border-gray-800 rounded">
					No campaigns yet. <br />Click + to start.
				</div>
			</div>

			<Card class="flex-1 flex flex-col p-0 overflow-hidden bg-black/20 border-white/10">
				<div
					:key="selectedDoId"
					ref="scrollRef"
					class="flex-1 overflow-y-auto p-6 space-y-6"
					@scroll="handleScroll"
				>
					<div v-if="parsedMessages.length === 0 && !isThinking" class="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
						<Bot class="h-16 w-16 mb-4" />
						<p>Select a project to start command loop.</p>
					</div>
					<div
						v-for="entry in parsedMessages"
						:key="entry.msg.timestamp"
						class="flex gap-4 max-w-3xl"
						:class="entry.msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''"
					>
						<Avatar
							:fallback="entry.msg.role === 'user' ? 'U' : 'AI'"
							:class="entry.msg.role === 'user' ? 'bg-brand-primary' : 'bg-purple-600'"
						/>
						<div
							class="p-4 rounded-2xl text-sm leading-relaxed"
							:class="
								entry.msg.role === 'user'
									? 'bg-brand-primary/20 text-white rounded-tr-none border border-brand-primary/20'
									: 'bg-white/5 text-gray-200 rounded-tl-none border border-white/5'
							"
						>
							<div v-if="entry.parsed.kind === 'assignments'" class="space-y-3 w-full">
								<p class="text-sm font-medium text-brand-primary">Internal Comms:</p>
								<div class="bg-black/20 border border-white/5 rounded-lg overflow-hidden text-[10px] text-gray-400">
									<div class="p-2 space-y-1">
										<div v-for="(job, idx) in entry.parsed.assignments" :key="idx" class="flex gap-2">
											<span class="text-brand-primary font-bold">@{{ job.agent }}:</span>
											<span>{{ job.task }}</span>
										</div>
									</div>
								</div>
								<MarkdownContent v-if="entry.parsed.reply" :content="entry.parsed.reply" />
							</div>
							<div v-else-if="entry.parsed.kind === 'posts'" class="space-y-4">
								<XPostPreview
									v-for="(post, idx) in entry.parsed.posts"
									:key="idx"
									:content="post.content"
									:id="idx"
									:day="post.day"
									:thread-index="idx"
									:thread-count="entry.parsed.posts.length"
								/>
							</div>
							<div v-else-if="entry.parsed.kind === 'integrated'" class="space-y-3 w-full animate-in zoom-in-95 duration-500">
								<div class="bg-black/40 border border-green-500/30 rounded-lg overflow-hidden">
									<div class="px-3 py-2 border-b border-green-500/10 bg-green-500/5 flex items-center gap-2">
										<CheckCircle class="w-3 h-3 text-green-500" />
										<span class="text-xs font-bold text-green-500 uppercase tracking-wider">Mission Complete</span>
									</div>
									<div class="p-4">
										<MarkdownContent :content="entry.parsed.integratedOutput" />
									</div>
								</div>
								<div class="text-xs text-gray-500 italic mt-2 text-center">Campaign Approved. Thread Locked.</div>
							</div>
							<div v-else-if="entry.parsed.kind === 'reply'">
								<MarkdownContent :content="entry.parsed.reply" />
								<XPostPreview
									v-if="entry.parsed.approvalRequest"
									:content="entry.parsed.approvalRequest.content"
									:id="entry.parsed.approvalRequest.id"
								/>
							</div>
							<div v-else-if="entry.parsed.kind === 'json'" class="text-xs overflow-auto text-gray-500 bg-black/20 p-2 rounded">
								<pre>{{ entry.parsed.raw }}</pre>
							</div>
							<div v-else>
								<MarkdownContent :content="entry.parsed.text" />
							</div>
							<div class="text-[10px] opacity-40 mt-2 text-right">
								{{ new Date(entry.msg.timestamp).toLocaleTimeString() }}
							</div>
						</div>
					</div>

					<div v-if="streamingContent" class="flex gap-4 max-w-3xl">
						<Avatar fallback="AI" class="bg-purple-600" />
						<div class="p-4 rounded-2xl bg-white/5 text-gray-200 rounded-tl-none border border-white/5">
							<MarkdownContent :content="extractReply(streamingContent) || '...'" />
						</div>
					</div>

					<div v-if="isThinking && !streamingContent" class="flex gap-4 max-w-3xl animate-pulse">
						<Avatar fallback="AI" class="bg-purple-600 opacity-50" />
						<div class="p-4 rounded-2xl bg-white/5 text-gray-400 rounded-tl-none border border-white/5 text-xs italic flex items-center gap-2">
							<span class="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></span>
							<span class="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
							<span class="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
							Elena is analyzing...
						</div>
					</div>
				</div>

				<div class="p-4 bg-white/5 border-t border-white/5 shrink-0">
					<div
						v-if="isLocked"
						class="flex flex-col items-center justify-center p-4 bg-red-950/20 border border-red-500/20 rounded-lg text-red-300"
					>
						<div class="flex items-center gap-2 mb-1">
							<CheckCircle class="h-5 w-5" />
							<span class="font-bold">Campaign Locked</span>
						</div>
						<p class="text-xs opacity-70">
							{{ lockedMessage }}<br />Please create a new campaign for a new request.
						</p>
					</div>
					<form v-else class="flex gap-4" @submit.prevent="handleSend">
						<input
							v-model="input"
							class="glass-input flex-1 p-3 rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-primary"
							:class="!selectedDoId ? 'opacity-50 cursor-not-allowed' : ''"
							:placeholder="selectedDoId ? 'Command your agents...' : 'Select a Campaign to Start Chatting'"
							:disabled="!selectedDoId"
							autocomplete="off"
						/>
						<Button type="submit" :disabled="!input.trim() || !selectedDoId" variant="primary">
							<Send class="w-4 h-4" />
						</Button>
					</form>
				</div>
			</Card>
		</div>

		<div
			v-if="showNewCampaignModal"
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
			@click="showNewCampaignModal = false"
		>
			<div
				class="bg-[#0a0a0f] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
				@click.stop
			>
				<div class="p-6 space-y-4">
					<div class="space-y-2">
						<h3 class="text-xl font-bold text-white">New Campaign</h3>
						<p class="text-sm text-gray-400">Enter a name for your new campaign to get started.</p>
					</div>
					<div class="space-y-2">
						<label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign Name</label>
						<input
							v-model="newCampaignName"
							class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
							placeholder="e.g., Q1 Marketing Push"
							@keydown.enter="submitNewCampaign"
							@keydown.escape="showNewCampaignModal = false"
							:disabled="isCreatingCampaign"
							autofocus
						/>
					</div>
					<div class="flex items-center justify-end gap-3 pt-2">
						<Button variant="ghost" :disabled="isCreatingCampaign" @click="showNewCampaignModal = false">
							Cancel
						</Button>
						<Button
							variant="primary"
							:disabled="!newCampaignName.trim() || isCreatingCampaign"
							@click="submitNewCampaign"
						>
							<Loader2 v-if="isCreatingCampaign" class="w-4 h-4 mr-2 animate-spin" />
							{{ isCreatingCampaign ? "Creating..." : "Create Campaign" }}
						</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { storeToRefs } from "pinia"
import { toast } from "vue-sonner"
import { useProjectQuerySync } from "@/composables/useProjectQuerySync"
import { useAppStore } from "@/stores/app"
import Card from "@/components/ui/Card.vue"
import Button from "@/components/ui/Button.vue"
import Avatar from "@/components/ui/Avatar.vue"
import MarkdownContent from "@/components/shared/MarkdownContent.vue"
import XPostPreview from "@/components/social/XPostPreview.vue"
import { Bot, CheckCircle, Loader2, Send } from "lucide-vue-next"

useProjectQuerySync()

interface Message {
	id?: number
	project_id?: number
	role: string
	content: string
	timestamp: number
}

interface Campaign {
	id: number
	name: string
	do_id: string
	status: string
	created_at: number
}

const route = useRoute()
const router = useRouter()
const { selectedProjectId } = storeToRefs(useAppStore())

const campaigns = ref<Campaign[]>([])
const doMessages = ref<Message[]>([])
const selectedDoId = ref<string | null>(null)
const currentCampaignName = ref("Select a Campaign")
const campaignPhase = ref<string | null>(null)

const input = ref("")
const optimisticUserMsg = ref<Message | null>(null)
const isThinking = ref(false)
const streamingContent = ref("")
const serverLocked = ref(false)

const showNewCampaignModal = ref(false)
const newCampaignName = ref("")
const isCreatingCampaign = ref(false)

const scrollRef = ref<HTMLDivElement | null>(null)
const isScrolledToBottom = ref(true)

const allMessages = computed(() => {
	const filtered = doMessages.value.filter(
		(message) => message.role !== "trace" && message.role !== "agent",
	)
	if (optimisticUserMsg.value) {
		const exists = filtered.some((m) => m.timestamp === optimisticUserMsg.value?.timestamp)
		if (!exists) filtered.push(optimisticUserMsg.value)
	}
	return [...filtered].sort((a, b) => a.timestamp - b.timestamp)
})

const parsedMessages = computed(() =>
	allMessages.value.map((msg) => ({ msg, parsed: parseMessage(msg) })),
)

const selectedCampaign = computed(() => campaigns.value.find((c) => c.do_id === selectedDoId.value))

const isLocked = computed(() => {
	const status = selectedCampaign.value?.status?.toUpperCase()
	return (
		serverLocked.value ||
		(!!status &&
			[
				"CLIENT_APPROVED",
				"READY_TO_PUBLISH",
				"PUBLISHING",
				"PUBLISHED",
				"COMPLETED",
				"CANCELLED",
				"CLIENT_VISIBLE",
			].includes(status))
	)
})

const lockedMessage = computed(() => {
	const status = selectedCampaign.value?.status?.toUpperCase()
	if (status === "CANCELLED") {
		return "This campaign is already closed because it was cancelled."
	}
	if (status === "PUBLISHED" || status === "COMPLETED") {
		return "This campaign is already closed because it has been approved and published."
	}
	if (status) {
		return "This campaign is already closed because it has been approved."
	}
	return "This campaign is already closed."
})

const handleScroll = (event: Event) => {
	const target = event.target as HTMLDivElement
	const bottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 100
	isScrolledToBottom.value = bottom
}

const extractReply = (text: string) => {
	const match = text.match(/"reply":\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/)
	if (match) {
		try {
			return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
		} catch {
			return match[1]
		}
	}
	const matchIntegrated = text.match(/"integrated_output":\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/)
	if (matchIntegrated) {
		try {
			return matchIntegrated[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
		} catch {
			return matchIntegrated[1]
		}
	}
	if (text.trim().startsWith("{") && !text.includes('"reply"') && !text.includes('"integrated_output"')) {
		return ""
	}
	return text
}

const parseMessage = (msg: Message) => {
	try {
		const data = JSON.parse(msg.content)
		if (data.assignments && Array.isArray(data.assignments) && data.assignments.length > 0) {
			return { kind: "assignments", assignments: data.assignments, reply: data.reply }
		}
		if (data.posts && Array.isArray(data.posts) && data.posts.length > 0) {
			return { kind: "posts", posts: data.posts }
		}
		if (data.integrated_output) {
			return { kind: "integrated", integratedOutput: data.integrated_output }
		}
		if (data.reply) {
			return { kind: "reply", reply: data.reply, approvalRequest: data.approval_request }
		}
		if (typeof data === "string") return { kind: "text", text: data }
		return { kind: "json", raw: JSON.stringify(data, null, 2) }
	} catch {
		return { kind: "text", text: msg.content }
	}
}

const isCampaignLocked = (status: string) =>
	["CLIENT_APPROVED", "READY_TO_PUBLISH", "PUBLISHING", "PUBLISHED", "COMPLETED", "CANCELLED", "CLIENT_VISIBLE"].includes(
		status?.toUpperCase?.() || status,
	)

const fetchCampaigns = async () => {
	const projectId = route.query.projectId as string | undefined
	if (!projectId) {
		campaigns.value = []
		return
	}

	const campUrl = new URL("/api/chat/campaigns", window.location.origin)
	campUrl.searchParams.set("projectId", projectId)

	try {
		const response = await fetch(campUrl.toString())
		if (!response.ok) return
		campaigns.value = (await response.json()).campaigns
	} catch (error) {
		console.error("Chat campaign fetch error", error)
	}

	if (!selectedDoId.value && campaigns.value.length > 0) {
		selectedDoId.value = campaigns.value[0].do_id
		switchToCampaign(selectedDoId.value)
	}
}

const fetchMessages = async () => {
	if (!selectedDoId.value) {
		doMessages.value = []
		currentCampaignName.value = "Select a Campaign"
		campaignPhase.value = null
		return
	}

	const campaign = campaigns.value.find((c) => c.do_id === selectedDoId.value)
	if (campaign) currentCampaignName.value = campaign.name

	const histUrl = new URL("/api/chat/history", window.location.origin)
	histUrl.searchParams.set("campaignId", selectedDoId.value)

	try {
		const response = await fetch(histUrl.toString())
		if (!response.ok) return
		const data = (await response.json()) as any
		doMessages.value = data.messages || []
		campaignPhase.value = data.campaignPhase || null
		await fetchCampaigns()
	} catch (error) {
		console.error("Chat history fetch error", error)
	}
}

const switchToCampaign = (id: string) => {
	if (!selectedProjectId.value) return
	router.replace({
		path: "/chat",
		query: { projectId: selectedProjectId.value, campaignId: id },
	})
}

const handleSend = async () => {
	if (!input.value.trim() || !selectedDoId.value) return
	if (isLocked.value) {
		toast.error(lockedMessage.value)
		return
	}

	const content = input.value
	const timestamp = Date.now()

	optimisticUserMsg.value = { role: "user", content, timestamp }
	isThinking.value = true
	streamingContent.value = ""
	input.value = ""

	const formData = new FormData()
	formData.append("campaignId", selectedDoId.value)
	formData.append("content", content)
	formData.append("role", "user")
	formData.append("timestamp", timestamp.toString())

	try {
		const response = await fetch("/api/chat", { method: "POST", body: formData })
		let resJson: { error?: string } | null = null
		try {
			resJson = (await response.json()) as { error?: string }
		} catch {
			resJson = null
		}

		if (!response.ok) {
			optimisticUserMsg.value = null
			isThinking.value = false
			if (response.status === 409) {
				serverLocked.value = true
			}
			toast.error(resJson?.error || "Campaign is already closed.")
			return
		}

		await fetchMessages()
		isThinking.value = false
	} catch (error) {
		console.error("Failed to send", error)
		isThinking.value = false
	}
}

const handleCreateCampaign = () => {
	if (!selectedProjectId.value) {
		alert("Please select a project first.")
		return
	}
	newCampaignName.value = ""
	showNewCampaignModal.value = true
}

const submitNewCampaign = async () => {
	if (!newCampaignName.value.trim() || !selectedProjectId.value || isCreatingCampaign.value) return

	isCreatingCampaign.value = true
	const campaignName = newCampaignName.value.trim()

	const form = new FormData()
	form.append("name", campaignName)
	form.append("projectId", String(selectedProjectId.value))

	try {
		const res = await fetch("/api/campaigns", { method: "POST", body: form })
		if (!res.ok) {
			throw new Error("Campaign create failed")
		}
		const data = (await res.json()) as { do_id?: string }
		if (data && data.do_id) {
			await fetchCampaigns()
			showNewCampaignModal.value = false
			newCampaignName.value = ""
			currentCampaignName.value = campaignName
			switchToCampaign(data.do_id)
		}
	} catch (error) {
		console.error("Failed to create campaign", error)
	} finally {
		isCreatingCampaign.value = false
	}
}

watch(
	() => route.query.projectId,
	() => {
		fetchCampaigns()
	},
	{ immediate: true },
)

watch(
	() => route.query.campaignId,
	(newId) => {
		selectedDoId.value = (newId as string | undefined) || null
		optimisticUserMsg.value = null
		isThinking.value = false
		streamingContent.value = ""
		input.value = ""
		serverLocked.value = false
		fetchMessages()
	},
	{ immediate: true },
)

watch([allMessages, isThinking, streamingContent], () => {
	if (scrollRef.value && isScrolledToBottom.value) {
		scrollRef.value.scrollTop = scrollRef.value.scrollHeight
	}
})

let pollTimer: number | undefined

onMounted(() => {
	pollTimer = window.setInterval(() => {
		if (document.visibilityState === "visible" && !isThinking.value) {
			fetchMessages()
		}
	}, 3000)
})

onBeforeUnmount(() => {
	if (pollTimer) window.clearInterval(pollTimer)
})
</script>
