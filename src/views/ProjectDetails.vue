<template>
	<div>
		<div
			v-if="deleteModalOpen"
			class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div class="bg-[#12141A] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
				<div class="flex items-center gap-3 mb-4">
					<div class="p-3 bg-red-500/20 rounded-full">
						<Trash2 class="w-6 h-6 text-red-400" />
					</div>
					<div>
						<h3 class="text-lg font-bold text-white">Delete Draft?</h3>
						<p class="text-sm text-gray-400">This action cannot be undone.</p>
					</div>
				</div>

				<p class="text-gray-300 text-sm mb-6">
					This will permanently delete this draft version. Your other versions (active, submitted) will not be affected.
				</p>

				<div class="flex gap-3">
					<Button
						variant="secondary"
						class="flex-1"
						:disabled="isDeleting"
						@click="closeDeleteModal">
						Cancel
					</Button>
					<Button
						class="flex-1 bg-red-600 hover:bg-red-500"
						:disabled="isDeleting"
						@click="confirmDeleteDraft">
						<Loader2 v-if="isDeleting" class="w-4 h-4 mr-2 animate-spin" />
						<Trash2 v-else class="w-4 h-4 mr-2" />
						{{ isDeleting ? "Deleting..." : "Delete" }}
					</Button>
				</div>
			</div>
		</div>

		<div class="view-section max-w-6xl mx-auto pb-20">
			<div class="flex items-center gap-4 mb-8">
				<RouterLink
					to="/projects"
					class="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors">
					<ChevronLeft class="w-5 h-5" />
				</RouterLink>
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-1">
						<h1 class="text-2xl font-bold text-white">{{ project?.name || "Project" }}</h1>
						<Badge
							v-if="project"
							:variant="project.status === 'ACTIVE' ? 'success' : 'default'">
							{{ project.status }}
						</Badge>
					</div>
					<div class="flex items-center gap-4 text-xs text-gray-400">
						<span>{{ project?.industry || "" }}</span>
						<a
							v-if="project?.website_url"
							:href="project.website_url"
							target="_blank"
							rel="noreferrer"
							class="hover:text-brand-primary">
							{{ project.website_url }}
						</a>
					</div>
				</div>
				<div>
					<RouterLink v-if="draftIntake && project" :to="`/projects/${project.id}/intake`">
						<Button class="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20">
							<Edit class="w-4 h-4 mr-2" />
							Resume Draft (v{{ draftIntake.version_num }})
						</Button>
					</RouterLink>
					<Button v-else @click="handleCreateDraft">
						<FileText class="w-4 h-4 mr-2" />
						{{ activeIntake ? "Edit Intake / New Version" : "Start Intake" }}
					</Button>
				</div>
			</div>

			<div class="grid grid-cols-12 gap-8">
				<div class="col-span-12 lg:col-span-8 space-y-8">
					<Card
						v-if="activeIntake"
						class="bg-gradient-to-br from-brand-primary/10 to-transparent border-brand-primary/20">
						<div class="p-6 relative">
							<h3 class="text-lg font-bold text-brand-primary mb-4 flex items-center gap-2">
								<Rocket class="w-5 h-5" />
								AI Strategy Brief
							</h3>
							<div class="absolute top-6 right-6">
								<Button
									size="sm"
									variant="secondary"
									class="h-8 text-xs border-brand-primary/20 hover:bg-brand-primary/10 hover:text-brand-primary"
									:disabled="isReprocessing"
									@click="handleReprocess(activeIntake.id)">
									<Loader2 v-if="isReprocessing" class="w-3 h-3 mr-1 animate-spin" />
									<Zap v-else class="w-3 h-3 mr-1" />
									{{ isReprocessing ? "Processing..." : "Regenerate" }}
								</Button>
							</div>
							<div v-if="activeIntake.ai_summary" class="prose prose-invert prose-sm max-w-none">
								<MarkdownContent :content="activeIntake.ai_summary" />
							</div>
							<p v-else class="text-gray-400 italic">Analysis pending or not generated.</p>
							<div class="mt-6 pt-4 border-t border-brand-primary/20 text-xs text-brand-primary/70 flex items-center gap-2">
								<CheckCircle2 class="w-3 h-3" />
								Based on Intake v{{ activeIntake.version_num }} • Activated {{ formatDate(activeIntake.activated_at) }}
							</div>
						</div>
					</Card>
					<div v-else class="border border-dashed border-white/10 rounded-xl p-12 text-center bg-white/5">
						<FileText class="w-12 h-12 text-gray-600 mx-auto mb-4" />
						<h3 class="text-lg font-medium text-white mb-2">No Active Profile</h3>
						<p class="text-gray-400 mb-6">
							Complete the intake wizard to activate this project/project profile.
						</p>
						<Button @click="handleCreateDraft">Start Intake Wizard</Button>
					</div>

					<div v-if="activeIntake" class="space-y-8">
						<div class="space-y-4">
							<h3 class="text-lg font-bold text-white flex items-center gap-2">
								<FileDown class="w-5 h-5" />
								User Intake Data
							</h3>
							<div class="bg-[#12141A] border border-white/10 rounded-xl p-6 overflow-hidden">
								<pre class="text-xs text-gray-500 overflow-auto max-h-96 font-mono" v-text="intakeDataJson"></pre>
							</div>
						</div>

						<div v-if="activeIntake.ai_context_pack_json" class="space-y-4">
							<h3 class="text-lg font-bold text-white flex items-center gap-2">
								<Bot class="w-5 h-5 text-brand-primary" />
								AI Context Data
							</h3>
							<div class="bg-[#12141A] border border-brand-primary/20 rounded-xl p-6 overflow-hidden relative">
								<div class="absolute top-0 right-0 p-2 bg-brand-primary/10 rounded-bl-xl text-xs text-brand-primary font-mono">
									Generated by Gemini
								</div>
								<pre class="text-xs text-brand-primary/80 overflow-auto max-h-96 font-mono" v-text="aiContextJson"></pre>
							</div>
						</div>
					</div>
				</div>

				<div class="col-span-12 lg:col-span-4 space-y-6">
					<Card>
						<div class="p-4 border-b border-white/10">
							<h3 class="font-bold text-white flex items-center gap-2">
								<History class="w-4 h-4 text-gray-400" />
								Version History
							</h3>
						</div>
						<div class="p-0">
							<div v-if="history.length > 0" class="divide-y divide-white/5">
								<div
									v-for="version in history"
									:key="version.id"
									class="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
									<div>
										<div class="flex items-center gap-2 mb-1">
											<span class="text-sm font-medium text-white">v{{ version.version_num }}</span>
											<Badge :variant="versionBadgeVariant(version.status)">
												{{ version.status }}
											</Badge>
										</div>
										<div class="text-xs text-gray-500 flex items-center gap-1">
											<Calendar class="w-3 h-3" />
											{{ formatDate(version.created_at) }}
										</div>
									</div>
									<div v-if="version.status === 'DRAFT'" class="flex items-center gap-2">
										<RouterLink v-if="project" :to="`/projects/${project.id}/intake`">
											<Button size="sm" variant="secondary" class="h-7 text-xs">Resume</Button>
										</RouterLink>
										<Button
											size="sm"
											variant="secondary"
											class="h-7 text-xs px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
											@click="handleDeleteDraft(version.id)">
											<Trash2 class="w-3.5 h-3.5" />
										</Button>
									</div>
								</div>
							</div>
							<div v-else class="p-8 text-center text-gray-500 text-sm">No history yet.</div>
						</div>
					</Card>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRoute, useRouter, RouterLink } from "vue-router"
import Badge from "@/components/ui/Badge.vue"
import Button from "@/components/ui/Button.vue"
import Card from "@/components/ui/Card.vue"
import MarkdownContent from "@/components/shared/MarkdownContent.vue"
import {
	Bot,
	Calendar,
	CheckCircle2,
	ChevronLeft,
	Edit,
	FileDown,
	FileText,
	History,
	Loader2,
	Rocket,
	Trash2,
	Zap,
} from "lucide-vue-next"

const route = useRoute()
const router = useRouter()

const project = ref<any>(null)
const activeIntake = ref<any>(null)
const draftIntake = ref<any>(null)
const history = ref<any[]>([])

const deleteModalOpen = ref(false)
const draftToDelete = ref<string | null>(null)
const isDeleting = ref(false)
const isReprocessing = ref(false)

const fetchDetails = async () => {
	const id = route.params.id as string
	const response = await fetch(`/api/projects/${id}`, {
		headers: { "x-org-id": "demo-org" },
	})
	if (!response.ok) {
		router.replace("/projects")
		return
	}
	const data = (await response.json()) as any
	project.value = data.project
	activeIntake.value = data.activeIntake
	draftIntake.value = data.draftIntake
	history.value = data.history || []
}

const handleCreateDraft = async () => {
	if (!project.value) return
	try {
		const res = await fetch(`/api/projects/${project.value.id}/intake/draft`, {
			method: "POST",
			headers: { "x-org-id": "demo-org", "x-actor-id": "demo-user" },
		})
		const data = (await res.json()) as { draftId?: string }
		if (data.draftId) {
			router.push(`/projects/${project.value.id}/intake`)
		}
	} catch (error) {
		console.error(error)
	}
}

const closeDeleteModal = () => {
	deleteModalOpen.value = false
	draftToDelete.value = null
}

const handleDeleteDraft = (versionId: string) => {
	draftToDelete.value = versionId
	deleteModalOpen.value = true
}

const confirmDeleteDraft = async () => {
	if (!draftToDelete.value || !project.value) return
	isDeleting.value = true
	try {
		const res = await fetch(
			`/api/projects/${project.value.id}/intake/${draftToDelete.value}`,
			{
				method: "DELETE",
				headers: { "x-org-id": "demo-org", "x-actor-id": "demo-user" },
			},
		)
		if (res.ok) {
			await fetchDetails()
		}
	} catch (error) {
		console.error(error)
	} finally {
		isDeleting.value = false
		closeDeleteModal()
	}
}

const handleReprocess = async (versionId: string) => {
	if (!project.value) return
	isReprocessing.value = true
	try {
		const res = await fetch(
			`/api/projects/${project.value.id}/intake/${versionId}/reprocess`,
			{
				method: "POST",
				headers: { "x-org-id": "demo-org", "x-actor-id": "demo-user" },
			},
		)
		if (res.ok) {
			await fetch(`/api/projects/${project.value.id}/knowledge/sync`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-org-id": "demo-org",
					"x-actor-id": "demo-user",
				},
				body: JSON.stringify({ versionId, index: true }),
			})
			await fetchDetails()
		}
	} catch (error) {
		console.error(error)
	} finally {
		isReprocessing.value = false
	}
}

const formatDate = (timestamp?: string | number) => {
	if (!timestamp) return ""
	const date = new Date(timestamp)
	if (Number.isNaN(date.getTime())) return ""
	return date.toLocaleDateString()
}

const parseJson = (value?: string) => {
	if (!value) return "{}"
	try {
		return JSON.stringify(JSON.parse(value), null, 2)
	} catch {
		return value
	}
}

const intakeDataJson = computed(() =>
	parseJson(activeIntake.value?.data_json || "{}"),
)
const aiContextJson = computed(() =>
	parseJson(activeIntake.value?.ai_context_pack_json || "{}"),
)

const versionBadgeVariant = (status: string) => {
	if (status === "ACTIVE") return "success"
	if (status === "DRAFT") return "warning"
	return "default"
}

onMounted(fetchDetails)

watch(
	() => route.params.id,
	() => fetchDetails(),
)
</script>
