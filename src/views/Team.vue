<template>
	<div class="space-y-8 pb-20">
		<div class="flex justify-between items-end">
			<div>
				<h2 class="text-2xl font-bold text-white mb-2">Company Directory</h2>
				<p class="text-gray-400">
					{{ totalAgents }} AI Agents | {{ activeAgents.length }} Currently Active | {{ stats.completedToday }} Tasks Today
				</p>
			</div>
			<button class="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded border border-gray-600 flex items-center">
				<Download class="mr-2 h-3 w-3" /> Export Org Chart
			</button>
		</div>

		<div class="grid grid-cols-3 gap-4">
			<div class="glass-panel p-4 rounded-xl">
				<div class="text-2xl font-bold text-white">{{ activeAgents.length }}</div>
				<div class="text-xs text-gray-400">Active Now</div>
			</div>
			<div class="glass-panel p-4 rounded-xl">
				<div class="text-2xl font-bold text-white">{{ stats.completedToday }}</div>
				<div class="text-xs text-gray-400">Tasks Today</div>
			</div>
			<div class="glass-panel p-4 rounded-xl">
				<div class="text-2xl font-bold text-white">{{ stats.totalTasks }}</div>
				<div class="text-xs text-gray-400">Total This Week</div>
			</div>
		</div>

		<div>
			<h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">
				1. Executive Layer
			</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<Card
					v-for="card in executiveCards"
					:key="card.key"
					:class="agentCardClass(card)">
					<div class="flex justify-between items-start mb-4">
						<div class="flex items-center gap-3">
							<div
								class="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
								:class="[card.colors.bg, card.colors.border, 'border']">
								{{ card.def.name.charAt(0) }}
							</div>
							<div>
								<h3 class="font-bold text-white">{{ card.def.name }}</h3>
								<div class="text-xs" :class="card.colors.text">
									{{ card.def.title }}
								</div>
							</div>
						</div>
						<span
							v-if="card.isActive"
							class="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30 animate-pulse">
							Active
						</span>
						<span
							v-else-if="card.status"
							class="px-2 py-1 bg-gray-700/50 text-gray-400 text-xs rounded-full border border-gray-600/30">
							Idle
						</span>
						<span
							v-else
							class="px-2 py-1 bg-gray-800/50 text-gray-500 text-xs rounded-full border border-gray-700/30">
							Standby
						</span>
					</div>
					<div class="text-xs text-gray-400 font-mono flex items-center">
						<component :is="card.def.icon" class="mr-2 h-3 w-3" />
						{{ card.status?.lastActivity || card.def.description }}
					</div>
					<div v-if="card.status" class="text-[10px] text-gray-600 mt-2">
						{{ formatTimeAgo(card.status.timestamp) }}
					</div>
				</Card>
			</div>
		</div>

		<div>
			<h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">
				2. Management Layer
			</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				<Card
					v-for="card in managementCards"
					:key="card.key"
					:class="agentCardClass(card)">
					<div class="flex justify-between items-start mb-4">
						<div class="flex items-center gap-3">
							<div
								class="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
								:class="[card.colors.bg, card.colors.border, 'border']">
								{{ card.def.name.charAt(0) }}
							</div>
							<div>
								<h3 class="font-bold text-white">{{ card.def.name }}</h3>
								<div class="text-xs" :class="card.colors.text">
									{{ card.def.title }}
								</div>
							</div>
						</div>
						<span
							v-if="card.isActive"
							class="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30 animate-pulse">
							Active
						</span>
						<span
							v-else-if="card.status"
							class="px-2 py-1 bg-gray-700/50 text-gray-400 text-xs rounded-full border border-gray-600/30">
							Idle
						</span>
						<span
							v-else
							class="px-2 py-1 bg-gray-800/50 text-gray-500 text-xs rounded-full border border-gray-700/30">
							Standby
						</span>
					</div>
					<div class="text-xs text-gray-400 font-mono flex items-center">
						<component :is="card.def.icon" class="mr-2 h-3 w-3" />
						{{ card.status?.lastActivity || card.def.description }}
					</div>
					<div v-if="card.status" class="text-[10px] text-gray-600 mt-2">
						{{ formatTimeAgo(card.status.timestamp) }}
					</div>
				</Card>
			</div>
		</div>

		<div>
			<h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">
				3. Specialist Agents
			</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<Card
					v-for="card in workerCards"
					:key="card.key"
					:class="agentCardClass(card)">
					<div class="flex justify-between items-start mb-4">
						<div class="flex items-center gap-3">
							<div
								class="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
								:class="[card.colors.bg, card.colors.border, 'border']">
								{{ card.def.name.charAt(0) }}
							</div>
							<div>
								<h3 class="font-bold text-white">{{ card.def.name }}</h3>
								<div class="text-xs" :class="card.colors.text">
									{{ card.def.title }}
								</div>
							</div>
						</div>
						<span
							v-if="card.isActive"
							class="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30 animate-pulse">
							Active
						</span>
						<span
							v-else-if="card.status"
							class="px-2 py-1 bg-gray-700/50 text-gray-400 text-xs rounded-full border border-gray-600/30">
							Idle
						</span>
						<span
							v-else
							class="px-2 py-1 bg-gray-800/50 text-gray-500 text-xs rounded-full border border-gray-700/30">
							Standby
						</span>
					</div>
					<div class="text-xs text-gray-400 font-mono flex items-center">
						<component :is="card.def.icon" class="mr-2 h-3 w-3" />
						{{ card.status?.lastActivity || card.def.description }}
					</div>
					<div v-if="card.status" class="text-[10px] text-gray-600 mt-2">
						{{ formatTimeAgo(card.status.timestamp) }}
					</div>
				</Card>
			</div>
		</div>

		<div v-if="recentActivity.length > 0">
			<h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">
				Recent Activity
			</h3>
			<div class="glass-panel rounded-xl p-4 max-h-64 overflow-y-auto">
				<div class="space-y-2">
					<div
						v-for="(activity, idx) in recentActivity.slice(0, 10)"
						:key="idx"
						class="flex items-center gap-3 text-sm py-2 border-b border-gray-800/50 last:border-0">
						<div class="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-300">
							{{ getAgentInitial(activity.agent_role) }}
						</div>
						<div class="flex-1">
							<span class="font-medium text-gray-300">
								{{ getAgentName(activity.agent_role) }}
							</span>
							<span class="text-gray-500 mx-2">
								{{ activityVerb(activity.status) }}
							</span>
							<span class="text-gray-400">
								{{ activityTask(activity.step_name) }}
							</span>
						</div>
						<span class="text-xs text-gray-600">
							{{ formatTimeAgo(activity.created_at) }}
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute } from "vue-router"
import { useProjectQuerySync } from "@/composables/useProjectQuerySync"
import Card from "@/components/ui/Card.vue"
import {
	BarChart3,
	Crown,
	Download,
	FileText,
	Megaphone,
	Network,
	PenTool,
	Search,
	Shield,
	Target,
	Users,
} from "lucide-vue-next"

useProjectQuerySync()

interface AgentActivity {
	id: number
	agent_role: string
	agent_name: string
	status: string
	created_at: number
	completed_at: number | null
	step_name: string
	project_name?: string
}

type AgentKey =
	| "cmo"
	| "cso"
	| "crco"
	| "campaign_manager"
	| "content_manager"
	| "growth_manager"
	| "integration_manager"
	| "research_agent"
	| "audience_analyst"
	| "seo_strategist"
	| "content_writer"
	| "social_dist_agent"
	| "performance_analyst"

type AgentStatus = {
	status: "active" | "idle" | "completed"
	lastActivity: string
	timestamp: number
}

const AGENT_DEFINITIONS = {
	cmo: {
		name: "Atlas",
		title: "Chief Marketing Officer",
		layer: "executive",
		icon: Crown,
		color: "red",
		description: "Overall marketing strategy alignment",
	},
	cso: {
		name: "Oracle",
		title: "Chief Strategy Officer",
		layer: "executive",
		icon: Target,
		color: "red",
		description: "Strategic planning and direction",
	},
	crco: {
		name: "Guardian",
		title: "Chief Risk & Compliance Officer",
		layer: "executive",
		icon: Shield,
		color: "red",
		description: "Risk assessment and compliance review",
	},
	campaign_manager: {
		name: "Nexus",
		title: "Campaign Manager",
		layer: "management",
		icon: Network,
		color: "blue",
		description: "Resource allocation and campaign orchestration",
	},
	content_manager: {
		name: "Elena",
		title: "Content Manager",
		layer: "management",
		icon: FileText,
		color: "blue",
		description: "Content strategy and quality control",
	},
	growth_manager: {
		name: "Vector",
		title: "Growth Manager",
		layer: "management",
		icon: BarChart3,
		color: "blue",
		description: "Growth metrics and optimization",
	},
	integration_manager: {
		name: "Marcus",
		title: "Integration Manager",
		layer: "management",
		icon: PenTool,
		color: "purple",
		description: "Cross-team coordination and final review",
	},
	research_agent: {
		name: "Scout",
		title: "Research Agent",
		layer: "worker",
		icon: Search,
		color: "green",
		description: "Market and competitor research",
	},
	audience_analyst: {
		name: "Iris",
		title: "Audience Analyst",
		layer: "worker",
		icon: Users,
		color: "teal",
		description: "Audience insights and segmentation",
	},
	seo_strategist: {
		name: "Cipher",
		title: "SEO Strategist",
		layer: "worker",
		icon: Target,
		color: "yellow",
		description: "Search optimization and keyword strategy",
	},
	content_writer: {
		name: "Scribe",
		title: "Content Writer",
		layer: "worker",
		icon: PenTool,
		color: "purple",
		description: "Content creation and copywriting",
	},
	social_dist_agent: {
		name: "Herald",
		title: "Social Distribution Agent",
		layer: "worker",
		icon: Megaphone,
		color: "pink",
		description: "Social media distribution planning",
	},
	performance_analyst: {
		name: "Metric",
		title: "Performance Analyst",
		layer: "worker",
		icon: BarChart3,
		color: "gray",
		description: "Performance tracking and analytics",
	},
} as const

const COLOR_MAP: Record<
	string,
	{ bg: string; border: string; text: string; glow: string }
> = {
	red: {
		bg: "bg-red-900/20",
		border: "border-red-500/30",
		text: "text-red-300",
		glow: "shadow-red-500/10",
	},
	blue: {
		bg: "bg-blue-900/20",
		border: "border-blue-500/30",
		text: "text-blue-300",
		glow: "shadow-blue-500/10",
	},
	purple: {
		bg: "bg-purple-900/20",
		border: "border-purple-500/30",
		text: "text-purple-300",
		glow: "shadow-purple-500/10",
	},
	green: {
		bg: "bg-green-900/20",
		border: "border-green-500/30",
		text: "text-green-300",
		glow: "shadow-green-500/10",
	},
	teal: {
		bg: "bg-teal-900/20",
		border: "border-teal-500/30",
		text: "text-teal-300",
		glow: "shadow-teal-500/10",
	},
	yellow: {
		bg: "bg-yellow-900/20",
		border: "border-yellow-500/30",
		text: "text-yellow-300",
		glow: "shadow-yellow-500/10",
	},
	pink: {
		bg: "bg-pink-900/20",
		border: "border-pink-500/30",
		text: "text-pink-300",
		glow: "shadow-pink-500/10",
	},
	gray: {
		bg: "bg-gray-800/30",
		border: "border-gray-500/30",
		text: "text-gray-300",
		glow: "shadow-gray-500/10",
	},
}

const executiveAgents: AgentKey[] = ["cmo", "cso", "crco"]
const managementAgents: AgentKey[] = [
	"campaign_manager",
	"content_manager",
	"growth_manager",
	"integration_manager",
]
const workerAgents: AgentKey[] = [
	"research_agent",
	"audience_analyst",
	"seo_strategist",
	"content_writer",
	"social_dist_agent",
	"performance_analyst",
]

const route = useRoute()
const recentActivity = ref<AgentActivity[]>([])
const activeAgents = ref<AgentKey[]>([])
const stats = ref({ totalTasks: 0, completedToday: 0, activeNow: 0 })

const fetchActivity = async () => {
	const projectId = route.query.projectId as string | undefined
	const apiUrl = new URL("/api/team/activity", window.location.origin)
	if (projectId) apiUrl.searchParams.set("projectId", projectId)

	try {
		const response = await fetch(apiUrl.toString(), {
			headers: { "x-org-id": "demo-org" },
		})
		if (!response.ok) {
			recentActivity.value = []
			activeAgents.value = []
			stats.value = { totalTasks: 0, completedToday: 0, activeNow: 0 }
			return
		}
		const data = (await response.json()) as {
			recentActivity: AgentActivity[]
			activeAgents: AgentKey[]
			stats: { totalTasks: number; completedToday: number; activeNow: number }
		}
		recentActivity.value = data.recentActivity
		activeAgents.value = data.activeAgents
		stats.value = data.stats
	} catch (error) {
		recentActivity.value = []
		activeAgents.value = []
		stats.value = { totalTasks: 0, completedToday: 0, activeNow: 0 }
	}
}

const formatActivityMessage = (activity: AgentActivity): string => {
	const stepName = activity.step_name || ""
	if (stepName.includes("exec_")) {
		return `Processing ${activity.project_name || "campaign"} task`
	}
	if (activity.status === "completed") {
		return `Completed task for ${activity.project_name || "project"}`
	}
	if (activity.status === "running") {
		return `Working on ${activity.project_name || "active task"}`
	}
	return "Awaiting assignment"
}

const formatTimeAgo = (timestamp: number): string => {
	const diff = Date.now() - timestamp
	const minutes = Math.floor(diff / 60000)
	if (minutes < 1) return "Just now"
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	return `${Math.floor(hours / 24)}d ago`
}

const agentStatusMap = computed(() => {
	const map = new Map<string, AgentStatus>()
	recentActivity.value.forEach((activity) => {
		const key = activity.agent_role
		if (!map.has(key)) {
			const isActive = activeAgents.value.includes(activity.agent_role as AgentKey)
			map.set(key, {
				status: isActive
					? "active"
					: activity.status === "completed"
						? "completed"
						: "idle",
				lastActivity: formatActivityMessage(activity),
				timestamp: activity.created_at,
			})
		}
	})
	return map
})

type AgentCard = {
	key: AgentKey
	def: (typeof AGENT_DEFINITIONS)[AgentKey]
	colors: { bg: string; border: string; text: string; glow: string }
	status?: AgentStatus
	isActive: boolean
}

const buildAgentCard = (agentKey: AgentKey): AgentCard => {
	const def = AGENT_DEFINITIONS[agentKey]
	const colors = COLOR_MAP[def.color] || COLOR_MAP.gray
	const status = agentStatusMap.value.get(agentKey)
	const isActive = activeAgents.value.includes(agentKey)
	return { key: agentKey, def, colors, status, isActive }
}

const executiveCards = computed(() => executiveAgents.map(buildAgentCard))
const managementCards = computed(() => managementAgents.map(buildAgentCard))
const workerCards = computed(() => workerAgents.map(buildAgentCard))

const totalAgents = computed(() => Object.keys(AGENT_DEFINITIONS).length)

const agentCardClass = (card: AgentCard) =>
	`p-6 border ${card.colors.border} ${card.colors.bg} ${card.isActive ? `shadow-lg ${card.colors.glow}` : ""}`

const getAgentDefinition = (role: string) =>
	AGENT_DEFINITIONS[role as AgentKey]

const getAgentName = (role: string) => getAgentDefinition(role)?.name || role

const getAgentInitial = (role: string) =>
	getAgentDefinition(role)?.name?.charAt(0) || "?"

const activityVerb = (status: string) => {
	if (status === "completed") return "completed"
	if (status === "running") return "is working on"
	return "started"
}

const activityTask = (stepName?: string) =>
	(stepName ?? "").replace("exec_", "").split("_")[0] || "task"

let refreshTimer: number | undefined

onMounted(() => {
	fetchActivity()
	refreshTimer = window.setInterval(() => {
		if (document.visibilityState === "visible") {
			fetchActivity()
		}
	}, 5000)
})

onBeforeUnmount(() => {
	if (refreshTimer) window.clearInterval(refreshTimer)
})

watch(
	() => route.query.projectId,
	() => fetchActivity(),
)
</script>
