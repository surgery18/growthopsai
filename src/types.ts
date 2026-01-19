export interface Agent {
	id: number
	slug: string
	name: string
	role: string
	status: "idle" | "active" | "paused"
	activity: string
	progress: number
	last_updated?: number
}

export interface Approval {
	id: number
	project_id: number
	type: string
	content: string
	platform: string
	risk: string
	status: "pending" | "approved" | "rejected"
	feedback?: string
	created_at: number
}

export interface AuditLog {
	id: number
	project_id?: number
	timestamp: number
	entity_type: string // 'CAMPAIGN', 'POST', 'PUBLISH_JOB'
	entity_id: number
	action: string // 'APPROVE', 'REJECT', 'CANCEL', 'CREATED', 'PUBLISHED'
	actor: string // 'client', 'agent:name', 'system'
	details?: string // JSON
}

export interface Post {
	id: number
	campaign_id: number
	status: string
	content: string
	current_version_hash?: string
	platform: string
	scheduled_time?: number
	created_at: number
	updated_at: number
}

export interface Project {
	id: string
	org_id: string
	name: string
	industry: string
	website_url?: string
	status: "DRAFT" | "ACTIVE" | "ARCHIVED"
	created_at: number
	updated_at: number
	auth_token?: string // For future use
	active_intake_id?: string
	draft_intake_id?: string
}

export interface ProjectIntakeVersion {
	id: string
	project_id: string
	version_num: number
	status: "DRAFT" | "SUBMITTED" | "ACTIVE" | "SUPERSEDED"
	data_json: string
	ai_context_pack_json?: string
	ai_summary?: string
	created_by: string
	created_at: number
	submitted_at?: number
	activated_at?: number
}

export interface ProjectFile {
	id: string
	project_id: string
	file_kind: string
	filename: string
	size_bytes: number
	created_at: number
}
