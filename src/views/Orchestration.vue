<template>
	<div class="min-h-screen bg-[#09090b] text-slate-300 font-sans selection:bg-brand-primary/30">
		<header class="h-14 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
			<div class="flex items-center gap-2">
				<BrainCircuit class="text-brand-primary w-5 h-5" />
				<span class="font-bold text-slate-100 tracking-tight">
					GROWTHOPS<span class="text-brand-primary">.AI</span> // ORCHESTRATOR
				</span>
			</div>
			<div class="flex items-center gap-4 text-xs font-mono text-slate-500">
				<div class="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full">
					<div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
					SYSTEM ONLINE
				</div>
				<span>v.1.0.4-beta</span>
			</div>
		</header>

		<div class="p-6 flex flex-col gap-6 h-[calc(100vh-3.5rem)] overflow-hidden">
			<div class="h-[40%] shrink-0 flex gap-6 min-h-[300px]">
				<div class="flex-1 glass-panel rounded-xl border border-white/10 bg-black/40 relative overflow-hidden flex flex-col">
					<div class="absolute top-4 left-4 z-10">
						<h2 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
							<Activity class="w-3 h-3 text-brand-primary" />
							Live Topology
						</h2>
					</div>

					<div class="flex-1 w-full h-full relative">
						<svg class="w-full h-full" viewBox="0 0 800 500">
							<defs>
								<filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
									<feGaussianBlur stdDeviation="3" result="blur" />
									<feComposite in="SourceGraphic" in2="blur" operator="over" />
								</filter>
								<marker
									id="arrowhead"
									markerWidth="10"
									markerHeight="7"
									refX="28"
									refY="3.5"
									orient="auto">
									<polygon points="0 0, 10 3.5, 0 7" fill="#334155" />
								</marker>
							</defs>

							<g class="connections">
								<g v-for="edge in renderedEdges" :key="edge.key">
									<line
										:x1="edge.x1"
										:y1="edge.y1"
										:x2="edge.x2"
										:y2="edge.y2"
										:stroke="edge.isActive ? '#ffff' : '#334155'"
										:stroke-width="edge.isActive ? 2 : 1"
										:stroke-opacity="edge.isActive ? 0.8 : 0.3"
										marker-end="url(#arrowhead)"
									/>
									<circle v-if="edge.isActive" r="3" fill="white" filter="url(#glow)">
										<animateMotion
											dur="1s"
											repeatCount="indefinite"
											:path="edge.path"
										/>
									</circle>
								</g>
							</g>

							<g
								v-for="([key, node]) in agentEntries"
								:key="key"
								class="transition-all duration-500 cursor-default">
								<circle
									v-if="isNodeActive(key)"
									:cx="node.x"
									:cy="node.y"
									r="35"
									:fill="node.color"
									opacity="0.2">
									<animate
										attributeName="r"
										from="25"
										to="45"
										dur="1.5s"
										repeatCount="indefinite"
									/>
									<animate
										attributeName="opacity"
										from="0.3"
										to="0"
										dur="1.5s"
										repeatCount="indefinite"
									/>
								</circle>

								<circle
									:cx="node.x"
									:cy="node.y"
									r="20"
									fill="#09090b"
									:stroke="isNodeActive(key) ? node.color : '#334155'"
									:stroke-width="isNodeActive(key) ? 2 : 1"
									:filter="isNodeActive(key) ? 'url(#glow)' : undefined"
								/>

								<text
									:x="node.x"
									:y="node.y"
									dy="4"
									text-anchor="middle"
									:fill="isNodeActive(key) ? 'white' : '#64748b'"
									font-size="9"
									class="font-bold pointer-events-none uppercase tracking-wider select-none">
									{{ node.label.substring(0, 1) }}
								</text>

								<text
									:x="node.x"
									:y="node.y + 35"
									text-anchor="middle"
									:fill="isNodeActive(key) ? node.color : '#475569'"
									font-size="9"
									font-weight="bold"
									class="select-none tracking-widest uppercase opacity-80">
									{{ node.label }}
								</text>
							</g>
						</svg>

						<div
							v-if="selectedRunId && (runDetails?.run.status === 'completed' || isReplaying)"
							class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur border border-white/10 rounded-full z-20 shadow-xl">
							<button
								class="p-1.5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition"
								title="Reset Replay"
								@click="resetReplay">
								<RotateCw class="w-3 h-3" />
							</button>

							<div class="h-4 w-px bg-white/10 mx-1"></div>

							<button
								class="p-1.5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition"
								:disabled="replayStepIndex === 0"
								@click="stepBack">
								<SkipBack class="w-3 h-3" />
							</button>

							<button
								class="p-2 bg-brand-primary text-white rounded-full hover:bg-brand-primary/80 transition shadow-lg shadow-brand-primary/20"
								@click="toggleReplay">
								<Pause v-if="isReplaying" class="w-4 h-4 fill-current" />
								<Play v-else class="w-4 h-4 fill-current ml-0.5" />
							</button>

							<button
								class="p-1.5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition"
								:disabled="!runDetails || replayStepIndex >= (runDetails?.steps.length || 0) - 1"
								@click="stepForward">
								<SkipForward class="w-3 h-3" />
							</button>

							<div class="h-4 w-px bg-white/10 mx-1"></div>

							<span class="text-[10px] font-mono text-slate-400 min-w-[60px] text-center">
								STEP {{ replayStepIndex + 1 }} / {{ runDetails?.steps.length || 0 }}
							</span>
						</div>
					</div>
				</div>
			</div>

			<div class="flex-1 min-h-0 grid grid-cols-12 gap-6">
				<div class="col-span-4 glass-panel rounded-xl border border-white/10 bg-black/20 flex flex-col overflow-hidden h-full">
					<div class="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center shrink-0">
						<h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
							<Users class="w-3 h-3" /> Active Job Queue
						</h3>
						<div class="flex gap-2">
							<span class="text-[10px] bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded font-mono">
								{{ runningCount }} RUNNING
							</span>
						</div>
					</div>
					<div class="overflow-y-auto p-2 space-y-1 scroll-hide flex-1">
						<div
							v-for="run in recentRuns"
							:key="run.id"
							class="group p-3 rounded border transition-all cursor-pointer relative overflow-hidden"
							:class="runItemClass(run.id)"
							@click="selectRun(run.id)">
							<div
								v-if="selectedRunId === run.id"
								class="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-primary"></div>

							<div class="flex justify-between items-start mb-1">
								<span
									class="text-[10px] font-mono tracking-wider"
									:class="selectedRunId === run.id ? 'text-brand-primary' : 'text-slate-500'">
									JOB-{{ run.id.slice(0, 4).toUpperCase() }}
								</span>
								<span :class="statusPillClass(run.status)">
									{{ statusPillLabel(run.status) }}
								</span>
							</div>
							<p
								class="text-xs line-clamp-2"
								:class="selectedRunId === run.id ? 'text-slate-200' : 'text-slate-400'">
								{{ run.instruction }}
							</p>
							<div class="flex items-center gap-2 mt-2 opacity-60">
								<Clock class="w-3 h-3" />
								<span class="text-[10px] font-mono">
									{{ formatTime(run.start_time) }}
								</span>
							</div>
						</div>
					</div>
				</div>

				<div class="col-span-8 glass-panel rounded-xl border border-white/10 bg-black/20 flex flex-col overflow-hidden h-full">
					<div class="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center shrink-0">
						<h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
							<Terminal class="w-3 h-3 text-green-500" /> Execution Trace (Latest)
						</h3>
						<div class="flex items-center gap-2">
							<span
								v-if="runDetails?.run.status === 'pending'"
								class="animate-pulse w-2 h-2 rounded-full bg-green-500"></span>
							<span class="font-mono text-[10px] text-slate-500">ID: {{ selectedRunId }}</span>
						</div>
					</div>

					<div class="flex-1 overflow-y-auto p-6 relative font-mono text-sm scroll-hide">
						<div class="absolute left-6 top-8 bottom-8 w-px bg-white/10"></div>

						<div
							v-if="!runDetails"
							class="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
							<Search class="w-8 h-8 opacity-20" />
							<p>Select a job to view trace</p>
						</div>

						<div v-else class="space-y-8">
							<div v-for="(step, idx) in runDetails.steps" :key="idx" class="relative pl-12 group">
								<div
									class="absolute left-[21px] top-1.5 w-2 h-2 rounded-full border border-black z-10"
									:class="
										step.status === 'completed'
											? 'bg-brand-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]'
											: 'bg-slate-700'
									"></div>

								<div class="flex items-baseline justify-between mb-1">
									<span class="text-green-500 font-bold text-xs">
										{{
											step.completed_at
												? new Date(step.completed_at).toLocaleTimeString()
												: "..."
										}}
									</span>
									<span class="text-[10px] text-slate-600 uppercase tracking-widest">
										{{ step.agent_role }}
									</span>
								</div>

								<div class="mb-2">
									<span class="text-slate-200 font-bold">{{ step.agent_name }}</span>
									<span class="text-slate-500 mx-2">→</span>
									<span class="text-slate-400">{{ step.step_name }}</span>
								</div>

								<div class="bg-black/40 border border-white/5 rounded p-3 text-xs text-slate-400 group-hover:border-white/10 transition-colors">
									<div class="mb-1 text-[10px] text-slate-600 uppercase">Payload</div>
									<pre
										class="whitespace-pre-wrap leading-relaxed opacity-80"
										v-text="formatJsonSummary(step.output)"></pre>
								</div>
							</div>

							<div v-if="runDetails.run.status === 'pending'" class="relative pl-12">
								<div class="absolute left-[21px] top-1.5 w-2 h-2 rounded-full bg-green-500 animate-pulse z-10"></div>
								<div class="text-green-500/50 text-xs animate-pulse">
									Processing next step...
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import {
	Activity,
	BrainCircuit,
	Clock,
	Pause,
	Play,
	RotateCw,
	Search,
	SkipBack,
	SkipForward,
	Terminal,
	Users,
} from "lucide-vue-next"

interface Run {
	id: string
	instruction: string
	status: "pending" | "completed" | "failed"
	start_time: number
	end_time?: number
	result?: string
}

interface RunStep {
	id: number
	run_id: string
	agent_role: string
	agent_name: string
	step_name: string
	status: string
	input: string
	output: string
	created_at: number
	completed_at: number
}

const recentRuns = ref<Run[]>([])
const selectedRunId = ref<string | null>(null)
const runDetails = ref<{ run: Run; steps: RunStep[] } | null>(null)
const autoRefresh = ref(true)
const isReplaying = ref(false)
const replayStepIndex = ref(0)

const fetchRuns = async () => {
	try {
		const res = await fetch("/api/runs")
		const data = (await res.json()) as { recentRuns: Run[] }
		recentRuns.value = data.recentRuns || []
	} catch (err) {
		recentRuns.value = []
	}
}

const fetchRunDetails = async () => {
	if (!selectedRunId.value) return
	try {
		const res = await fetch(`/api/runs/${selectedRunId.value}`)
		const data = (await res.json()) as { run: Run; steps: RunStep[] }
		if (data.run) {
			runDetails.value = data
			if (data.run.status === "completed" || data.run.status === "failed") {
				// autoRefresh.value = false
			}
		}
	} catch (err) {
		console.error("Failed to poll run", err)
	}
}

let refreshTimer: number | undefined
let replayTimer: number | undefined

const startPolling = () => {
	if (refreshTimer) {
		window.clearInterval(refreshTimer)
		refreshTimer = undefined
	}
	if (!selectedRunId.value || !autoRefresh.value || isReplaying.value) return
	fetchRunDetails()
	refreshTimer = window.setInterval(fetchRunDetails, 1000)
}

watch([selectedRunId, autoRefresh], startPolling, { immediate: true })

watch(selectedRunId, () => {
	isReplaying.value = false
	replayStepIndex.value = 0
})

watch(
	[isReplaying, () => runDetails.value?.steps.length],
	() => {
		if (replayTimer) {
			window.clearInterval(replayTimer)
			replayTimer = undefined
		}
		if (!isReplaying.value || !runDetails.value) return
		replayTimer = window.setInterval(() => {
			if (!runDetails.value) return
			if (replayStepIndex.value >= runDetails.value.steps.length - 1) {
				isReplaying.value = false
				return
			}
			replayStepIndex.value += 1
		}, 1500)
	},
	{ immediate: false },
)

watch(recentRuns, (runs) => {
	if (!selectedRunId.value && runs.length > 0) {
		selectedRunId.value = runs[0].id
	}
})

onMounted(() => {
	fetchRuns()
})

onBeforeUnmount(() => {
	if (refreshTimer) window.clearInterval(refreshTimer)
	if (replayTimer) window.clearInterval(replayTimer)
})

const activeStep = computed(() => {
	const steps = runDetails.value?.steps
	if (!steps || steps.length === 0) return undefined
	if (isReplaying.value) return steps[replayStepIndex.value]
	return steps.find((step) => step.status === "running") || steps[steps.length - 1]
})

const AGENTS = {
	cso: { x: 300, y: 80, label: "CSO", color: "#F472B6" },
	cmo: { x: 400, y: 40, label: "CMO", color: "#F472B6" },
	crco: { x: 500, y: 80, label: "CR/CO", color: "#EF4444" },
	project_manager: { x: 400, y: 220, label: "PROJECT MGR", color: "#3B82F6" },
	campaign_manager: { x: 200, y: 220, label: "CAMPAIGN MGR", color: "#A855F7" },
	content_manager: { x: 600, y: 220, label: "CONTENT MGR", color: "#A855F7" },
	growth_manager: { x: 300, y: 340, label: "GROWTH MGR", color: "#10B981" },
	integration_manager: {
		x: 500,
		y: 340,
		label: "NTEGRATION",
		color: "#F59E0B",
	},
	research_agent: { x: 100, y: 150, label: "RESEARCH", color: "#64748B" },
	audience_analyst: { x: 100, y: 290, label: "AUDIENCE", color: "#64748B" },
	seo_strategist: { x: 700, y: 150, label: "SEO", color: "#64748B" },
	content_writer: { x: 700, y: 290, label: "WRITER", color: "#F59E0B" },
	social_dist_agent: { x: 600, y: 420, label: "SOCIAL", color: "#64748B" },
	perf_analyst: { x: 200, y: 420, label: "ANALYST", color: "#10B981" },
} as const

type AgentKey = keyof typeof AGENTS
type AgentNode = (typeof AGENTS)[AgentKey]
type Edge = { from: AgentKey; to: AgentKey }

const EDGES: Edge[] = [
	{ from: "project_manager", to: "cso" },
	{ from: "project_manager", to: "campaign_manager" },
	{ from: "project_manager", to: "content_manager" },
	{ from: "project_manager", to: "growth_manager" },
	{ from: "project_manager", to: "research_agent" },
	{ from: "project_manager", to: "audience_analyst" },
	{ from: "cmo", to: "content_manager" },
	{ from: "crco", to: "content_manager" },
	{ from: "campaign_manager", to: "content_manager" },
	{ from: "content_manager", to: "content_writer" },
	{ from: "content_manager", to: "seo_strategist" },
	{ from: "growth_manager", to: "content_writer" },
	{ from: "growth_manager", to: "perf_analyst" },
	{ from: "growth_manager", to: "content_manager" },
	{ from: "content_writer", to: "social_dist_agent" },
	{ from: "social_dist_agent", to: "integration_manager" },
	{ from: "content_manager", to: "integration_manager" },
]

const agentEntries = Object.entries(AGENTS) as [AgentKey, AgentNode][]

const getActiveNodes = (step?: RunStep) => {
	if (!step) return []
	const roleKey = step.agent_role.toLowerCase().replace(/ /g, "_")
	const name = step.step_name

	if (step.step_name.includes("Assigning task to")) {
		const targetMatch = step.step_name.match(/to ([\w_]+)/)
		if (targetMatch) {
			const target = targetMatch[1]
			return [roleKey, target]
		}
	}

	if (roleKey === "content_manager" && name.includes("Review"))
		return ["content_writer", "content_manager"]
	if (roleKey === "growth_manager" && name.includes("Review"))
		return ["content_writer", "growth_manager"]

	if (roleKey === "content_writer")
		return ["content_manager", "content_writer"]
	if (roleKey === "seo_strategist")
		return ["content_manager", "seo_strategist"]
	if (roleKey === "research_agent")
		return ["project_manager", "research_agent"]
	if (roleKey === "audience_analyst")
		return ["project_manager", "audience_analyst"]
	if (roleKey === "social_dist_agent")
		return ["content_writer", "social_dist_agent"]
	if (roleKey === "perf_analyst") return ["growth_manager", "perf_analyst"]

	if (["cso", "cmo", "crco"].includes(roleKey))
		return ["project_manager", roleKey]

	return [roleKey]
}

const activeNodes = computed(() => getActiveNodes(activeStep.value))

const activeEdge = computed(() => {
	if (activeNodes.value.length < 2) return null
	return (
		EDGES.find(
			(edge) =>
				(edge.from === activeNodes.value[0] &&
					edge.to === activeNodes.value[1]) ||
				(edge.from === activeNodes.value[1] &&
					edge.to === activeNodes.value[0]),
		) || null
	)
})

const renderedEdges = computed(() => {
	return EDGES.map((edge) => {
		const start = AGENTS[edge.from]
		const end = AGENTS[edge.to]
		const active =
			activeEdge.value &&
			((activeEdge.value.from === edge.from &&
				activeEdge.value.to === edge.to) ||
				(activeEdge.value.from === edge.to &&
					activeEdge.value.to === edge.from))
		let isReverse = false
		if (active && activeNodes.value.length === 2) {
			if (
				activeNodes.value[0] === edge.to &&
				activeNodes.value[1] === edge.from
			) {
				isReverse = true
			}
		}
		const x1 = isReverse ? end.x : start.x
		const y1 = isReverse ? end.y : start.y
		const x2 = isReverse ? start.x : end.x
		const y2 = isReverse ? start.y : end.y
		return {
			key: `${edge.from}-${edge.to}`,
			x1,
			y1,
			x2,
			y2,
			isActive: Boolean(active),
			path: `M ${x1} ${y1} L ${x2} ${y2}`,
		}
	})
})

const isNodeActive = (key: string) => activeNodes.value.includes(key)

const runningCount = computed(
	() => recentRuns.value.filter((run) => run.status === "pending").length,
)

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString()

const statusPillLabel = (status: string) => {
	if (status === "completed") return "DONE"
	if (status === "failed") return "FAIL"
	return "RUNNING"
}

const statusPillClass = (status: string) => {
	if (status === "completed")
		return "text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20"
	if (status === "failed")
		return "text-[10px] text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20"
	return "text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20 animate-pulse"
}

const formatJsonSummary = (str: string) => {
	try {
		const obj = JSON.parse(str)
		if (obj.output) return JSON.stringify(obj.output, null, 2)
		return JSON.stringify(obj, null, 2)
	} catch {
		return str
	}
}

const runItemClass = (runId: string) =>
	selectedRunId.value === runId
		? "bg-white/[0.08] border-brand-primary/50 shadow-[inset_0_0_20px_-10px_rgba(59,130,246,0.2)]"
		: "bg-transparent border-transparent hover:bg-white/[0.04] hover:border-white/10"

const resetReplay = () => {
	isReplaying.value = false
	replayStepIndex.value = 0
}

const stepBack = () => {
	isReplaying.value = false
	replayStepIndex.value = Math.max(0, replayStepIndex.value - 1)
}

const toggleReplay = () => {
	isReplaying.value = !isReplaying.value
}

const stepForward = () => {
	isReplaying.value = false
	if (runDetails.value) {
		replayStepIndex.value = Math.min(
			runDetails.value.steps.length - 1,
			replayStepIndex.value + 1,
		)
	}
}

const selectRun = (runId: string) => {
	selectedRunId.value = runId
}
</script>
