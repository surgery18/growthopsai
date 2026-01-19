export interface Agent {
	id: string
	name: string
	role: string
	status: "active" | "idle" | "warning" | "offline"
	activity: string
	avatar: string
}

export interface ProjectSettings {
	primaryMission: string
	kpiGoal: "Revenue" | "Signups" | "Leads"
	constraints: string
	activeAgents: string[]
}

export interface Project {
	id: string
	name: string
	description: string
	status: "active" | "paused" | "archived"
	archived: boolean
	settings: ProjectSettings
	agents: number // Count of active agents
}

export interface ApprovalItem {
	id: string
	projectId: string
	platform: "Twitter" | "LinkedIn" | "Email" | "Blog"
	campaign: string
	content: string
	imagePlaceholder?: boolean
	risk: "low" | "medium" | "high"
	status: "pending" | "approved" | "rejected"
	feedback?: string
	rejectionReason?: string
}

export interface AuditLogEntry {
	id: string
	ts: number
	projectId?: string
	message: string
	actor: "System" | "User" | string
	type: "info" | "warning" | "success" | "danger"
}

export interface ChatMessage {
	id: string
	role: "user" | "assistant"
	content: string
	timestamp: number
}

// -- MOCK DATA --

export const MOCK_AGENTS: Agent[] = [
	{
		id: "hunter",
		name: "Hunter",
		role: "Outreach Specialist",
		status: "active",
		activity: "Prospecting 45 leads...",
		avatar: "🎯",
	},
	{
		id: "marcus",
		name: "Marcus",
		role: "Content Strategist",
		status: "idle",
		activity: "Awaiting approval",
		avatar: "📝",
	},
	{
		id: "nano",
		name: "Nano",
		role: "Data Analyst",
		status: "active",
		activity: "Processing Q3 metrics",
		avatar: "📊",
	},
	{
		id: "vector",
		name: "Vector",
		role: "Compliance Officer",
		status: "warning",
		activity: "Flagged 2 items",
		avatar: "🛡️",
	},
]

export const MOCK_PROJECTS: Project[] = [
	{
		id: "p1",
		name: "Alpha Launch",
		description: "Q1 Product Launch Campaign for SaaS Vertical",
		status: "active",
		archived: false,
		agents: 3,
		settings: {
			primaryMission: "Maximize visibility for the new API feature set.",
			kpiGoal: "Signups",
			constraints: "Avoid aggressive sales language. Keep it educational.",
			activeAgents: ["hunter", "marcus", "nano"],
		},
	},
	{
		id: "p2",
		name: "Enterprise Nurture",
		description: "Long-term email sequence for enterprise leads",
		status: "active",
		archived: false,
		agents: 2,
		settings: {
			primaryMission: "Nurture high-value leads with case studies.",
			kpiGoal: "Leads",
			constraints: "Strict compliance with CAN-SPAM.",
			activeAgents: ["marcus", "vector"],
		},
	},
	{
		id: "p3",
		name: "Legacy Migration",
		description: "Internal documentation update",
		status: "paused",
		archived: false,
		agents: 0,
		settings: {
			primaryMission: "Update all legacy docs to V2 format.",
			kpiGoal: "Leads", // Placeholder
			constraints: "",
			activeAgents: [],
		},
	},
]

export const MOCK_APPROVALS: ApprovalItem[] = [
	{
		id: "a1",
		projectId: "p1",
		platform: "LinkedIn",
		campaign: "Alpha Launch - Week 1",
		content:
			"🚀 We're thrilled to announce the new API! Check out the docs now. #SaaS #DevTools",
		risk: "low",
		status: "pending",
	},
	{
		id: "a2",
		projectId: "p1",
		platform: "Twitter",
		campaign: "Alpha Launch - Viral",
		content:
			"Our competitors are stuck in 2020. Don't be like them. Upgrade now!",
		risk: "medium",
		status: "pending",
	},
	{
		id: "a3",
		projectId: "p2",
		platform: "Email",
		campaign: "Cold Outreach V4",
		content:
			"Subject: Quick question\n\nHey [Name], have you considered that your current stack is failing you?",
		risk: "high",
		status: "pending",
	},
]

export const MOCK_AUDIT_LOG: AuditLogEntry[] = [
	{
		id: "l1",
		ts: Date.now() - 1000 * 60 * 5,
		message: "System initialization complete",
		actor: "System",
		type: "info",
	},
	{
		id: "l2",
		ts: Date.now() - 1000 * 60 * 60,
		message: "Hunter generated 15 new leads",
		actor: "Hunter",
		type: "success",
	},
	{
		id: "l3",
		ts: Date.now() - 1000 * 60 * 120,
		message: "Vector flagged mock content for review",
		actor: "Vector",
		type: "warning",
	},
]
