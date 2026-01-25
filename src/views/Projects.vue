<template>
	<div class="view-section max-w-7xl mx-auto pb-20">
		<div class="flex justify-between items-center mb-8">
			<div>
				<h1 class="text-2xl font-bold text-white mb-2">Projects</h1>
				<p class="text-gray-400">Manage your company's growth initiatives.</p>
			</div>
			<Button @click="isModalOpen = true">
				<Plus class="w-4 h-4 mr-2" />
				New Project
			</Button>
		</div>

		<div
			v-if="projects.length === 0"
			class="text-center py-20 bg-white/5 rounded-xl border border-white/10 border-dashed">
			<Folder class="w-12 h-12 text-gray-600 mx-auto mb-4" />
			<h3 class="text-lg font-medium text-white mb-2">No projects yet</h3>
			<p class="text-gray-400 mb-6">
				Create your first project to get started with GrowthOps AI.
			</p>
			<Button
				variant="secondary"
				class="bg-gray-700 hover:bg-gray-600"
				@click="isModalOpen = true">
				Create Project
			</Button>
		</div>
		<div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			<Card
				v-for="project in projects"
				:key="project.id"
				class="hover:border-brand-primary/50 transition-colors group">
				<CardHeader
					class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-lg font-bold text-white truncate">{{
						project.name
					}}</CardTitle>
					<Badge v-if="project.status === 'ACTIVE'" variant="success"
						>Active</Badge
					>
					<Badge v-else variant="default">Draft</Badge>
				</CardHeader>
				<CardContent>
					<div class="text-sm text-gray-400 mb-4 h-5">
						{{ project.industry }}
					</div>
					<div class="flex gap-2 mt-4 pt-4 border-t border-white/10">
						<RouterLink
							v-if="project.active_intake_id"
							:to="`/projects/${project.id}`"
							class="flex-1 text-center bg-white/10 hover:bg-white/20 text-white text-sm font-medium py-2 rounded transition-colors">
							View Profile
						</RouterLink>
						<RouterLink
							v-else
							:to="`/projects/${project.id}/intake`"
							class="flex-1 text-center bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-sm font-medium py-2 rounded transition-colors flex items-center justify-center gap-2">
							<FileText class="w-3 h-3" />
							{{ project.draft_intake_id ? "Resume Intake" : "Start Intake" }}
						</RouterLink>
					</div>
				</CardContent>
			</Card>
		</div>

		<div
			v-if="isModalOpen"
			class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
			<div
				class="bg-[#12141A] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl relative">
				<h2 class="text-xl font-bold text-white mb-4">Create New Project</h2>
				<form @submit.prevent="handleCreate">
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium text-gray-400 mb-1"
								>Project Name</label
							>
							<input
								v-model="newProjectName"
								required
								class="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:ring-1 focus:ring-brand-primary outline-none"
								placeholder="e.g. Summer Launch 2026" />
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-400 mb-1"
								>Industry</label
							>
							<select
								v-model="industry"
								class="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:ring-1 focus:ring-brand-primary outline-none">
								<option value="Technology">Technology</option>
								<option value="Retail">Retail</option>
								<option value="Healthcare">Healthcare</option>
								<option value="Finance">Finance</option>
								<option value="Entertainment">Entertainment</option>
								<option value="Education">Education</option>
								<option value="Other">Other</option>
							</select>
						</div>
					</div>
					<div class="flex justify-end gap-3 mt-8">
						<button
							type="button"
							class="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
							@click="isModalOpen = false">
							Cancel
						</button>
						<Button type="submit" :disabled="isCreating" class="w-auto">
							{{ isCreating ? "Creating..." : "Create Project" }}
						</Button>
					</div>
				</form>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref } from "vue"
	import { useRouter, RouterLink } from "vue-router"
	import { toast } from "vue-sonner"
	import Button from "@/components/ui/Button.vue"
	import Card from "@/components/ui/Card.vue"
	import CardHeader from "@/components/ui/CardHeader.vue"
	import CardTitle from "@/components/ui/CardTitle.vue"
	import CardContent from "@/components/ui/CardContent.vue"
	import Badge from "@/components/ui/Badge.vue"
	import { Plus, Folder, FileText } from "lucide-vue-next"
	import type { Project } from "@/types"

	const router = useRouter()

	const AUTH_HEADERS = {
		"x-org-id": "demo-org",
		"x-actor-id": "demo-user",
		"Content-Type": "application/json",
	}

	const projects = ref<Project[]>([])
	const isCreating = ref(false)
	const isModalOpen = ref(false)
	const newProjectName = ref("")
	const industry = ref("Technology")

	const fetchProjects = async () => {
		try {
			const response = await fetch("/api/projects", {
				headers: { "x-org-id": "demo-org" },
			})
			if (!response.ok) {
				projects.value = []
				return
			}
			const data = (await response.json()) as { results: Project[] }
			projects.value = data.results
		} catch (error) {
			projects.value = []
		}
	}

	const handleCreate = async () => {
		isCreating.value = true
		try {
			const res = await fetch("/api/projects", {
				method: "POST",
				headers: AUTH_HEADERS,
				body: JSON.stringify({
					name: newProjectName.value,
					industry: industry.value,
				}),
			})

			if (!res.ok) {
				const err = (await res.json()) as { error: string; message?: string }
				toast.error(err.message || err.error || "Failed to create project")
				return
			}

			const data = (await res.json()) as { project: Project }
			isModalOpen.value = false
			newProjectName.value = ""
			router.push(`/dashboard/projects/${data.project.id}/intake`)
		} catch (error) {
			console.error(error)
			toast.error("Network error creating project")
		} finally {
			isCreating.value = false
		}
	}

	onMounted(fetchProjects)
</script>
