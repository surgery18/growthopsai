<template>
	<div
		v-if="selectedProjectId === null"
		class="view-section flex flex-col items-center justify-center h-[60vh] text-center">
		<div class="bg-brand-primary/10 p-6 rounded-full mb-6">
			<FolderOpen class="w-16 h-16 text-brand-primary" />
		</div>
		<h2 class="text-2xl font-bold text-white mb-3">No Project Selected</h2>
		<p class="text-gray-400 mb-6 max-w-md">
			To use the dashboard and other project tools, you need to select an active
			project from the dropdown in the sidebar, or create and complete an intake
			for a new project.
		</p>
		<RouterLink to="/dashboard/projects">
			<Button class="px-6">
				<FolderOpen class="w-4 h-4 mr-2" />
				Go to Portfolio
			</Button>
		</RouterLink>
	</div>

	<div
		v-else
		id="view-dashboard"
		class="view-section grid grid-cols-12 gap-6 pb-20">
		<div class="col-span-12 mb-6 space-y-4">
			<Button
				variant="primary"
				size="lg"
				:disabled="isGenerating || hasRequestedToday"
				:class="[
					'w-full py-8 text-xl font-bold shadow-xl transition-all border-none',
					hasRequestedToday
						? 'bg-gray-600 shadow-none cursor-not-allowed'
						: 'shadow-brand-primary/20 hover:scale-[1.01] bg-gradient-to-r from-brand-primary to-purple-600',
				]"
				@click="handleRequestMaterial">
				<template v-if="isGenerating">
					<div
						class="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin mr-3" />
					Generating Daily Strategy...
				</template>
				<template v-else-if="hasRequestedToday">
					<Check class="w-6 h-6 mr-3" />
					Already Requested Today
				</template>
				<template v-else>
					<Palette class="w-6 h-6 mr-3" />
					Request Daily Material / Strategy
				</template>
			</Button>

			<div
				v-if="dailyStrategy"
				class="glass-panel p-6 rounded-xl border border-brand-primary/20 bg-brand-primary/5">
				<div class="flex items-center gap-3 mb-4 border-b border-white/10 pb-4">
					<div class="bg-brand-accent/20 p-2 rounded-lg">
						<ClipboardList class="w-5 h-5 text-brand-accent" />
					</div>
					<h3 class="text-xl font-bold text-white">Today's Strategy Plan</h3>
				</div>
				<div
					class="prose prose-invert max-w-none text-gray-300 text-sm max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
					<MarkdownContent :content="dailyStrategy" />
				</div>
			</div>
		</div>

		<div class="col-span-12">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold text-white">Active Agents</h2>
				<RouterLink
					to="/settings"
					class="text-xs text-brand-accent hover:text-white flex items-center">
					View Full Team <ArrowRight class="ml-1 w-3 h-3" />
				</RouterLink>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<div
					v-for="agent in renderedAgents"
					:key="agent.id"
					class="glass-panel p-4 rounded-xl border-l-2 relative overflow-hidden group"
					:class="[
						agent.borderColor,
						agent.status === 'idle' ? 'opacity-75' : '',
					]">
					<div
						class="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
						<component :is="agent.icon" class="w-8 h-8" :class="agent.color" />
					</div>
					<div class="flex items-center gap-3 mb-2">
						<div
							class="w-2 h-2 rounded-full"
							:class="[
								agent.bgPulse,
								agent.status === 'active' ? 'animate-pulse' : '',
							]"></div>
						<h3
							class="font-bold"
							:class="
								agent.status === 'idle' ? 'text-gray-400' : 'text-gray-200'
							">
							{{ agent.name }}
						</h3>
					</div>
					<p
						class="text-xs h-8 line-clamp-2"
						:class="
							agent.status === 'idle' ? 'text-gray-500' : 'text-gray-400'
						">
						{{ agent.activity }}
					</p>
					<div
						v-if="agent.status !== 'idle'"
						class="mt-2 w-full bg-gray-800 rounded-full h-1">
						<div
							class="h-1 rounded-full"
							:class="[
								agent.progressColor,
								agent.animateBar ? 'animate-pulse' : '',
							]"
							:style="{ width: `${agent.progress}%` }"></div>
					</div>
				</div>
			</div>
		</div>

		<div class="col-span-12 lg:col-span-8">
			<div class="glass-panel rounded-xl flex flex-col h-full">
				<div
					class="p-5 border-b border-white/10 flex justify-between items-center">
					<div class="flex items-center gap-2">
						<h2 class="text-lg font-bold text-white">Approval Queue</h2>
						<span
							class="bg-brand-primary/20 text-brand-accent text-xs px-2 py-0.5 rounded border border-brand-primary/30">
							Standard Lane
						</span>
					</div>
					<div class="flex gap-2 items-center">
						<button
							v-if="approvalItem"
							class="text-xs text-brand-accent hover:text-red-400 flex items-center gap-1"
							@click="cancelMode = !cancelMode">
							{{ cancelMode ? "Cancel Trash" : "Trash" }}
						</button>
						<RouterLink
							to="/approvals"
							class="text-xs text-brand-accent hover:text-white">
							View All ({{ approvals.length }})
						</RouterLink>
					</div>
				</div>

				<div v-if="approvalItem" class="p-6">
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-xs font-mono text-gray-500 uppercase"
								>Context:</span
							>
							<span class="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded"
								>Campaign: Product Launch</span
							>
							<span class="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded"
								>Platform: {{ approvalItem.platform }}</span
							>
						</div>
						<div
							v-if="cancelMode"
							class="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
							<span class="text-xs text-red-400 font-bold uppercase"
								>End Campaign?</span
							>
							<button
								class="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
								@click="handleCancel(approvalItem.campaign_id)">
								Confirm Kill
							</button>
						</div>
					</div>

					<div class="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
						<div class="flex gap-4">
							<div
								class="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center">
								<span class="text-xs font-bold text-white">GV</span>
							</div>
							<div class="flex-1">
								<div class="flex items-center gap-2 mb-1">
									<span class="font-bold text-white">Grub Vision</span>
									<span class="text-gray-500 text-xs">@GrubVision • Draft</span>
								</div>
								<div
									v-if="approvalPreview.previewPosts.length"
									class="space-y-4">
									<div
										v-if="approvalPreview.strategyText"
										class="text-sm text-gray-400 bg-black/50 p-2 rounded mb-4">
										<MarkdownContent :content="approvalPreview.strategyText" />
									</div>
									<XPostPreview
										v-for="(post, idx) in approvalPreview.previewPosts"
										:key="idx"
										:content="post.content"
										:id="idx"
										:hide-actions="true"
										:day="post.day || 1"
										:thread-index="idx"
										:thread-count="approvalPreview.previewPosts.length" />
								</div>
								<div
									v-else
									class="text-gray-300 text-base leading-relaxed mb-4">
									<MarkdownContent :content="approvalItem.content" />
								</div>
							</div>
						</div>
					</div>

					<div
						v-if="rejectMode"
						class="bg-white/5 p-4 rounded-lg border border-white/10 animate-in fade-in zoom-in-95">
						<div class="space-y-4">
							<div>
								<label class="text-xs text-gray-400 font-medium ml-1 block mb-1"
									>Reason for Revision</label
								>
								<div class="relative">
									<select
										class="w-full bg-black/40 border border-white/20 text-gray-200 text-sm rounded-md h-10 px-3 pr-8 appearance-none focus:ring-2 focus:ring-brand-primary outline-none"
										v-model="rejectReason">
										<option>Brand Guidelines Violation</option>
										<option>Tone Mismatch</option>
										<option>Factual Error</option>
										<option>Compliance Risk</option>
										<option>Other</option>
									</select>
								</div>
							</div>
							<textarea
								v-if="rejectReason === 'Other'"
								class="w-full bg-black/40 border border-white/20 text-gray-200 text-sm rounded-md p-3 min-h-[80px]"
								placeholder="Provide specific feedback..."
								v-model="customRejectReason" />
							<div class="flex items-center justify-end gap-2">
								<Button size="sm" variant="ghost" @click="rejectMode = false"
									>Cancel</Button
								>
								<Button
									size="sm"
									variant="danger"
									:disabled="isSubmitting"
									@click="handleReject(approvalItem.id)">
									{{ isSubmitting ? "Sending..." : "Confirm Revision" }}
								</Button>
							</div>
						</div>
					</div>
					<div v-else class="flex gap-4">
						<button
							class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg shadow-lg shadow-green-500/20 transition-all text-sm flex items-center justify-center disabled:opacity-50 disabled:grayscale"
							:disabled="isSubmitting || cancelMode"
							@click="handleApprove(approvalItem.id)">
							<Check class="mr-2 h-4 w-4" />
							{{ isSubmitting ? "Approving..." : "Approve" }}
						</button>
						<button
							class="px-6 border border-gray-600 text-gray-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-400 font-semibold rounded-lg transition-all text-sm disabled:opacity-50 disabled:grayscale flex items-center"
							:disabled="isSubmitting || cancelMode"
							@click="rejectMode = true">
							<XCircle class="mr-2 h-4 w-4" />
							Reject
						</button>
					</div>
				</div>
				<div v-else class="p-12 text-center text-gray-500">
					<p>No pending approvals in queue.</p>
				</div>
			</div>
		</div>

		<div class="col-span-12 lg:col-span-4 space-y-6">
			<div
				v-if="interestedEvents.length > 0"
				class="glass-panel p-5 rounded-xl">
				<div class="flex justify-between items-center mb-4">
					<h3 class="font-bold text-white">Upcoming Events</h3>
					<RouterLink
						:to="`/events?projectId=${selectedProjectId}`"
						class="text-xs text-brand-accent hover:text-white">
						View All
					</RouterLink>
				</div>
				<div class="space-y-3">
					<div
						v-for="event in interestedEvents"
						:key="event.id"
						class="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-brand-primary/30 transition-colors">
						<div class="flex justify-between items-start gap-2">
							<div class="flex-1 min-w-0">
								<h4 class="font-medium text-white text-sm truncate">
									{{ event.name }}
								</h4>
								<p class="text-xs text-gray-500 truncate">
									{{ event.event_date || "TBD" }} •
									{{ event.location || "Location TBD" }}
								</p>
							</div>
							<a
								v-if="event.source_url && event.source_url.startsWith('http')"
								:href="event.source_url"
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs text-brand-accent hover:underline flex-shrink-0">
								Visit →
							</a>
						</div>
					</div>
				</div>
			</div>

			<div
				class="bg-[#0D0E12] border border-white/10 rounded-xl p-4 font-mono text-xs h-64 overflow-hidden flex flex-col">
				<div
					class="flex items-center justify-between mb-2 pb-2 border-b border-gray-800">
					<span class="text-gray-500">SYSTEM.LOG</span>
					<span class="w-2 h-2 rounded-full bg-green-500"></span>
				</div>
				<div class="overflow-y-auto space-y-2 text-gray-400 flex-1 scroll-hide">
					<div
						v-for="log in auditLog"
						:key="log.id"
						class="flex gap-2 leading-tight">
						<span class="text-gray-600 flex-shrink-0">
							[{{ formatLogTime(log.timestamp) }}]
						</span>
						<span class="flex-1">
							<span :class="actorColor(log.actor)">{{
								formatActor(log.actor)
							}}</span>
							<span :class="actionColor(log.action)">
								{{ log.action?.toLowerCase() }}</span
							>
							<span class="text-gray-500">
								{{ log.entity_type }} #{{ log.entity_id }}</span
							>
							<span v-if="logDetail(log)" class="text-gray-400 ml-1"
								>— {{ logDetail(log) }}</span
							>
						</span>
					</div>
					<div class="flex gap-2">
						<span class="text-gray-600">[{{ formatLogTime(Date.now()) }}]</span>
						<span class="text-white typing-effect"
							>Listening for events...</span
						>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
	import { useRoute, RouterLink } from "vue-router"
	import { storeToRefs } from "pinia"
	import { toast } from "vue-sonner"
	import { useProjectQuerySync } from "@/composables/useProjectQuerySync"
	import { useAppStore } from "@/stores/app"
	import Button from "@/components/ui/Button.vue"
	import MarkdownContent from "@/components/shared/MarkdownContent.vue"
	import XPostPreview from "@/components/social/XPostPreview.vue"
	import {
		Activity,
		ArrowRight,
		CalendarCheck,
		Palette,
		Image as ImageIcon,
		Check,
		FolderOpen,
		XCircle,
		Users,
		ClipboardList,
	} from "lucide-vue-next"
	import type { Agent, AuditLog, Post } from "@/types"

	useProjectQuerySync()

	const route = useRoute()
	const { selectedProjectId } = storeToRefs(useAppStore())

	const agents = ref<Agent[]>([])
	const approvals = ref<Post[]>([])
	const auditLog = ref<AuditLog[]>([])
	const interestedEvents = ref<any[]>([])
	const dailyStrategy = ref("")

	const cancelMode = ref(false)
	const rejectMode = ref(false)
	const rejectReason = ref("Brand Guidelines Violation")
	const customRejectReason = ref("")
	const isSubmitting = ref(false)
	const isGeneratingRequest = ref(false)
	const hasRequestedToday = ref(false)

	const AGENT_META: Record<string, any> = {
		hunter: {
			icon: CalendarCheck,
			color: "text-green-500",
			borderColor: "border-green-500",
			bgPulse: "bg-green-500",
			progressColor: "bg-green-500",
		},
		marcus: {
			icon: Palette,
			color: "text-purple-500",
			borderColor: "border-purple-500",
			bgPulse: "bg-purple-500",
			progressColor: "bg-purple-500",
		},
		nano: {
			icon: ImageIcon,
			color: "text-brand-500",
			borderColor: "border-blue-500",
			bgPulse: "bg-blue-500",
			progressColor: "bg-blue-500",
			animateBar: true,
		},
		vector: {
			icon: Activity,
			color: "text-gray-400",
			borderColor: "border-gray-600",
			bgPulse: "bg-gray-600",
			progressColor: "bg-gray-600",
		},
		campaign_manager: {
			icon: Activity,
			color: "text-blue-400",
			borderColor: "border-blue-600",
			bgPulse: "bg-blue-600",
			progressColor: "bg-blue-600",
		},
		content_writer: {
			icon: Palette,
			color: "text-pink-400",
			borderColor: "border-pink-600",
			bgPulse: "bg-pink-600",
			progressColor: "bg-pink-600",
		},
		research_agent: {
			icon: FolderOpen,
			color: "text-yellow-400",
			borderColor: "border-yellow-600",
			bgPulse: "bg-yellow-600",
			progressColor: "bg-yellow-600",
		},
		audience_analyst: {
			icon: CalendarCheck,
			color: "text-teal-400",
			borderColor: "border-teal-600",
			bgPulse: "bg-teal-600",
			progressColor: "bg-teal-600",
		},
		lead_strategist: {
			icon: Activity,
			color: "text-red-400",
			borderColor: "border-red-600",
			bgPulse: "bg-red-600",
			progressColor: "bg-red-600",
		},
		cso: {
			icon: Users,
			color: "text-indigo-400",
			borderColor: "border-indigo-600",
			bgPulse: "bg-indigo-600",
			progressColor: "bg-indigo-600",
		},
		cmo: {
			icon: Palette,
			color: "text-pink-500",
			borderColor: "border-pink-600",
			bgPulse: "bg-pink-600",
			progressColor: "bg-pink-600",
		},
		crco: {
			icon: XCircle,
			color: "text-orange-400",
			borderColor: "border-orange-600",
			bgPulse: "bg-orange-600",
			progressColor: "bg-orange-600",
		},
	}

	const renderedAgents = computed(() =>
		agents.value.map((agent) => ({
			...agent,
			...(AGENT_META[agent.slug] || AGENT_META.vector),
		})),
	)

	const approvalItem = computed(() => approvals.value[0])

	const approvalPreview = computed(() => {
		if (!approvalItem.value) return { previewPosts: [], strategyText: "" }
		try {
			const data = approvalItem.value.content.startsWith("{")
				? JSON.parse(approvalItem.value.content)
				: { text: approvalItem.value.content }

			let previewPosts: any[] = []
			const strategyText = data.text || ""

			if (data.posts && Array.isArray(data.posts)) {
				previewPosts = data.posts
			} else if (data.content) {
				previewPosts = [data]
			} else if (typeof data === "string") {
				previewPosts = [{ content: data }]
			} else {
				previewPosts = [{ content: data.text || JSON.stringify(data) }]
			}

			return { previewPosts, strategyText }
		} catch {
			return { previewPosts: [], strategyText: "" }
		}
	})

	const isGenerating = computed(() => isGeneratingRequest.value)

	const getDailyCooldownKey = (projectId: number | string) =>
		`daily-material-requested-${projectId}`

	const fetchDashboard = async () => {
		const projectId = route.query.projectId as string | undefined
		if (!projectId) {
			agents.value = []
			approvals.value = []
			auditLog.value = []
			interestedEvents.value = []
			dailyStrategy.value = ""
			return
		}

		const apiUrl = new URL("/api/dashboard", window.location.origin)
		apiUrl.searchParams.set("projectId", projectId)

		try {
			const response = await fetch(apiUrl.toString(), {
				headers: { "x-org-id": "demo-org" },
			})
			if (!response.ok) throw new Error("Dashboard fetch failed")
			const data = (await response.json()) as any
			agents.value = data.agents || []
			approvals.value = data.approvals || []
			auditLog.value = data.auditLog || []
			interestedEvents.value = data.interestedEvents || []
			dailyStrategy.value = data.dailyStrategy || ""
		} catch (error) {
			console.error("Dashboard loader error", error)
			agents.value = []
			approvals.value = []
			auditLog.value = []
			interestedEvents.value = []
			dailyStrategy.value = ""
		}
	}

	const handleRequestMaterial = async () => {
		if (!selectedProjectId.value) return
		isGeneratingRequest.value = true
		try {
			const res = await fetch("/api/campaigns/daily", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ projectId: String(selectedProjectId.value) }),
			})

			if (res.ok) {
				const key = getDailyCooldownKey(selectedProjectId.value)
				const today = new Date().toDateString()
				localStorage.setItem(key, today)
				hasRequestedToday.value = true
				toast.success("New materials generated & added to queue!", {
					id: "daily-material-success",
				})
				fetchDashboard()
			} else {
				const err = (await res.json()) as any
				toast.error(err.error || "Failed to generate materials")
			}
		} catch (error) {
			toast.error("Network error starting generation")
		} finally {
			isGeneratingRequest.value = false
		}
	}

	const handleApprove = async (id: number) => {
		isSubmitting.value = true
		try {
			const res = await fetch(`/api/client/posts/${id}/approve`, {
				method: "POST",
			})
			if (res.ok) {
				toast.success("Content approved and scheduled!")
				fetchDashboard()
			} else {
				toast.error("Failed to approve content")
			}
		} catch (error) {
			toast.error("Network error")
		} finally {
			isSubmitting.value = false
		}
	}

	const handleReject = async (id: number) => {
		isSubmitting.value = true
		const feedback =
			rejectReason.value === "Other"
				? customRejectReason.value
				: rejectReason.value
		try {
			const res = await fetch(`/api/client/posts/${id}/reject`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason: feedback, category: "brand_violation" }),
			})
			if (res.ok) {
				toast.success("Feedback sent to agents for revision")
				rejectMode.value = false
				fetchDashboard()
			} else {
				toast.error("Failed to send rejection")
			}
		} catch (error) {
			toast.error("Network error during rejection")
		} finally {
			isSubmitting.value = false
		}
	}

	const handleCancel = async (campaignId: number) => {
		isSubmitting.value = true
		try {
			const res = await fetch(`/api/client/campaigns/${campaignId}/cancel`, {
				method: "POST",
			})
			if (res.ok) {
				fetchDashboard()
				cancelMode.value = false
			}
		} finally {
			isSubmitting.value = false
		}
	}

	const formatLogTime = (timestamp: number) =>
		new Date(timestamp).toLocaleTimeString([], { hour12: false })

	const formatActor = (actor: string) => {
		if (actor.startsWith("agent:")) {
			return actor
				.replace("agent:", "")
				.replace(/_/g, " ")
				.replace(/\b\w/g, (char) => char.toUpperCase())
		}
		if (actor === "system") return "System"
		if (actor === "client") return "Client"
		return actor
	}

	const actorColor = (actor: string) => {
		if (actor === "system" || actor === "System") return "text-yellow-400"
		if (actor === "client" || actor === "Client") return "text-blue-400"
		return "text-purple-400"
	}

	const actionColor = (action: string) => {
		switch (action?.toUpperCase()) {
			case "CREATED":
			case "PUBLISHED":
				return "text-green-400"
			case "APPROVE":
			case "APPROVED":
				return "text-emerald-400"
			case "REJECT":
			case "REJECTED":
			case "CANCEL":
			case "CANCELLED":
				return "text-red-400"
			default:
				return "text-blue-400"
		}
	}

	const logDetail = (log: AuditLog) => {
		if (!log.details) return ""
		try {
			const details = JSON.parse(log.details)
			if (details.message) return details.message
			if (details.reason) return details.reason
			if (details.content) {
				return (
					details.content.substring(0, 50) +
					(details.content.length > 50 ? "..." : "")
				)
			}
			return ""
		} catch {
			return log.details.substring(0, 50)
		}
	}

	watch(
		() => selectedProjectId.value,
		(projectId) => {
			if (!projectId) return
			const key = getDailyCooldownKey(projectId)
			const lastRequestDate = localStorage.getItem(key)
			const today = new Date().toDateString()
			hasRequestedToday.value = lastRequestDate === today
		},
		{ immediate: true },
	)

	watch(
		() => route.query.projectId,
		() => {
			fetchDashboard()
		},
		{ immediate: true },
	)

	let refreshTimer: number | undefined

	onMounted(() => {
		refreshTimer = window.setInterval(() => {
			if (document.visibilityState === "visible") {
				fetchDashboard()
			}
		}, 3000)
	})

	onBeforeUnmount(() => {
		if (refreshTimer) window.clearInterval(refreshTimer)
	})
</script>
