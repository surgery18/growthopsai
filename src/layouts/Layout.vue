<template>
	<div class="flex h-screen w-full overflow-hidden">
		<aside
			class="w-64 border-r border-glass-border bg-black/20 backdrop-blur-xl flex flex-col">
			<div class="p-6">
				<div
					class="flex items-center gap-2 text-brand-accent font-bold text-xl tracking-wider">
					<Activity class="h-6 w-6" />
					<span>GROWTHOPS</span>
				</div>
				<div class="text-xs text-gray-500 uppercase tracking-widest mt-1 ml-8">
					AI Command Center
				</div>
			</div>

			<div class="px-4 mb-4">
				<button
					class="w-full flex items-center justify-between px-4 py-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
					@click="dropdownOpen = !dropdownOpen">
					<div class="flex items-center gap-2 text-sm truncate">
						<template v-if="hasActiveProject">
							<span class="h-2 w-2 rounded-full bg-green-500"></span>
							<span class="font-medium text-white truncate">{{
								selectedProject?.name
							}}</span>
						</template>
						<span v-else class="text-gray-400">No Project Selected</span>
					</div>
					<ChevronDown
						:class="[
							'h-4 w-4 text-gray-400 transition-transform',
							dropdownOpen ? 'rotate-180' : '',
						]" />
				</button>
				<div
					v-if="dropdownOpen"
					class="mt-2 bg-[#0a0a0f] border border-white/10 rounded-lg overflow-hidden shadow-xl z-50">
					<div
						v-if="activeProjects.length === 0"
						class="px-4 py-3 text-xs text-gray-500">
						No active projects. Complete an intake first.
					</div>
					<button
						v-for="project in activeProjects"
						:key="project.id"
						class="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
						:class="
							project.id === selectedProjectId
								? 'bg-brand-primary/10 text-brand-primary'
								: 'text-gray-300'
						"
						@click="selectProject(project.id)">
						<span class="h-2 w-2 rounded-full bg-green-500"></span>
						{{ project.name }}
					</button>
				</div>
			</div>

			<nav class="flex-1 px-4 py-3 space-y-6 overflow-y-auto">
				<div>
					<div
						class="px-3 mb-3 text-[11px] text-gray-500 uppercase tracking-[0.2em]">
						General
					</div>
					<div class="flex flex-col gap-4">
						<RouterLink
							v-for="item in globalNavItems"
							:key="item.path"
							:to="withProject(item.path)"
							:class="({ isActive }) => navClass(isActive)">
							<span class="flex min-w-0 items-center gap-3">
								<component
									:is="item.icon"
									class="h-5 w-5 shrink-0 text-current opacity-80 group-hover:opacity-100" />
								<span class="truncate">{{ item.label }}</span>
							</span>
						</RouterLink>
					</div>
				</div>

				<div v-if="hasActiveProject">
					<div
						class="px-3 mb-3 text-[11px] text-gray-500 uppercase tracking-[0.2em]">
						Project Tools
					</div>
					<div class="flex flex-col gap-4">
						<RouterLink
							v-for="item in projectNavItems"
							:key="item.path"
							:to="withProject(item.path)"
							:class="({ isActive }) => navClass(isActive)">
							<span class="flex min-w-0 items-center gap-3">
								<component
									:is="item.icon"
									class="h-5 w-5 shrink-0 text-current opacity-80 group-hover:opacity-100" />
								<span class="truncate">{{ item.label }}</span>
							</span>
						</RouterLink>
					</div>
				</div>
			</nav>

			<div class="border-t border-white/5 p-4 flex gap-2">
				<template v-if="isAuthenticated">
					<div
						class="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/5 flex-1">
						<div
							class="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold">
							OP
						</div>
						<div class="flex-1 overflow-hidden">
							<div class="text-sm font-medium truncate">Operator</div>
							<div class="text-xs text-gray-500 truncate">Level 5 Access</div>
						</div>
					</div>
					<button
						@click="handleLogout"
						class="p-3 bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-xl border border-white/5 transition-colors"
						title="Logout">
						<LogOut class="h-5 w-5" />
					</button>
				</template>
				<template v-else>
					<div
						class="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/5 flex-1 opacity-70">
						<div
							class="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">
							G
						</div>
						<div class="flex-1 overflow-hidden">
							<div class="text-sm font-medium truncate text-gray-400">
								Guest
							</div>
							<div class="text-xs text-gray-600 truncate">Read-Only</div>
						</div>
					</div>
					<RouterLink
						to="/admin"
						class="p-3 bg-white/5 hover:bg-brand-primary/20 text-gray-400 hover:text-brand-primary rounded-xl border border-white/5 transition-colors"
						title="Login">
						<LogIn class="h-5 w-5" />
					</RouterLink>
				</template>
			</div>
		</aside>

		<main class="flex-1 flex flex-col min-w-0 bg-[#0a0a0f]/50">
			<header
				class="h-16 border-b border-glass-border flex items-center justify-between px-8 bg-black/10 backdrop-blur-md">
				<h1 class="text-lg font-semibold tracking-wide">{{ pageTitle }}</h1>
				<button
					class="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all bg-gray-800 text-gray-400 hover:bg-red-900/50 hover:text-red-300"
					title="Nuke Database (Reset All)"
					@click="nukeDatabase">
					<span class="text-lg leading-none">💥</span>
				</button>
			</header>

			<div class="flex-1 overflow-y-auto p-8 scroll-smooth">
				<RouterView />
			</div>
		</main>

		<!-- Nuke Confirmation Modal -->
		<div
			v-if="showNukeModal"
			class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
			<div
				class="bg-[#12141A] border border-red-500/30 rounded-xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
				<div class="flex items-center gap-3 mb-4">
					<div class="p-3 bg-red-500/20 rounded-full">
						<span class="text-2xl">💥</span>
					</div>
					<div>
						<h3 class="text-lg font-bold text-white">Nuke Database?</h3>
						<p class="text-sm text-red-400 font-medium">DANGER ZONE</p>
					</div>
				</div>

				<p class="text-gray-300 text-sm mb-6">
					This will permanently delete
					<strong class="text-white"
						>ALL campaigns, history, and knowledge base data</strong
					>. This action cannot be undone. Are you absolutely sure?
				</p>

				<div class="flex gap-3">
					<button
						class="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors font-medium text-sm"
						@click="showNukeModal = false">
						Cancel
					</button>
					<button
						class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-bold text-sm flex items-center justify-center gap-2"
						:disabled="isNuking"
						@click="confirmNuke">
						<span v-if="isNuking">Nuking...</span>
						<span v-else>Yes, Nuke It</span>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref } from "vue"
	import { RouterLink, RouterView, useRoute, useRouter } from "vue-router"
	import { storeToRefs } from "pinia"
	import { toast } from "vue-sonner"
	import { useAppStore } from "@/stores/app"
	import {
		Activity,
		LayoutDashboard,
		CheckCircle,
		MessageSquare,
		Users,
		Workflow,
		MapPin,
		Book,
		FileText,
		Send,
		ChevronDown,
		FolderOpen,
		LogOut,
		LogIn,
	} from "lucide-vue-next"

	interface ActiveProject {
		id: number
		name: string
		status: string
	}

	const appStore = useAppStore()
	const { selectedProjectId } = storeToRefs(appStore)

	const route = useRoute()
	const router = useRouter()
	const activeProjects = ref<ActiveProject[]>([])
	const isAuthenticated = ref(false)
	const dropdownOpen = ref(false)

	const globalNavItems = [
		{ label: "Portfolio", path: "/dashboard/projects", icon: FolderOpen },
		{ label: "Billing", path: "/dashboard/billing", icon: FileText },
	]

	const projectNavItems = [
		{ label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
		{ label: "Case Manager", path: "/dashboard/chat", icon: MessageSquare },
		{ label: "My Team", path: "/dashboard/team", icon: Users },
		{
			label: "Orchestration",
			path: "/dashboard/orchestration",
			icon: Workflow,
		},
		{ label: "Approvals", path: "/dashboard/approvals", icon: CheckCircle },
		{ label: "Publishing", path: "/dashboard/publishing", icon: Send },
		{ label: "Event Scout", path: "/dashboard/events", icon: MapPin },
		{ label: "Brand Bible", path: "/dashboard/brand", icon: Book },
	]

	const selectedProject = computed(() =>
		activeProjects.value.find(
			(project) => project.id === selectedProjectId.value,
		),
	)

	const hasActiveProject = computed(() => selectedProject.value != null)

	const pageTitle = computed(() => {
		if (route.path === "/dashboard") return "Command Center"
		if (route.path.startsWith("/dashboard/approvals")) return "Approval Queue"
		if (route.path.startsWith("/dashboard/chat")) return "Case Manager"
		if (route.path.startsWith("/dashboard/projects")) return "Project Portfolio"
		return "GrowthOpsAI"
	})

	const withProject = (path: string) => {
		if (!selectedProjectId.value || path === "/dashboard/projects") return path
		const separator = path.includes("?") ? "&" : "?"
		return `${path}${separator}projectId=${selectedProjectId.value}`
	}

	const navClass = (isActive: boolean) => {
		return [
			"group flex items-center gap-3 rounded-xl px-4 py-4 text-sm font-medium transition-all ring-1 ring-transparent",
			isActive
				? "bg-brand-primary/20 text-brand-primary ring-brand-primary/30 shadow-[0_8px_18px_-12px_var(--color-brand-primary)]"
				: "text-slate-300 hover:text-white hover:bg-white/5 hover:ring-white/10",
		]
	}

	const selectProject = (id: number) => {
		appStore.setSelectedProjectId(id)
		dropdownOpen.value = false
	}

	const handleLogout = async () => {
		try {
			await fetch("/api/auth/logout", { method: "POST" })
			isAuthenticated.value = false
			router.push("/admin")
		} catch (e) {
			console.error("Logout failed", e)
			router.push("/admin") // Redirect anyway
		}
	}

	const showNukeModal = ref(false)
	const isNuking = ref(false)

	const nukeDatabase = () => {
		showNukeModal.value = true
	}

	const confirmNuke = async () => {
		isNuking.value = true
		try {
			const res = await fetch("/api/debug/reset", { method: "DELETE" })
			if (!res.ok) {
				const data = (await res.json()) as { error?: string; message?: string }
				toast.error(data.message || data.error || "Failed to nuke database")
				return
			}
			toast.success("Database nuked successfully")
			showNukeModal.value = false
			// Stay on dashboard, just clear state
			window.location.reload()
		} catch (error) {
			toast.error("Network error")
		} finally {
			isNuking.value = false
		}
	}

	onMounted(async () => {
		// Check Session
		try {
			const res = await fetch("/api/auth/session")
			const data = (await res.json()) as { authenticated: boolean }
			isAuthenticated.value = data.authenticated
		} catch (e) {
			isAuthenticated.value = false
		}

		try {
			const res = await fetch("/api/projects", {
				headers: { "x-org-id": "demo-org" },
			})
			const data = await res.json()
			const active = (data.results || []).filter(
				(p: ActiveProject) => p.status === "ACTIVE",
			)
			activeProjects.value = active

			const currentStillValid = active.some(
				(p: ActiveProject) => p.id === selectedProjectId.value,
			)

			if (
				active.length > 0 &&
				(!selectedProjectId.value || !currentStillValid)
			) {
				appStore.setSelectedProjectId(active[0].id)
			}
		} catch (error) {
			console.error("Failed to fetch projects", error)
		}
	})
</script>
