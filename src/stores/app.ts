import { defineStore } from "pinia"
import { ref, watch } from "vue"
import {
	MOCK_PROJECTS,
	MOCK_APPROVALS,
	MOCK_AUDIT_LOG,
	type Project,
	type ApprovalItem,
	type AuditLogEntry,
	type ChatMessage,
} from "@/data/mock"

const loadJson = <T>(key: string, fallback: T) => {
	if (typeof window === "undefined") return fallback
	const saved = localStorage.getItem(key)
	return saved ? (JSON.parse(saved) as T) : fallback
}

export const useAppStore = defineStore("app", () => {
	const projects = ref<Project[]>(loadJson("growthops_projects", MOCK_PROJECTS))
	const approvals = ref<ApprovalItem[]>(
		loadJson("growthops_approvals", MOCK_APPROVALS),
	)
	const auditLog = ref<AuditLogEntry[]>(
		loadJson("growthops_audit", MOCK_AUDIT_LOG),
	)
	const chats = ref<Record<string, ChatMessage[]>>(
		loadJson("growthops_chats", {}),
	)
	const systemPaused = ref<boolean>(
		loadJson("growthops_paused", false),
	)
	const selectedProjectId = ref<number | null>(
		loadJson("growthops_selectedProject", null),
	)

	watch(
		projects,
		(val) => localStorage.setItem("growthops_projects", JSON.stringify(val)),
		{ deep: true },
	)
	watch(
		approvals,
		(val) => localStorage.setItem("growthops_approvals", JSON.stringify(val)),
		{ deep: true },
	)
	watch(
		auditLog,
		(val) => localStorage.setItem("growthops_audit", JSON.stringify(val)),
		{ deep: true },
	)
	watch(
		chats,
		(val) => localStorage.setItem("growthops_chats", JSON.stringify(val)),
		{ deep: true },
	)
	watch(systemPaused, (val) => {
		localStorage.setItem("growthops_paused", JSON.stringify(val))
	})
	watch(selectedProjectId, (val) => {
		localStorage.setItem("growthops_selectedProject", JSON.stringify(val))
	})

	const addAuditLog = (
		message: string,
		type: AuditLogEntry["type"] = "info",
		actor: string = "User",
	) => {
		const newEntry: AuditLogEntry = {
			id: crypto.randomUUID(),
			ts: Date.now(),
			message,
			type,
			actor,
		}
		auditLog.value = [newEntry, ...auditLog.value].slice(0, 100)
	}

	const toggleSystemPause = () => {
		const newState = !systemPaused.value
		systemPaused.value = newState
		addAuditLog(
			newState
				? "Global Kill Switch ACTIVATED"
				: "System resumed normal operations",
			newState ? "danger" : "success",
			"System",
		)
	}

	const updateProject = (id: string, updates: Partial<Project>) => {
		projects.value = projects.value.map((project) =>
			project.id === id ? { ...project, ...updates } : project,
		)
		addAuditLog(`Updated project ${id}`, "info")
	}

	const approveItem = (id: string) => {
		approvals.value = approvals.value.map((item) =>
			item.id === id ? { ...item, status: "approved" } : item,
		)
		addAuditLog(`Approved item ${id}`, "success")
	}

	const rejectItem = (id: string, feedback: string) => {
		approvals.value = approvals.value.map((item) =>
			item.id === id ? { ...item, status: "rejected", feedback } : item,
		)
		addAuditLog(`Rejected item ${id}: ${feedback}`, "warning")
	}

	const addChatMessage = (projectId: string, message: ChatMessage) => {
		chats.value = {
			...chats.value,
			[projectId]: [...(chats.value[projectId] || []), message],
		}
	}

	const setSelectedProjectId = (id: number | null) => {
		selectedProjectId.value = id
	}

	return {
		projects,
		approvals,
		auditLog,
		chats,
		systemPaused,
		selectedProjectId,
		addAuditLog,
		toggleSystemPause,
		updateProject,
		approveItem,
		rejectItem,
		addChatMessage,
		setSelectedProjectId,
	}
})
