import { Hono } from "hono"
import { GrowthOpsWorkflow } from "./workflow"
import { IntakeWorkflow } from "./intake_workflow"
import { EventScoutWorkflow } from "./event_scout_workflow"
import { CampaignDO } from "./campaign_do"
import { routeContext } from "./context_router"
import {
	reindexProjectKnowledge,
	syncProjectKnowledgeFromIntake,
} from "./knowledge"
import type { KnowledgeContextType, KnowledgeTaskType } from "./knowledge"

const app = new Hono<{ Bindings: Env }>()

// ==========================================
// PUBLISHING STUDIO API
// ==========================================
app.get("/api/publishing/dashboard", async (c) => {
	const projectId = c.req.query("projectId")
	if (!projectId) {
		return c.json({ posts: [], campaigns: [], publishJobs: [] })
	}

	const [posts, campaigns, publishJobs] = await Promise.all([
		c.env.DB.prepare(
			`SELECT p.* FROM posts p 
             INNER JOIN campaigns c ON p.campaign_id = c.id 
             WHERE c.project_id = ? AND p.status IN ('CLIENT_APPROVED', 'PUBLISHED') 
             ORDER BY p.updated_at DESC`,
		)
			.bind(projectId)
			.all(),
		c.env.DB.prepare("SELECT * FROM campaigns WHERE project_id = ?")
			.bind(projectId)
			.all(),
		c.env.DB.prepare(
			`SELECT pj.* FROM publish_jobs pj
             INNER JOIN posts p ON pj.post_id = p.id
             INNER JOIN campaigns c ON p.campaign_id = c.id
             WHERE c.project_id = ? AND pj.status != 'CANCELLED' 
             ORDER BY pj.created_at DESC`,
		)
			.bind(projectId)
			.all(),
	])

	return c.json({
		posts: posts.results,
		campaigns: campaigns.results,
		publishJobs: publishJobs.results,
	})
})

// ... (code omitted for brevity)

// ==========================================
// CAMPAIGN API (VIA DURABLE OBJECT)
// ==========================================

// Create new Campaign (Brain)
app.post("/api/campaigns", async (c) => {
	const formData = await c.req.parseBody()
	const name = (formData["name"] as string) || "Untitled Campaign"
	const projectId = (formData["projectId"] as string) || "1" // Default to first project for now

	// 1. Generate DO ID
	const id = c.env.CAMPAIGN_DO.newUniqueId()
	const idStr = id.toString()

	// 2. Save to D1
	const res = await c.env.DB.prepare(
		"INSERT INTO campaigns (project_id, name, do_id) VALUES (?, ?, ?) RETURNING *",
	)
		.bind(projectId, name, idStr)
		.first()

	return c.json(res)
})

// POST /api/campaigns/daily - Create/Fetch Daily Strategy Campaign
app.post("/api/campaigns/daily", async (c) => {
	const { projectId } = await c.req.json<{ projectId: string }>()
	if (!projectId) return c.json({ error: "Project ID required" }, 400)

	// 1. Check for existing "Daily Strategy" campaign for today
	const dateStr = new Date().toLocaleDateString("en-CA") // YYYY-MM-DD
	// Match both new naming and legacy naming just in case
	const existing = await c.env.DB.prepare(
		"SELECT * FROM campaigns WHERE project_id = ? AND (name = ? OR name = ?)",
	)
		.bind(
			projectId,
			`Daily Strategy - ${dateStr}`,
			`Daily Marketing Push - ${dateStr}`,
		)
		.first<{ id: number; do_id: string }>()

	if (existing) {
		return c.json({
			success: true,
			message: "Campaign already active",
			campaignId: existing.id,
		})
	}

	// 2. Create New Campaign
	const doId = c.env.CAMPAIGN_DO.newUniqueId()
	const doIdStr = doId.toString()
	const now = Date.now()
	const campaignName = `Daily Strategy - ${dateStr}`

	try {
		const result = await c.env.DB.prepare(
			"INSERT INTO campaigns (project_id, name, status, do_id) VALUES (?, ?, ?, ?) RETURNING id",
		)
			.bind(projectId, campaignName, "ACTIVE", doIdStr)
			.first<{ id: number }>()

		if (!result) throw new Error("Failed to create campaign record")

		// 3. Trigger the Daily Pipeline
		const stub = c.env.CAMPAIGN_DO.get(doId)
		const prompt = `Generate a Daily Strategy Plan and Content for ${dateStr}`

		// Call the specialized endpoint we just added
		await stub.fetch("http://internal/daily-strategy", {
			method: "POST",
			body: JSON.stringify({
				message: prompt,
				timestamp: now,
			}),
		})

		return c.json({
			success: true,
			message: "Daily strategy process started",
			campaignId: result.id,
		})
	} catch (e: any) {
		console.error("Daily Campaign Error:", e)
		return c.json({ error: e.message }, 500)
	}
})

// List Campaigns (filtered by projectId if provided)
app.get("/api/campaigns", async (c) => {
	const projectId = c.req.query("projectId")

	let query = "SELECT * FROM campaigns"
	const params: any[] = []

	if (projectId) {
		query += " WHERE project_id = ?"
		params.push(projectId)
	}
	query += " ORDER BY created_at DESC"

	const stmt = c.env.DB.prepare(query)
	const { results } =
		params.length > 0 ? await stmt.bind(...params).all() : await stmt.all()
	return c.json({ results })
})

// Chat with Campaign Brain
app.post("/api/chat", async (c) => {
	const formData = await c.req.parseBody()
	const campaignId = formData["campaignId"] as string // This is the DB ID (integer) or DO ID (string)?
	// Let's assume frontend sends the DO ID directly for speed, or we look it up.
	// For simplicity, let's say the frontend sends the DO ID as "campaignId".
	// WAIT: frontend usually has the DB ID (e.g. 1, 2).
	// We should look up the DO ID if integer.

	let doIdStr = campaignId

	// Heuristic: DO IDs are long strings (32+ chars hex). DB IDs are integers.
	// We'll trust the frontend sends the DO ID (do_id column) if they have it.

	const content = formData["content"] as string
	const role = (formData["role"] as string) || "user"
	const timestamp = formData["timestamp"] as string

	if (!campaignId || !content) return c.json({ error: "Missing data" }, 400)

	// Only lock campaigns that have been explicitly approved by the user or published
	// READY_FOR_APPROVAL should remain unlocked so users can review, approve, or request changes
	const lockedStatuses = new Set([
		"CLIENT_APPROVED",
		"READY_TO_PUBLISH",
		"PUBLISHING",
		"PUBLISHED",
		"COMPLETED",
		"CANCELLED",
		"CLIENT_VISIBLE",
	])
	const campaignStatus = await c.env.DB.prepare(
		"SELECT id, status FROM campaigns WHERE do_id = ? OR id = ?",
	)
		.bind(doIdStr, campaignId)
		.first<{ id: number; status: string }>()
	const status = campaignStatus?.status?.toUpperCase()
	if (status && lockedStatuses.has(status)) {
		return c.json(
			{ error: "Campaign already closed.", status },
			409,
		)
	}
	if (campaignStatus?.id) {
		const totalPosts = await c.env.DB.prepare(
			"SELECT COUNT(*) as count FROM posts WHERE campaign_id = ?",
		)
			.bind(campaignStatus.id)
			.first<{ count: number }>()
		if (totalPosts?.count && totalPosts.count > 0) {
			const pendingPosts = await c.env.DB.prepare(
				`SELECT COUNT(*) as count FROM posts
				 WHERE campaign_id = ?
				 AND status NOT IN ('CLIENT_APPROVED', 'PUBLISHED', 'CANCELLED')`,
			)
				.bind(campaignStatus.id)
				.first<{ count: number }>()
			if (pendingPosts && pendingPosts.count === 0) {
				return c.json(
					{ error: "Campaign already closed.", status: "CLIENT_APPROVED" },
					409,
				)
			}
		}
	}

	// Route to Durable Object
	try {
		const id = c.env.CAMPAIGN_DO.idFromString(doIdStr)
		const stub = c.env.CAMPAIGN_DO.get(id)

		return await stub.fetch("http://internal/chat", {
			method: "POST",
			body: JSON.stringify({
				message: content,
				role,
				timestamp: parseInt(timestamp || "0") || Date.now(),
			}),
		})
	} catch (e) {
		return c.json({ error: "Invalid Campaign ID" }, 400)
	}
})

// Get Campaign Status
app.get("/api/campaigns/:id", async (c) => {
	const idStr = c.req.param("id") // Expecting DO ID
	try {
		const id = c.env.CAMPAIGN_DO.idFromString(idStr)
		const stub = c.env.CAMPAIGN_DO.get(id)
		return await stub.fetch("http://internal/status")
	} catch (e) {
		return c.json({ error: "Invalid ID" }, 400)
	}
})

// Trigger Campaign Action (PM State Machine)
app.post("/api/campaigns/:id/action", async (c) => {
	const idStr = c.req.param("id")
	const body = await c.req.json()

	try {
		const id = c.env.CAMPAIGN_DO.idFromString(idStr)
		const stub = c.env.CAMPAIGN_DO.get(id)

		// Forward to DO
		return await stub.fetch("http://internal/action", {
			method: "POST",
			body: JSON.stringify(body),
		})
	} catch (e) {
		return c.json({ error: "Invalid ID" }, 400)
	}
})

// Approvals (Routed through DO for logic, but might still use DB for list view?
// For now, let's keep the DB-based list view in /api/approvals (legacy) active until Frontend fully pivots.
// But Actions should go to DO.

app.post("/api/approvals", async (c) => {
	const formData = await c.req.parseBody()
	const id = formData["id"] as string
	const action = formData["action"] as string
	const feedback = formData["feedback"] as string

	// Ideally we'd know which Campaign DO this approval belongs to.
	// We might need to store campaign_id in the approvals table.
	// For now, just update DB directly as legacy fallback, OR if we had the DO ID we'd call it.

	// Legacy DB Update (to keep UI working without massive frontend refactor)
	if (action === "approve") {
		await c.env.DB.prepare(
			"UPDATE approvals SET status = 'client_visible' WHERE id = ?",
		)
			.bind(id)
			.run()
	} else if (action === "reject") {
		await c.env.DB.prepare(
			"UPDATE approvals SET status = 'revision_required', feedback = ? WHERE id = ?",
		)
			.bind(feedback, id)
			.run()
	}

	return c.json({ success: true })
})

// ==========================================
// CLIENT APPROVAL API (MANUAL MODE)
// ==========================================

async function generateHash(content: string): Promise<string> {
	const msgBuffer = new TextEncoder().encode(content)
	const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// 1) CLIENT APPROVE POST
app.post("/api/client/posts/:postId/approve", async (c) => {
	const postId = c.req.param("postId")
	// Client ID/Actor would normally come from auth context. Mocking for now.
	const actor = "client:user"

	// 1. Get current post
	const post = await c.env.DB.prepare("SELECT * FROM posts WHERE id = ?")
		.bind(postId)
		.first<any>()

	if (!post) return c.json({ error: "Post not found" }, 404)

	// Guardrail: Campaign Check
	const campaign = await c.env.DB.prepare(
		"SELECT * FROM campaigns WHERE id = ?",
	)
		.bind(post.campaign_id)
		.first<any>()

	if (campaign && campaign.status === "CANCELLED") {
		return c.json({ error: "Campaign is cancelled. Cannot approve." }, 400)
	}

	if (post.status === "CLIENT_APPROVED") {
		return c.json({ error: "Post already approved" }, 400)
	}

	// 2. Calculate and Verify Hash
	const currentHash = await generateHash(post.content)
	// If post has a hash already, verify it
	if (post.current_version_hash && post.current_version_hash !== currentHash) {
		// This is a data integrity error
		return c.json({ error: "Version mismatch (integrity check failed)" }, 500)
	}

	// 3. Transaction
	try {
		await c.env.DB.batch([
			// Lock the post
			c.env.DB.prepare(
				"UPDATE posts SET status = 'CLIENT_APPROVED', current_version_hash = ? WHERE id = ?",
			).bind(currentHash, postId),

			// Record Approval
			c.env.DB.prepare(
				"INSERT INTO client_approvals (post_id, version_hash, client_id) VALUES (?, ?, ?)",
			).bind(postId, currentHash, actor),

			// Audit
			c.env.DB.prepare(
				"INSERT INTO audit_log (entity_type, entity_id, action, actor, details, timestamp, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
			).bind(
				"POST",
				postId,
				"APPROVE",
				actor,
				JSON.stringify({ version_hash: currentHash }),
				Date.now(),
				campaign.project_id,
			),

			// Prepare Publish Job (Manual Mode - No auto-run)
			c.env.DB.prepare(
				"INSERT INTO publish_jobs (campaign_id, post_id, version_hash, platform, status) VALUES (?, ?, ?, ?, 'PENDING')",
			).bind(
				post.campaign_id,
				postId,
				currentHash,
				post.platform || "unknown"
			),
		])

		const pendingPosts = await c.env.DB.prepare(
			`SELECT COUNT(*) as count FROM posts
			 WHERE campaign_id = ?
			 AND status NOT IN ('CLIENT_APPROVED', 'PUBLISHED', 'CANCELLED')`,
		)
			.bind(post.campaign_id)
			.first<{ count: number }>()

		if (pendingPosts && pendingPosts.count === 0) {
			await c.env.DB.prepare(
				"UPDATE campaigns SET status = 'CLIENT_APPROVED' WHERE id = ? AND status NOT IN ('CANCELLED', 'COMPLETED', 'PUBLISHED')",
			)
				.bind(post.campaign_id)
				.run()
		}

		return c.json({
			success: true,
			message: "Post approved",
			version_hash: currentHash,
		})
	} catch (e: any) {
		return c.json({ error: "Approval failed", details: e.message }, 500)
	}
})

// 2) CLIENT REJECT POST
app.post("/api/client/posts/:postId/reject", async (c) => {
	const postId = c.req.param("postId")
	const { reason, category } = await c.req.json<{
		reason: string
		category?: string
	}>()
	const actor = "client:user"
	const db = c.env.DB
	const now = Date.now()

	if (!reason) return c.json({ error: "Rejection reason is required" }, 400)

	const post = await db
		.prepare("SELECT * FROM posts WHERE id = ?")
		.bind(postId)
		.first<any>()
	if (!post) return c.json({ error: "Post not found" }, 404)

	// Fetch campaign for project_id
	const campaign = await db
		.prepare("SELECT project_id, do_id FROM campaigns WHERE id = ?")
		.bind(post.campaign_id)
		.first<{ project_id: number; do_id: string }>()

	try {
		// 1. Update Post Status
		await db
			.prepare(
				"UPDATE posts SET status = 'CLIENT_CHANGES_REQUESTED' WHERE id = ?",
			)
			.bind(postId)
			.run()

		// 2. Add Revision History / Feedback
		await db
			.prepare(
				`INSERT INTO post_revisions (post_id, version_hash, content, created_by, reason)
				 VALUES (?, ?, ?, ?, ?)`,
			)
			.bind(
				Number(post.id),
				post.current_version_hash || "unknown",
				post.content || "REJECTED_CONTENT_PLACEHOLDER",
				"client",
				reason,
			)
			.run()

		// 3. Cancel any existing Publish Jobs for this post
		await db
			.prepare(
				"UPDATE publish_jobs SET status = 'CANCELLED' WHERE post_id = ? AND status != 'PUBLISHED'",
			)
			.bind(postId)
			.run()

		// 4. Create Internal Task for Revision
		await db
			.prepare(
				`INSERT INTO tasks (type, status, priority, campaign_id, post_id, description, payload)
				 VALUES ('CLIENT_CHANGE_REQUEST', 'OPEN', 'HIGH', ?, ?, ?, ?)`,
			)
			.bind(
				post.campaign_id,
				post.id,
				`Client rejected post #${post.id}: ${reason}`,
				JSON.stringify({ reason, category })
			)
			.run()

		// 5. Audit Log
		await db
			.prepare(
				"INSERT INTO audit_log (entity_type, entity_id, action, actor, details, timestamp, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
			)
			.bind(
				"POST",
				post.id,
				"REJECT",
				actor,
				JSON.stringify({ reason, category }),
				now,
				campaign?.project_id,
			)
			.run()

		// Notify Campaign DO (The Brain) to start revision
		// We need the DO ID.
		if (campaign && campaign.do_id) {
			const id = c.env.CAMPAIGN_DO.idFromString(campaign.do_id)
			const stub = c.env.CAMPAIGN_DO.get(id)
			// Fire and forget or await
			await stub.fetch("http://internal/action", {
				method: "POST",
				body: JSON.stringify({ action: "reject", feedback: reason, postId }),
			})
		}

		// 6. Update Campaign Status to reflect active revision
		await db
			.prepare("UPDATE campaigns SET status = 'IN_PROGRESS' WHERE id = ?")
			.bind(post.campaign_id)
			.run()

		return c.json({
			success: true,
			message: "Post rejected",
			status: "CLIENT_CHANGES_REQUESTED",
		})
	} catch (e: any) {
		return c.json({ error: "Rejection failed", details: e.message }, 500)
	}
})

// 3) CLIENT DELETE CAMPAIGN (CANCEL)
app.post("/api/client/campaigns/:campaignId/cancel", async (c) => {
	const campaignId = c.req.param("campaignId")
	const actor = "client:user"

	// 1. Validate
	const campaign = await c.env.DB.prepare(
		"SELECT * FROM campaigns WHERE id = ?",
	)
		.bind(campaignId)
		.first<any>()
	if (!campaign) return c.json({ error: "Campaign not found" }, 404)

	try {
		// 2. Cancel Everything
		await c.env.DB.batch([
			// Update Campaign
			c.env.DB.prepare(
				"UPDATE campaigns SET status = 'CANCELLED' WHERE id = ?",
			).bind(campaignId),

			// Cancel Posts
			c.env.DB.prepare(
				"UPDATE posts SET status = 'CANCELLED' WHERE campaign_id = ? AND status != 'PUBLISHED'",
			).bind(campaignId),

			// Cancel Publish Jobs
			c.env.DB.prepare(
				"UPDATE publish_jobs SET status = 'CANCELLED' WHERE campaign_id = ? AND status IN ('PENDING', 'PROCESSING')",
			).bind(campaignId),

			// Audit
			c.env.DB.prepare(
				"INSERT INTO audit_log (entity_type, entity_id, action, actor, timestamp, project_id) VALUES (?, ?, ?, ?, ?, ?)",
			).bind(
				"CAMPAIGN",
				campaignId,
				"CANCEL",
				actor,
				Date.now(),
				campaign.project_id,
			),
		])

		return c.json({ success: true, message: "Campaign cancelled" })
	} catch (e: any) {
		return c.json({ error: "Cancellation failed", details: e.message }, 500)
	}
})

// 4) CLIENT MARK START/PUBLISHED (External Webhook or Manual Action)
// POST /api/client/publish_jobs/:id/mark_published
app.post("/api/client/publish_jobs/:id/mark_published", async (c) => {
	const jobId = c.req.param("id")
	const now = Date.now()
	const db = c.env.DB

	try {
		// 1. Get Job details
		const job = await db
			.prepare("SELECT * FROM publish_jobs WHERE id = ?")
			.bind(jobId)
			.first<{ id: number; campaign_id: number; post_id: number }>()

		if (!job) return c.json({ error: "Publish Job not found" }, 404)

		await db.batch([
			// 2. Update Job Status
			db
				.prepare(
					"UPDATE publish_jobs SET status = 'PUBLISHED' WHERE id = ?",
				)
				.bind(jobId),

			// 3. Update Post Status
			db
				.prepare(
					"UPDATE posts SET status = 'PUBLISHED' WHERE id = ?",
				)
				.bind(job.post_id),

			// 4. Audit Log
			db
				.prepare(
					"INSERT INTO audit_log (entity_type, entity_id, action, actor, timestamp) VALUES ('PUBLISH_JOB', ?, 'PUBLISHED', 'client', ?)",
				)
				.bind(jobId, now),
		])

		// 5. Check Campaign Completion
		const pendingPosts = await db
			.prepare(
				`SELECT COUNT(*) as count FROM posts 
         WHERE campaign_id = ? 
         AND status NOT IN ('PUBLISHED', 'CANCELLED')`,
			)
			.bind(job.campaign_id)
			.first<{ count: number }>()

		if (pendingPosts && pendingPosts.count === 0) {
			await db.batch([
				db
					.prepare("UPDATE campaigns SET status = 'COMPLETED' WHERE id = ?")
					.bind(job.campaign_id),

				db
					.prepare(
						"INSERT INTO audit_log (entity_type, entity_id, action, actor, timestamp) VALUES ('CAMPAIGN', ?, 'COMPLETED', 'system', ?)",
					)
					.bind(job.campaign_id, now),
			])
		}

		return c.json({ success: true })
	} catch (e: any) {
		console.error("Mark Published Error:", e)
		return c.json(
			{ error: "Failed to mark published", details: e.message },
			500,
		)
	}
})

// 5) EXECUTE PUBLISH JOB (Send to X)
app.post("/api/publish-jobs/:id/run", async (c) => {
	const jobId = c.req.param("id")
	const now = Date.now()
	const db = c.env.DB

	// 1. Get Job & Post details
	const job = await db
		.prepare(
			`SELECT pj.*, p.content 
             FROM publish_jobs pj
             INNER JOIN posts p ON pj.post_id = p.id
             WHERE pj.id = ?`,
		)
		.bind(jobId)
		.first<{
			id: number
			campaign_id: number
			post_id: number
			platform: string
			content: string
			status: string
		}>()

	if (!job) return c.json({ error: "Publish Job not found" }, 404)
	if (job.status === "PUBLISHED")
		return c.json({ error: "Job already published" }, 400)

	// 2. Initialize Service based on platform
	if (
		job.platform.toLowerCase() !== "twitter" &&
		job.platform.toLowerCase() !== "x"
	) {
		// Fallback for now, or error.
		// If the platform is generic "social", maybe default to twitter?
		// For safety, let's require "twitter" or "x".
		// Actually, let's just proceed if we have twitter creds, assuming it's for twitter.
	}

	try {
		// 3. Publish (disabled)
		const rootId = "DISABLED"

		// 5. Update DB (Success)
		await db.batch([
			// Update Job
			db
				.prepare(
					"UPDATE publish_jobs SET status = 'PUBLISHED', external_post_id = ? WHERE id = ?",
				)
				.bind(rootId, jobId),

			// Update Post
			db
				.prepare(
					"UPDATE posts SET status = 'PUBLISHED' WHERE id = ?",
				)
				.bind(job.post_id),

			// Audit Log
			db
				.prepare(
					"INSERT INTO audit_log (entity_type, entity_id, action, actor, details, timestamp) VALUES ('PUBLISH_JOB', ?, 'PUBLISHED_X', 'system', ?, ?)",
				)
				.bind(
					jobId,
					JSON.stringify({ external_id: rootId, publish_skipped: true }),
					now,
				),
		])

		const pendingPosts = await db
			.prepare(
				`SELECT COUNT(*) as count FROM posts
         WHERE campaign_id = ?
         AND status NOT IN ('PUBLISHED', 'CANCELLED')`,
			)
			.bind(job.campaign_id)
			.first<{ count: number }>()

		if (pendingPosts && pendingPosts.count === 0) {
			await db.batch([
				db
					.prepare(
						"UPDATE campaigns SET status = 'COMPLETED' WHERE id = ? AND status NOT IN ('CANCELLED')",
					)
					.bind(job.campaign_id),
				db
					.prepare(
						"INSERT INTO audit_log (entity_type, entity_id, action, actor, timestamp) VALUES ('CAMPAIGN', ?, 'COMPLETED', 'system', ?)",
					)
					.bind(job.campaign_id, now),
			])
		}

		return c.json({ success: true, external_id: rootId })
	} catch (e: any) {
		console.error("Publish Error:", e)
		// Record failure
		await db
			.prepare(
				"UPDATE publish_jobs SET status = 'FAILED', last_error = ?, attempt_count = attempt_count + 1 WHERE id = ?",
			)
			.bind(e.message, jobId)
			.run()

		return c.json({ error: "Publish failed", details: e.message }, 500)
	}
})

// ==========================================
// LEGACY / SUPPORT ROUTES
// ==========================================

// GET /api/approvals (List View)
app.get("/api/approvals", async (c) => {
	const { results } = await c.env.DB.prepare(
		"SELECT * FROM approvals WHERE status = 'pending' OR status = 'exec_review_complete' ORDER BY created_at DESC",
	).all()
	return c.json({ results })
})

// GET /api/approvals/queue (Consolidated View for Approvals UI)
app.get("/api/approvals/queue", async (c) => {
	const projectId = c.req.query("projectId")
	if (!projectId) {
		return c.json({ posts: [], campaigns: [], publishJobs: [], revisions: [] })
	}

	const [posts, campaigns, publishJobs, revisions] = await Promise.all([
		c.env.DB.prepare(
			`SELECT p.* FROM posts p 
             INNER JOIN campaigns c ON p.campaign_id = c.id 
             WHERE c.project_id = ? 
             AND p.status IN ('INTERNAL_APPROVED', 'CLIENT_APPROVED', 'CLIENT_CHANGES_REQUESTED', 'PUBLISHED', 'CANCELLED') 
             ORDER BY p.created_at DESC`,
		)
			.bind(projectId)
			.all(),

		c.env.DB.prepare("SELECT * FROM campaigns WHERE project_id = ?")
			.bind(projectId)
			.all(),

		c.env.DB.prepare(
			`SELECT pj.* FROM publish_jobs pj
             INNER JOIN posts p ON pj.post_id = p.id
             INNER JOIN campaigns c ON p.campaign_id = c.id
             WHERE c.project_id = ? AND pj.status != 'CANCELLED' 
             ORDER BY pj.created_at DESC`,
		)
			.bind(projectId)
			.all(),

		c.env.DB.prepare(
			`SELECT pr.* FROM post_revisions pr
             INNER JOIN posts p ON pr.post_id = p.id
             INNER JOIN campaigns c ON p.campaign_id = c.id
             WHERE c.project_id = ? AND pr.reason IS NOT NULL`,
		)
			.bind(projectId)
			.all(),
	])

	return c.json({
		posts: posts.results,
		campaigns: campaigns.results,
		publishJobs: publishJobs.results,
		revisions: revisions.results,
	})
})

// GET /api/runs/:id (Trace View)
app.get("/api/runs/:id", async (c) => {
	const id = c.req.param("id")

	const run = await c.env.DB.prepare("SELECT * FROM runs WHERE id = ?")
		.bind(id)
		.first()
	const { results: steps } = await c.env.DB.prepare(
		"SELECT * FROM run_steps WHERE run_id = ? ORDER BY created_at ASC",
	)
		.bind(id)
		.all()

	if (!run) return c.json({ error: "Run not found" }, 404)

	return c.json({ run, steps })
})

// ==========================================
// PROJECT INTAKE API
// ==========================================

// Helper: Get Auth Context (Stub)
// In a real app, this would verify a JWT or session.
// Here we assume the gateway/middleware injects 'x-org-id' and 'x-actor-id'.
function getAuth(c: any) {
	const orgId = c.req.header("x-org-id") || "default-org"
	const actorId = c.req.header("x-actor-id") || "system"
	return { orgId, actorId }
}

// 1. Projects
// POST /api/projects - Create Project + v1 Draft
app.post("/api/projects", async (c) => {
	const { orgId, actorId } = getAuth(c)
	const body = await c.req.json<{
		name: string
		industry: string
		website_url?: string
	}>()

	if (!body.name) return c.json({ error: "Name is required" }, 400)

	const now = Date.now()

	try {
		// 1. Create Project (Sequential to get ID)
		// We use RETURNING * to capture the generated ID (AutoIncrement Integer)
		const projectRes = await c.env.DB.prepare(
			"INSERT INTO projects (org_id, name, industry, website_url, status) VALUES (?, ?, ?, ?, ?) RETURNING *",
		)
			.bind(
				orgId,
				body.name,
				body.industry || "Other",
				body.website_url || null,
				"DRAFT"
			)
			.first()

		if (!projectRes) throw new Error("Failed to create project")
		const projectId = projectRes.id // Integer

		// 2. Create v1 Draft Intake
		const intakeId = crypto.randomUUID()
		await c.env.DB.prepare(
			"INSERT INTO project_intake_versions (id, project_id, version_num, status, data_json, created_by) VALUES (?, ?, ?, ?, ?, ?)",
		)
			.bind(
				intakeId,
				projectId,
				1,
				"DRAFT",
				JSON.stringify({
					project_basics: {
						project_name: body.name,
						industry: body.industry,
						website_url: body.website_url,
					},
				}),
				actorId
			)
			.run()

		// 3. Audit Log
		await c.env.DB.prepare(
			"INSERT INTO audit_log (entity_type, entity_id, action, actor, details, timestamp, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
			.bind(
				"PROJECT",
				String(projectId),
				"PROJECT_CREATED",
				actorId,
				JSON.stringify({ name: body.name }),
				now,
				projectId,
			)
			.run()

		return c.json(
			{
				project: projectRes,
				intakeId,
				projectId: projectRes.id,
			},
			201,
		)
	} catch (e: any) {
		return c.json(
			{ error: "Failed to create project", details: e.message },
			500,
		)
	}
})

// GET /api/projects - List Projects
app.get("/api/projects", async (c) => {
	const { orgId } = getAuth(c)

	const query = `
    SELECT 
      p.*,
      (SELECT id FROM project_intake_versions WHERE project_id = p.id AND status = 'ACTIVE' ORDER BY version_num DESC LIMIT 1) as active_intake_id,
      (SELECT id FROM project_intake_versions WHERE project_id = p.id AND status = 'DRAFT' ORDER BY version_num DESC LIMIT 1) as draft_intake_id
    FROM projects p
    WHERE p.org_id = ?
    ORDER BY p.updated_at DESC
  `

	const { results } = await c.env.DB.prepare(query).bind(orgId).all()
	return c.json({ results })
})

// GET /api/projects/:id - Project Details
app.get("/api/projects/:id", async (c) => {
	const { orgId } = getAuth(c)
	const projectId = c.req.param("id")

	const project = await c.env.DB.prepare(
		"SELECT * FROM projects WHERE id = ? AND org_id = ?",
	)
		.bind(projectId, orgId)
		.first()

	if (!project) return c.json({ error: "Project not found" }, 404)

	const activeIntake = await c.env.DB.prepare(
		"SELECT * FROM project_intake_versions WHERE project_id = ? AND status = 'ACTIVE' ORDER BY version_num DESC LIMIT 1",
	)
		.bind(projectId)
		.first()

	const draftIntake = await c.env.DB.prepare(
		"SELECT * FROM project_intake_versions WHERE project_id = ? AND status = 'DRAFT' ORDER BY version_num DESC LIMIT 1",
	)
		.bind(projectId)
		.first()

	const files = await c.env.DB.prepare(
		"SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at DESC",
	)
		.bind(projectId)
		.all()

	const history = await c.env.DB.prepare(
		"SELECT * FROM project_intake_versions WHERE project_id = ? ORDER BY version_num DESC LIMIT 5",
	)
		.bind(projectId)
		.all()

	return c.json({
		project,
		activeIntake,
		draftIntake,
		files: files.results,
		history: history.results,
	})
})

// PATCH /api/projects/:id - Update Metadata
app.patch("/api/projects/:id", async (c) => {
	const { orgId, actorId } = getAuth(c)
	const projectId = c.req.param("id")
	const body = await c.req.json<any>()

	const allowed = ["name", "industry", "website_url", "status"]
	const updates: string[] = []
	const start: any[] = []

	for (const key of Object.keys(body)) {
		if (allowed.includes(key)) {
			updates.push(`${key} = ?`)
			start.push(body[key])
		}
	}

	if (updates.length === 0) return c.json({ error: "No valid fields" }, 400)

	start.push(projectId)
	start.push(orgId)

	try {
		const res = await c.env.DB.prepare(
			`UPDATE projects SET ${updates.join(", ")} WHERE id = ? AND org_id = ? RETURNING *`,
		)
			.bind(...start)
			.first()

		if (!res)
			return c.json({ error: "Project not found or update failed" }, 404)

		// Audit
		await c.env.DB.prepare(
			"INSERT INTO audit_log (entity_type, entity_id, action, actor, details, timestamp, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
			.bind(
				"PROJECT",
				projectId,
				"PROJECT_UPDATED",
				actorId,
				JSON.stringify(body),
				Date.now(),
				projectId,
			)
			.run()

		return c.json(res)
	} catch (e: any) {
		return c.json({ error: "Update failed", details: e.message }, 500)
	}
})

// 2. Intake Versions

// POST /api/projects/:projectId/intake/draft - Create Draft from Active
app.post("/api/projects/:projectId/intake/draft", async (c) => {
	const { orgId, actorId } = getAuth(c)
	const projectId = c.req.param("projectId")

	// Verify project ownership
	const project = await c.env.DB.prepare(
		"SELECT id FROM projects WHERE id = ? AND org_id = ?",
	)
		.bind(projectId, orgId)
		.first()
	if (!project) return c.json({ error: "Project not found" }, 404)

	// Get latest active to seed from
	const active = await c.env.DB.prepare(
		"SELECT data_json, version_num FROM project_intake_versions WHERE project_id = ? AND status = 'ACTIVE' ORDER BY version_num DESC LIMIT 1",
	)
		.bind(projectId)
		.first<any>()

	// Get max version num
	const maxVer = await c.env.DB.prepare(
		"SELECT MAX(version_num) as max_v FROM project_intake_versions WHERE project_id = ?",
	)
		.bind(projectId)
		.first<any>()

	const nextVer = (maxVer?.max_v || 0) + 1
	const seedData = active?.data_json || "{}" // Copy data

	const draftId = crypto.randomUUID()
	const now = Date.now()

	await c.env.DB.batch([
		// Create Draft
		c.env.DB.prepare(
			"INSERT INTO project_intake_versions (id, project_id, version_num, status, data_json, created_by) VALUES (?, ?, ?, ?, ?, ?)",
		).bind(draftId, projectId, nextVer, "DRAFT", seedData, actorId),

		// Audit
		c.env.DB.prepare(
			"INSERT INTO audit_log (entity_type, entity_id, action, actor, details, timestamp, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
		).bind(
			"INTAKE_VERSION",
			draftId,
			"INTAKE_DRAFT_CREATED",
			actorId,
			JSON.stringify({ version_num: nextVer }),
			now,
			projectId,
		),
	])

	return c.json({ message: "Draft created", draftId, version_num: nextVer })
})

// GET /api/projects/:projectId/intake/:versionId
app.get("/api/projects/:projectId/intake/:versionId", async (c) => {
	const { orgId } = getAuth(c)
	const projectId = c.req.param("projectId")
	const versionId = c.req.param("versionId")

	// Verify project/org
	const project = await c.env.DB.prepare(
		"SELECT id FROM projects WHERE id = ? AND org_id = ?",
	)
		.bind(projectId, orgId)
		.first()
	if (!project) return c.json({ error: "Project not found" }, 404)

	const version = await c.env.DB.prepare(
		"SELECT * FROM project_intake_versions WHERE id = ? AND project_id = ?",
	)
		.bind(versionId, projectId)
		.first()

	if (!version) return c.json({ error: "Version not found" }, 404)

	return c.json(version)
})

// PUT /api/projects/:projectId/intake/:versionId
app.put("/api/projects/:projectId/intake/:versionId", async (c) => {
	const { orgId, actorId } = getAuth(c)
	const projectId = c.req.param("projectId")
	const versionId = c.req.param("versionId")
	const body = await c.req.json<{ data_json: any; step?: number }>() // data_json can be partial or full

	// Verify access
	const project = await c.env.DB.prepare(
		"SELECT id FROM projects WHERE id = ? AND org_id = ?",
	)
		.bind(projectId, orgId)
		.first()
	if (!project) return c.json({ error: "Project not found" }, 404)

	// Verify draft status
	const version = await c.env.DB.prepare(
		"SELECT status, version_num FROM project_intake_versions WHERE id = ?",
	)
		.bind(versionId)
		.first<{ status: string; version_num: number }>()
	if (!version) return c.json({ error: "Version not found" }, 404)
	if (version.status !== "DRAFT")
		return c.json({ error: "Cannot edit non-draft version" }, 400)

	// Simplistic full update of JSON for now
	const dataStr = JSON.stringify(body.data_json)

	await c.env.DB.prepare(
		"UPDATE project_intake_versions SET data_json = ? WHERE id = ?",
	)
		.bind(dataStr, versionId)
		.run()

	await syncProjectKnowledgeFromIntake(c.env, projectId, body.data_json || {}, {
		versionOverride: version.version_num,
		shouldIndex: false,
	})

	return c.json({ success: true })
})

// DELETE /api/projects/:projectId/intake/:versionId - Delete a draft
app.delete("/api/projects/:projectId/intake/:versionId", async (c) => {
	const { orgId, actorId } = getAuth(c)
	const projectId = c.req.param("projectId")
	const versionId = c.req.param("versionId")

	const project = await c.env.DB.prepare(
		"SELECT id FROM projects WHERE id = ? AND org_id = ?",
	)
		.bind(projectId, orgId)
		.first()
	if (!project) return c.json({ error: "Project not found" }, 404)

	// Verify it's a DRAFT
	const version = await c.env.DB.prepare(
		"SELECT status FROM project_intake_versions WHERE id = ?",
	)
		.bind(versionId)
		.first<any>()
	if (!version) return c.json({ error: "Version not found" }, 404)
	if (version.status !== "DRAFT")
		return c.json({ error: "Only DRAFT versions can be deleted" }, 400)

	// Delete the draft
	await c.env.DB.prepare(
		"DELETE FROM project_intake_versions WHERE id = ? AND status = 'DRAFT'",
	)
		.bind(versionId)
		.run()

	return c.json({ success: true, message: "Draft deleted" })
})

// POST /api/projects/:projectId/intake/:versionId/submit
app.post("/api/projects/:projectId/intake/:versionId/submit", async (c) => {
	const { orgId, actorId } = getAuth(c)
	const projectId = c.req.param("projectId")
	const versionId = c.req.param("versionId")

	const project = await c.env.DB.prepare(
		"SELECT id FROM projects WHERE id = ? AND org_id = ?",
	)
		.bind(projectId, orgId)
		.first()
	if (!project) return c.json({ error: "Project not found" }, 404)

	// 2. Trigger Workflow
	try {
		const instance = await c.env.INTAKE_WORKFLOW.create({
			id: `intake-${versionId}`, // Unique ID per version
			params: {
				projectId,
				versionId,
				orgId,
				actorId,
			},
		})
		console.log(`[App] Triggered IntakeWorkflow: ${instance.id}`)

		// 3. Update DB with Workflow ID (and status if not already)
		await c.env.DB.prepare(
			"UPDATE project_intake_versions SET status = 'SUBMITTED', submitted_at = ?, workflow_id = ? WHERE id = ?",
		)
			.bind(Date.now(), instance.id, versionId)
			.run()
	} catch (e: any) {
		console.error("Failed to trigger intake workflow:", e)
		return c.json(
			{ error: "Failed to queue intake processing", details: e.message },
			500,
		)
	}

	return c.json({
		success: true,
		status: "SUBMITTED",
		message: "Intake processing started",
	})
})

// POST /api/projects/:projectId/intake/:versionId/reprocess - Manual Trigger
app.post("/api/projects/:projectId/intake/:versionId/reprocess", async (c) => {
	const { orgId, actorId } = getAuth(c)
	const projectId = c.req.param("projectId")
	const versionId = c.req.param("versionId")

	// Verify project access
	const project = await c.env.DB.prepare(
		"SELECT id FROM projects WHERE id = ? AND org_id = ?",
	)
		.bind(projectId, orgId)
		.first()
	if (!project) return c.json({ error: "Project not found" }, 404)

	// Verify version exists (status doesn't strictly matter for reprocess, but usually ACTIVE or SUBMITTED)
	const version = await c.env.DB.prepare(
		"SELECT status FROM project_intake_versions WHERE id = ?",
	)
		.bind(versionId)
		.first<any>()

	if (!version) return c.json({ error: "Version not found" }, 404)

	// Trigger Workflow
	try {
		// We use a new unique ID for the workflow instance itself to avoid collision if keeping history,
		// OR we overwrite. Cloudflare Workflows usually de-dupe by ID if running.
		// If we want to re-run, we might need a unique suffix or user provides it.
		// Let's use timestamp suffix for reprocess to ensure it runs.
		const runApiId = `intake-${versionId}-${Date.now()}`

		const instance = await c.env.INTAKE_WORKFLOW.create({
			id: runApiId,
			params: {
				projectId,
				versionId,
				orgId,
				actorId,
			},
		})

		// Update DB with NEW Workflow ID
		await c.env.DB.prepare(
			"UPDATE project_intake_versions SET workflow_id = ? WHERE id = ?",
		)
			.bind(instance.id, versionId)
			.run()

		return c.json({ success: true, workflowId: instance.id })
	} catch (e: any) {
		return c.json({ error: "Failed to re-trigger", details: e.message }, 500)
	}
})

// ==========================================
// PROJECT KNOWLEDGE
// ==========================================

// POST /api/projects/:projectId/knowledge/sync
app.post("/api/projects/:projectId/knowledge/sync", async (c) => {
	const { orgId, actorId } = getAuth(c)
	const projectId = c.req.param("projectId")

	const project = await c.env.DB.prepare(
		"SELECT id FROM projects WHERE id = ? AND org_id = ?",
	)
		.bind(projectId, orgId)
		.first()
	if (!project) return c.json({ error: "Project not found" }, 404)

	let body: { versionId?: string; index?: boolean } = {}
	try {
		body = await c.req.json()
	} catch {}

	const version = body.versionId
		? await c.env.DB.prepare(
				"SELECT data_json, version_num, status FROM project_intake_versions WHERE id = ? AND project_id = ?",
			)
				.bind(body.versionId, projectId)
				.first<any>()
		: await c.env.DB.prepare(
				"SELECT data_json, version_num, status FROM project_intake_versions WHERE project_id = ? AND status = 'ACTIVE' ORDER BY version_num DESC LIMIT 1",
			)
				.bind(projectId)
				.first<any>()

	const fallbackDraft = !version
		? await c.env.DB.prepare(
				"SELECT data_json, version_num, status FROM project_intake_versions WHERE project_id = ? AND status = 'DRAFT' ORDER BY version_num DESC LIMIT 1",
			)
				.bind(projectId)
				.first<any>()
		: null

	const target = version || fallbackDraft
	if (!target) return c.json({ error: "No intake version found" }, 404)

	let intakeData: any = {}
	try {
		intakeData = JSON.parse(target.data_json || "{}")
	} catch {
		intakeData = {}
	}

	const shouldIndex =
		body.index === true ||
		target.status === "ACTIVE" ||
		target.status === "SUBMITTED"

	const result = await syncProjectKnowledgeFromIntake(
		c.env,
		projectId,
		intakeData,
		{
			versionOverride: target.version_num,
			shouldIndex,
		},
	)

	await c.env.DB.prepare(
		"INSERT INTO audit_log (entity_type, entity_id, action, actor, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
	)
		.bind(
			"PROJECT_KNOWLEDGE",
			String(result.record.id),
			"KNOWLEDGE_SYNCED",
			actorId,
			JSON.stringify({
				version: result.record.version,
				indexed: result.indexed,
			}),
			Date.now(),
		)
		.run()

	return c.json({
		success: true,
		knowledge: result.record,
		indexed: result.indexed,
	})
})

// POST /api/projects/:projectId/knowledge/reindex
app.post("/api/projects/:projectId/knowledge/reindex", async (c) => {
	const { orgId, actorId } = getAuth(c)
	const projectId = c.req.param("projectId")

	const project = await c.env.DB.prepare(
		"SELECT id FROM projects WHERE id = ? AND org_id = ?",
	)
		.bind(projectId, orgId)
		.first()
	if (!project) return c.json({ error: "Project not found" }, 404)

	try {
		await reindexProjectKnowledge(c.env, projectId)
	} catch (e: any) {
		if (e?.message?.includes("not found")) {
			return c.json({ error: "Project knowledge not found" }, 404)
		}
		return c.json({ error: "Reindex failed", details: e.message }, 500)
	}

	await c.env.DB.prepare(
		"INSERT INTO audit_log (entity_type, entity_id, action, actor, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
	)
		.bind(
			"PROJECT_KNOWLEDGE",
			projectId,
			"KNOWLEDGE_REINDEXED",
			actorId,
			JSON.stringify({ project_id: projectId }),
			Date.now(),
		)
		.run()

	return c.json({ success: true })
})

// GET /api/projects/:projectId/context
app.get("/api/projects/:projectId/context", async (c) => {
	const { orgId } = getAuth(c)
	const projectId = c.req.param("projectId")

	const project = await c.env.DB.prepare(
		"SELECT id FROM projects WHERE id = ? AND org_id = ?",
	)
		.bind(projectId, orgId)
		.first()
	if (!project) return c.json({ error: "Project not found" }, 404)

	const task = c.req.query("task") || ""
	const taskType = c.req.query("taskType") as KnowledgeTaskType | undefined
	const typesParam = c.req.query("types")
	const requestedTypes = typesParam
		? (typesParam
				.split(",")
				.map((type) => type.trim())
				.filter(Boolean) as KnowledgeContextType[])
		: undefined
	const maxResults = c.req.query("topK")
	const maxResultsPerType = maxResults ? Number(maxResults) : undefined

	const context = await routeContext(c.env, {
		projectId,
		task,
		taskType,
		requestedTypes,
		maxResultsPerType: Number.isFinite(maxResultsPerType)
			? maxResultsPerType
			: undefined,
	})

	return c.json(context)
})

// 3. Files
// POST /api/projects/:projectId/files/init-upload
app.post("/api/projects/:projectId/files/init-upload", async (c) => {
	// Stub: Returing a fake "upload URL" and key
	const uniqueKey = crypto.randomUUID()
	return c.json({
		uploadUrl: "https://fake-r2-upload.com/" + uniqueKey,
		key: uniqueKey,
	})
})

// POST /api/projects/:projectId/files/complete-upload
app.post("/api/projects/:projectId/files/complete-upload", async (c) => {
	const { orgId, actorId } = getAuth(c)
	const projectId = c.req.param("projectId")
	const body = await c.req.json<{
		filename: string
		file_kind: string
		size_bytes: number
		mime_type: string
		r2_key: string
		intake_version_id?: string
	}>()

	const id = crypto.randomUUID()
	const now = Date.now()

	await c.env.DB.batch([
		c.env.DB.prepare(
			"INSERT INTO project_files (id, project_id, intake_version_id, file_kind, filename, mime_type, r2_key, size_bytes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		).bind(
			id,
			projectId,
			body.intake_version_id || null,
			body.file_kind,
			body.filename,
			body.mime_type,
			body.r2_key,
			body.size_bytes,
			actorId
		),

		c.env.DB.prepare(
			"INSERT INTO audit_log (entity_type, entity_id, action, actor, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
		).bind(
			"FILE",
			id,
			"FILE_UPLOADED",
			actorId,
			JSON.stringify({ filename: body.filename }),
			now,
		),
	])

	return c.json({ success: true, file_id: id })
})

// Get Context Pack
app.get("/api/projects/:projectId/context-pack", async (c) => {
	const { orgId } = getAuth(c)
	const projectId = c.req.param("projectId")

	const active = await c.env.DB.prepare(
		"SELECT ai_context_pack_json, ai_summary FROM project_intake_versions WHERE project_id = ? AND status = 'ACTIVE' ORDER BY version_num DESC LIMIT 1",
	)
		.bind(projectId)
		.first()

	if (!active) return c.json({ error: "No active context pack" }, 404)

	return c.json(active)
})

// ==========================================
// EVENT SCOUT API
// ==========================================

// POST /api/projects/:projectId/event-scans - Trigger new event scan
app.post("/api/projects/:projectId/event-scans", async (c) => {
	const { actorId } = getAuth(c)
	const projectId = c.req.param("projectId")
	const body = await c.req
		.json<{
			radius?: number
			location?: string
			eventTypes?: string[]
		}>()
		.catch(
			() =>
				({}) as { radius?: number; location?: string; eventTypes?: string[] },
		)

	const scanId = crypto.randomUUID()

	try {
		// Create scan record
		await c.env.DB.prepare(
			`INSERT INTO event_scans 
			(id, project_id, status, search_params_json) 
			VALUES (?, ?, 'PENDING', ?)`,
		)
			.bind(
				scanId,
				projectId,
				JSON.stringify({
					radius: body.radius || 50,
					location: body.location,
					eventTypes: body.eventTypes,
				})
			)
			.run()

		// Start workflow
		const instance = await c.env.EVENT_SCOUT_WORKFLOW.create({
			id: scanId,
			params: {
				projectId: parseInt(projectId),
				scanId,
				searchParams: {
					radius: body.radius || 50,
					location: body.location,
					eventTypes: body.eventTypes,
				},
			},
		})

		// Update scan with workflow ID
		await c.env.DB.prepare(
			"UPDATE event_scans SET workflow_id = ? WHERE id = ?",
		)
			.bind(instance.id, scanId)
			.run()

		return c.json(
			{
				success: true,
				scanId,
				workflowId: instance.id,
				message: "Event scan started",
			},
			201,
		)
	} catch (e: any) {
		console.error("[EventScout] Failed to start scan:", e)
		return c.json({ error: "Failed to start scan", details: e.message }, 500)
	}
})

// GET /api/projects/:projectId/event-scans - List scan history
app.get("/api/projects/:projectId/event-scans", async (c) => {
	const projectId = c.req.param("projectId")

	const { results } = await c.env.DB.prepare(
		`SELECT * FROM event_scans 
		WHERE project_id = ? 
		ORDER BY created_at DESC 
		LIMIT 20`,
	)
		.bind(projectId)
		.all()

	return c.json({ results })
})

// GET /api/event-scans/:scanId - Get scan details with events
app.get("/api/event-scans/:scanId", async (c) => {
	const scanId = c.req.param("scanId")

	const scan = await c.env.DB.prepare("SELECT * FROM event_scans WHERE id = ?")
		.bind(scanId)
		.first()

	if (!scan) return c.json({ error: "Scan not found" }, 404)

	const { results: events } = await c.env.DB.prepare(
		`SELECT * FROM discovered_events 
		WHERE scan_id = ? 
		ORDER BY relevance_score DESC`,
	)
		.bind(scanId)
		.all()

	return c.json({ scan, events })
})

// GET /api/projects/:projectId/events - Get all events for a project
app.get("/api/projects/:projectId/events", async (c) => {
	const projectId = c.req.param("projectId")
	const status = c.req.query("status") // Optional filter: NEW, INTERESTED, IGNORED

	let query = `SELECT * FROM discovered_events WHERE project_id = ?`
	const params: any[] = [projectId]

	if (status) {
		query += ` AND status = ?`
		params.push(status)
	}

	query += ` ORDER BY relevance_score DESC LIMIT 100`

	const stmt = c.env.DB.prepare(query)
	const { results } = await stmt.bind(...params).all()

	return c.json({ results })
})

// PATCH /api/events/:eventId - Update event status
app.patch("/api/events/:eventId", async (c) => {
	const eventId = c.req.param("eventId")
	const body = await c.req.json<{ status: string }>()

	const validStatuses = ["NEW", "INTERESTED", "OUTREACH_DRAFTED", "IGNORED"]
	if (!validStatuses.includes(body.status)) {
		return c.json({ error: "Invalid status" }, 400)
	}

	try {
		const result = await c.env.DB.prepare(
			"UPDATE discovered_events SET status = ? WHERE id = ? RETURNING *",
		)
			.bind(body.status, eventId)
			.first()

		if (!result) return c.json({ error: "Event not found" }, 404)

		return c.json({ success: true, event: result })
	} catch (e: any) {
		return c.json({ error: "Update failed", details: e.message }, 500)
	}
})

// DELETE /api/events/:eventId - Permanently delete an event
app.delete("/api/events/:eventId", async (c) => {
	const eventId = c.req.param("eventId")

	try {
		const result = await c.env.DB.prepare(
			"DELETE FROM discovered_events WHERE id = ? RETURNING id",
		)
			.bind(eventId)
			.first()

		if (!result) return c.json({ error: "Event not found" }, 404)

		return c.json({ success: true, deleted: eventId })
	} catch (e: any) {
		return c.json({ error: "Delete failed", details: e.message }, 500)
	}
})

// Debug / Reset Database (Preserves Projects + Intake)
app.delete("/api/debug/reset", async (c) => {
	// Nuke campaigns, posts, etc. BUT preserve projects and intake
	await c.env.DB.batch([
		// Child Tables (Must be deleted first)
		c.env.DB.prepare("DELETE FROM run_steps"),
		// c.env.DB.prepare("DELETE FROM usage_events"),
		c.env.DB.prepare("DELETE FROM messages"),
		c.env.DB.prepare("DELETE FROM approvals"),
		c.env.DB.prepare("DELETE FROM tasks"),

		// New Client Approval Tables
		c.env.DB.prepare("DELETE FROM client_approvals"),
		c.env.DB.prepare("DELETE FROM publish_jobs"),
		c.env.DB.prepare("DELETE FROM post_revisions"),
		c.env.DB.prepare("DELETE FROM posts"),
		c.env.DB.prepare("DELETE FROM audit_log"), // Singular 'log' based on migration sql

		// Parent Tables (NOT projects, orgs, or intake tables!)
		c.env.DB.prepare("DELETE FROM runs"), // Now safe to delete
		c.env.DB.prepare("DELETE FROM campaigns"),

		// Reset sequences (exclude project-related)
		c.env.DB.prepare(
			"DELETE FROM sqlite_sequence WHERE name IN ('campaigns', 'messages', 'approvals', 'tasks', 'runs', 'run_steps', 'usage_events', 'posts', 'client_approvals', 'publish_jobs', 'post_revisions', 'audit_log')",
		),
	])

	return c.json({
		success: true,
		message: "Campaigns & posts nuked. Projects preserved. 💥",
	})
})

export { GrowthOpsWorkflow, IntakeWorkflow, EventScoutWorkflow, CampaignDO }
// POST /api/campaigns/daily - Create/Fetch Daily Strategy Campaign
app.post("/api/campaigns/daily", async (c) => {
	const { projectId } = await c.req.json<{ projectId: string }>()
	if (!projectId) return c.json({ error: "Project ID required" }, 400)

	// 1. Check for existing "Daily Strategy" campaign for today
	const dateStr = new Date().toLocaleDateString("en-CA") // YYYY-MM-DD
	// Match both new naming and legacy naming just in case
	const existing = await c.env.DB.prepare(
		"SELECT * FROM campaigns WHERE project_id = ? AND (name = ? OR name = ?)",
	)
		.bind(
			projectId,
			`Daily Strategy - ${dateStr}`,
			`Daily Marketing Push - ${dateStr}`,
		)
		.first<{ id: number; do_id: string }>()

	if (existing) {
		return c.json({
			success: true,
			message: "Campaign already active",
			campaignId: existing.id,
		})
	}

	// 2. Create New Campaign
	const doId = c.env.CAMPAIGN_DO.newUniqueId()
	const doIdStr = doId.toString()
	const now = Date.now()
	const campaignName = `Daily Strategy - ${dateStr}`

	try {
		const result = await c.env.DB.prepare(
			"INSERT INTO campaigns (project_id, name, status, do_id) VALUES (?, ?, ?, ?) RETURNING id",
		)
			.bind(projectId, campaignName, "ACTIVE", doIdStr)
			.first<{ id: number }>()

		if (!result) throw new Error("Failed to create campaign record")

		// 3. Trigger the Daily Pipeline
		const stub = c.env.CAMPAIGN_DO.get(doId)
		const prompt = `Generate a Daily Strategy Plan and Content for ${dateStr}`

		// Call the specialized endpoint we just added
		await stub.fetch("http://internal/daily-strategy", {
			method: "POST",
			body: JSON.stringify({
				message: prompt,
				timestamp: now,
			}),
		})

		return c.json({
			success: true,
			message: "Daily strategy process started",
			campaignId: result.id,
		})
	} catch (e: any) {
		console.error("Daily Campaign Error:", e)
		return c.json({ error: e.message }, 500)
	}
})

// ==========================================
// TEAM / AGENT ACTIVITY API
// ==========================================

app.get("/api/team/activity", async (c) => {
	const projectId = c.req.query("projectId")
	// Note: team view is often global or per-project. Logic below uses global usage for now (since run_steps might be global)
	// but if we want per-project, we should filter. Existing code didn't filter by project in DB query, strangely,
	// it just took all run_steps. We will keep it consistent but respect the pattern.

	// Get recent agent activity from run_steps
	let recentActivity: any[] = []
	let activeAgents: string[] = []
	let stats = {
		totalTasks: 0,
		completedToday: 0,
		activeNow: 0,
	}

	try {
		// Get the most recent activity for each agent (last 24 hours)
		const activityResult = await c.env.DB.prepare(
			`
			SELECT 
				rs.agent_role,
				rs.agent_name,
				rs.status,
				rs.created_at,
				rs.completed_at,
				rs.step_name
			FROM run_steps rs
			WHERE rs.created_at > ?
			ORDER BY rs.created_at DESC
			LIMIT 50
		`,
		)
			.bind(Date.now() - 24 * 60 * 60 * 1000)
			.all()

		recentActivity = activityResult.results || []

		// Get currently active agents (running status)
		const activeResult = await c.env.DB.prepare(
			`
			SELECT DISTINCT agent_role FROM run_steps WHERE status = 'running'
		`,
		).all<{ agent_role: string }>()

		activeAgents = (activeResult.results || []).map((r) => r.agent_role)
		stats.activeNow = activeAgents.length

		// Stats
		const todayStart = new Date()
		todayStart.setHours(0, 0, 0, 0)

		const statsResult = await c.env.DB.prepare(
			`
			SELECT 
				COUNT(*) as total,
				SUM(CASE WHEN status = 'completed' AND completed_at > ? THEN 1 ELSE 0 END) as completed_today
			FROM run_steps
			WHERE created_at > ?
		`,
		)
			.bind(
				todayStart.getTime(),
				todayStart.getTime() - 7 * 24 * 60 * 60 * 1000,
			)
			.first<{ total: number; completed_today: number }>()

		if (statsResult) {
			stats.totalTasks = statsResult.total || 0
			stats.completedToday = statsResult.completed_today || 0
		}
	} catch (e) {
		console.error("Error fetching agent activity:", e)
		return c.json({ error: "Failed to fetch activity" }, 500)
	}

	return c.json({
		recentActivity,
		activeAgents,
		stats,
	})
})

// ==========================================
// BILLING API
// ==========================================

app.get("/api/billing/usage", async (c) => {
	const projectId = c.req.query("projectId")

	// Fetch Project Name if needed
	let project: { id: number; name?: string | null } | null = null
	if (projectId) {
		project = await c.env.DB.prepare(
			"SELECT id, name FROM projects WHERE id = ?",
		)
			.bind(projectId)
			.first()
	}

	const where: string[] = []
	const params: any[] = []
	if (projectId) {
		where.push("project_id = ?")
		params.push(projectId)
	}
	const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

	let totals = {
		requestCount: 0,
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		totalCost: 0,
		firstEvent: null as number | null,
		lastEvent: null as number | null,
	}
	let lineItems: any[] = []

	try {
		const summary = await c.env.DB.prepare(
			`
      SELECT
        COUNT(*) as request_count,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        MIN(created_at) as first_event,
        MAX(created_at) as last_event
      FROM usage_events
      ${whereSql}
    `,
		)
			.bind(...params)
			.first<any>()

		if (summary) {
			totals = {
				requestCount: summary.request_count || 0,
				inputTokens: summary.input_tokens || 0,
				outputTokens: summary.output_tokens || 0,
				totalTokens: summary.total_tokens || 0,
				totalCost: summary.total_cost || 0,
				firstEvent: summary.first_event ?? null,
				lastEvent: summary.last_event ?? null,
			}
		}

		const items = await c.env.DB.prepare(
			`
      SELECT
        model,
        operation,
        COUNT(*) as request_count,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(cost_usd), 0) as total_cost
      FROM usage_events
      ${whereSql}
      GROUP BY model, operation
      ORDER BY total_cost DESC, request_count DESC
    `,
		)
			.bind(...params)
			.all<any>()

		lineItems = (items.results || []).map((item: any) => ({
			model: item.model,
			operation: item.operation,
			requestCount: item.request_count || 0,
			inputTokens: item.input_tokens || 0,
			outputTokens: item.output_tokens || 0,
			totalTokens: item.total_tokens || 0,
			totalCost: item.total_cost || 0,
		}))
	} catch (err) {
		console.error("[Billing] Failed to load usage data:", err)
		return c.json({ error: "Usage data unavailable" }, 500)
	}

	return c.json({
		projectId,
		project,
		totals,
		lineItems,
	})
})

// ==========================================
// BRAND API
// ==========================================

app.get("/api/brand/identity", async (c) => {
	const projectId = c.req.query("projectId")
	if (!projectId)
		return c.json({
			brandVoice: null,
			targetAudience: null,
			productDescription: null,
		})

	// Helper functions (duplicated from frontend logic, but moved here)
	// Actually, we can just return the raw data and let frontend parse, OR parse here.
	// Let's parse here to keep frontend dumb.

	// ... Copying helper logic is messy.
	// BETTER: Return the raw rows (knowledge or intake) and let frontend helpers (which are pure functions) remain in frontend?
	// OR: Move helpers to shared?
	// "NO BACKEND CODE IN ROUTES" means no DB calls. Helpers that process JSON are fine in frontend if they just take JSON.
	// BUT checking multiple tables (knowledge vs intake) IS backend logic.

	// Option A: API returns { source: 'knowledge' | 'intake', data: ... }
	// Option B: API returns normalized { brandVoice: ..., targetAudience: ... }

	// I will go with Option B for cleaner frontend.

	const knowledge = await c.env.DB.prepare(
		"SELECT brand_voice, target_audience, product_description FROM project_knowledge WHERE project_id = ?",
	)
		.bind(projectId)
		.first<any>()

	if (knowledge) {
		return c.json({
			source: "knowledge",
			brandVoice: knowledge.brand_voice
				? JSON.parse(knowledge.brand_voice)
				: null,
			targetAudience: knowledge.target_audience
				? JSON.parse(knowledge.target_audience)
				: null,
			productDescription: knowledge.product_description ?? null,
		})
	}

	const intake = await c.env.DB.prepare(
		"SELECT data_json FROM project_intake_versions WHERE project_id = ? AND status = 'ACTIVE' ORDER BY version_num DESC LIMIT 1",
	)
		.bind(projectId)
		.first<{ data_json: string | null }>()

	// If we return raw intake, frontend still needs to "build" it.
	// To fully move logic, I should implement buildBrandVoiceFromIntake here?
	// That duplicates code.
	// Compromise: Return the raw intake data_json if knowledge missing, and let frontend "build" it using its existing helpers.
	// The query logic is what matters to fetch.

	return c.json({
		source: "intake",
		data_json: intake?.data_json || null,
	})
})

// ==========================================
// CHAT API
// ==========================================

app.get("/api/chat/campaigns", async (c) => {
	const projectId = c.req.query("projectId")
	if (!projectId) return c.json({ campaigns: [] })

	const { results } = await c.env.DB.prepare(
		"SELECT * FROM campaigns WHERE project_id = ? ORDER BY created_at DESC",
	)
		.bind(projectId)
		.all<any>()

	if (results.length === 0) return c.json({ campaigns: results })

	const campaignIds = results.map((campaign) => campaign.id).filter(Boolean)
	if (campaignIds.length > 0) {
		const placeholders = campaignIds.map(() => "?").join(",")
		const { results: postCounts } = await c.env.DB.prepare(
			`SELECT campaign_id,
			 COUNT(*) as total,
			 SUM(CASE WHEN status NOT IN ('PUBLISHED', 'CANCELLED') THEN 1 ELSE 0 END) as unpublished_count,
			 SUM(CASE WHEN status NOT IN ('CLIENT_APPROVED', 'PUBLISHED', 'CANCELLED') THEN 1 ELSE 0 END) as unapproved_count
			 FROM posts
			 WHERE campaign_id IN (${placeholders})
			 GROUP BY campaign_id`,
		)
			.bind(...campaignIds)
			.all<{
				campaign_id: number
				total: number
				unpublished_count: number
				unapproved_count: number
			}>()

		const countsById = new Map(
			postCounts.map((row) => [row.campaign_id, row]),
		)
		const updates: Array<{ id: number; status: string }> = []
		const normalized = results.map((campaign) => {
			const currentStatus = campaign.status
			if (["CANCELLED", "COMPLETED", "PUBLISHED"].includes(currentStatus)) {
				return campaign
			}

			const counts = countsById.get(campaign.id)
			if (!counts || !counts.total) return campaign

			let derivedStatus = currentStatus
			if (counts.unpublished_count === 0) {
				derivedStatus = "COMPLETED"
			} else if (counts.unapproved_count === 0) {
				derivedStatus = "CLIENT_APPROVED"
			}

			if (derivedStatus !== currentStatus) {
				updates.push({ id: campaign.id, status: derivedStatus })
				return { ...campaign, status: derivedStatus }
			}

			return campaign
		})

		if (updates.length > 0) {
			const stmt = c.env.DB.prepare(
				"UPDATE campaigns SET status = ? WHERE id = ?",
			)
			await c.env.DB.batch(
				updates.map((update) => stmt.bind(update.status, update.id)),
			)
		}

		return c.json({ campaigns: normalized })
	}

	return c.json({ campaigns: results })
})

app.get("/api/chat/history", async (c) => {
	const campaignId = c.req.query("campaignId") // This is the DO ID
	if (!campaignId) return c.json({ messages: [], campaignPhase: null })

	try {
		const id = c.env.CAMPAIGN_DO.idFromString(campaignId)
		const stub = c.env.CAMPAIGN_DO.get(id)
		const res = await stub.fetch("http://internal/status")
		if (res.ok) {
			const state = (await res.json()) as any
			return c.json({
				messages: state.history || [],
				campaignPhase: state.phase || null,
			})
		}
	} catch (e) {
		console.error("Invalid DO ID:", campaignId, e)
	}
	return c.json({ messages: [], campaignPhase: null })
})

// ==========================================
// DASHBOARD API
// ==========================================

app.get("/api/dashboard", async (c) => {
	const projectId = c.req.query("projectId")
	if (!projectId) {
		return c.json({
			agents: [],
			approvals: [],
			auditLog: [],
			interestedEvents: [],
			dailyStrategy: "",
		})
	}

	try {
		// Fetch fresh data in parallel
		const [
			agentsResult,
			postsResult,
			auditResult,
			eventsResult,
			dailyCampaign,
		] = await Promise.all([
			c.env.DB.prepare("SELECT * FROM agents").all<any>(),
			c.env.DB.prepare(
				`SELECT p.* FROM posts p 
                 INNER JOIN campaigns c ON p.campaign_id = c.id 
                 WHERE c.project_id = ? AND p.status IN ('INTERNAL_APPROVED', 'CLIENT_VISIBLE', 'CLIENT_CHANGES_REQUESTED', 'READY_FOR_APPROVAL')
                 ORDER BY p.created_at DESC`,
			)
				.bind(projectId)
				.all<any>(),
			c.env.DB.prepare(
				"SELECT * FROM audit_log WHERE project_id = ? ORDER BY timestamp DESC LIMIT 20",
			)
				.bind(projectId)
				.all<any>(),
			c.env.DB.prepare(
				`SELECT id, name, event_date, location, relevance_score, source_url 
                 FROM discovered_events 
                 WHERE project_id = ? AND status = 'INTERESTED' 
                 ORDER BY relevance_score DESC LIMIT 5`,
			)
				.bind(projectId)
				.all<{
					id: string
					name: string
					event_date: string
					location: string
					relevance_score: number
					source_url: string
				}>(),
			// Fetch today's Daily Strategy campaign
			c.env.DB.prepare(
				"SELECT * FROM campaigns WHERE project_id = ? AND (name LIKE 'Daily Strategy%' OR name LIKE 'Daily Marketing%') ORDER BY created_at DESC LIMIT 1",
			)
				.bind(projectId)
				.first<{ id: number; do_id: string; name: string }>(),
		])

		let dailyStrategy = ""
		if (dailyCampaign) {
			try {
				const id = c.env.CAMPAIGN_DO.idFromString(dailyCampaign.do_id)
				const stub = c.env.CAMPAIGN_DO.get(id)
				const state = await stub
					.fetch("http://internal/status")
					.then((r) => r.json() as any)

				const messages = state.history || []
				const strategyMsg = messages
					.slice()
					.reverse()
					.find(
						(m: any) =>
							m.role === "assistant" &&
							(m.content.includes("# Daily Strategy") ||
								m.content.includes('"plan":')),
					)

				if (strategyMsg) {
					try {
						const jsonContent = JSON.parse(strategyMsg.content)
						if (jsonContent.plan) {
							dailyStrategy = jsonContent.plan
						} else if (
							typeof jsonContent.reply === "string" &&
							jsonContent.reply.includes("# Daily Strategy")
						) {
							dailyStrategy = jsonContent.reply
						}
					} catch (e) {
						dailyStrategy = strategyMsg.content
					}
				}
			} catch (e) {
				console.error("Failed to fetch daily strategy from DO", e)
			}
		}

		return c.json({
			agents: agentsResult.results,
			approvals: postsResult.results,
			auditLog: auditResult.results,
			interestedEvents: eventsResult.results,
			dailyStrategy,
		})
	} catch (e) {
		console.error("Dashboard API Error", e)
		return c.json({ error: "Failed to load dashboard data" }, 500)
	}
})

// ==========================================
// ORCHESTRATION API
// ==========================================

app.get("/api/runs", async (c) => {
	try {
		const { results } = await c.env.DB.prepare(
			"SELECT * FROM runs ORDER BY start_time DESC LIMIT 20",
		).all()
		return c.json({ recentRuns: results })
	} catch (e) {
		return c.json({ recentRuns: [] })
	}
})

app.get("/api/runs/:id", async (c) => {
	const id = c.req.param("id")
	try {
		const run = await c.env.DB.prepare("SELECT * FROM runs WHERE id = ?")
			.bind(id)
			.first()
		const steps = await c.env.DB.prepare(
			"SELECT * FROM run_steps WHERE run_id = ? ORDER BY created_at ASC",
		)
			.bind(id)
			.all()

		return c.json({
			run,
			steps: steps.results,
		})
	} catch (e) {
		return c.json({ run: null, steps: [] }, 404)
	}
})

// ==========================================
// INTAKE API
// ==========================================

app.get("/api/projects/:id/intake/draft", async (c) => {
	const projectId = c.req.param("id")
	const orgId = "demo-org" // Stub

	// 1. Get Project
	const project = await c.env.DB.prepare(
		"SELECT * FROM projects WHERE id = ? AND org_id = ?",
	)
		.bind(projectId, orgId)
		.first()

	if (!project) return c.json({ error: "Project not found" }, 404)

	// 2. Get Draft Version
	let draft = await c.env.DB.prepare(
		"SELECT * FROM project_intake_versions WHERE project_id = ? AND status = 'DRAFT' ORDER BY version_num DESC LIMIT 1",
	)
		.bind(projectId)
		.first()

	// If no draft, we could create one or return null.
	// Frontend handles null draft by showing "Start New Draft" button.

	return c.json({ project, draft })
})

// POST endpoint to create a draft is also needed?
// Frontend seems to use /api/projects/:id/intake/draft via POST in "Start New Draft" button.
app.post("/api/projects/:id/intake/draft", async (c) => {
	const projectId = c.req.param("id")
	// Create new draft logic...
	// For simplicity, let's assume we copy previous active or start fresh.

	// Check if draft exists?
	const existing = await c.env.DB.prepare(
		"SELECT id FROM project_intake_versions WHERE project_id = ? AND status='DRAFT'",
	)
		.bind(projectId)
		.first()
	if (existing) return c.json({ draftId: existing.id })

	// Create new
	// Get max version
	const max = await c.env.DB.prepare(
		"SELECT MAX(version_num) as v FROM project_intake_versions WHERE project_id = ?",
	)
		.bind(projectId)
		.first<{ v: number }>()
	const nextVer = (max?.v || 0) + 1

	const res = await c.env.DB.prepare(
		"INSERT INTO project_intake_versions (project_id, version_num, status, data_json) VALUES (?, ?, 'DRAFT', '{}') RETURNING id",
	)
		.bind(projectId, nextVer)
		.first<{ id: number }>()

	return c.json({ draftId: res?.id })
})

// PUT to save draft
app.put("/api/projects/:id/intake/:draftId", async (c) => {
	const draftId = c.req.param("draftId")
	const body = (await c.req.json()) as any
	const { data_json, step } = body

	await c.env.DB.prepare(
		"UPDATE project_intake_versions SET data_json = ? WHERE id = ?",
	)
		.bind(JSON.stringify(data_json), draftId)
		.run()

	return c.json({ success: true })
})

// POST to submit
app.post("/api/projects/:id/intake/:draftId/submit", async (c) => {
	const draftId = c.req.param("draftId")

	await c.env.DB.prepare(
		"UPDATE project_intake_versions SET status = 'ACTIVE' WHERE id = ?",
	)
		.bind(draftId)
		.run()

	// Trigger analysis agents?
	// ...

	return c.json({ status: "ACTIVE" })
})

// ==========================================
// EVENTS API
// ==========================================

app.get("/api/projects/:id/events", async (c) => {
	const projectId = c.req.param("id")
	const events = await c.env.DB.prepare(
		"SELECT * FROM discovered_events WHERE project_id = ? ORDER BY relevance_score DESC",
	)
		.bind(projectId)
		.all()
	return c.json({ results: events.results })
})

app.get("/api/projects/:id/event-scans", async (c) => {
	const projectId = c.req.param("id")
	const scans = await c.env.DB.prepare(
		"SELECT * FROM event_scans WHERE project_id = ? ORDER BY created_at DESC LIMIT 10",
	)
		.bind(projectId)
		.all()
	return c.json({ results: scans.results })
})

app.get("/api/event-scans/:id", async (c) => {
	const id = c.req.param("id")
	const scan = await c.env.DB.prepare("SELECT * FROM event_scans WHERE id = ?")
		.bind(id)
		.first()
	const events = await c.env.DB.prepare(
		"SELECT * FROM discovered_events WHERE scan_id = ?",
	)
		.bind(id)
		.all()
	return c.json({ scan, events: events.results })
})

app.post("/api/projects/:id/event-scans", async (c) => {
	const projectId = c.req.param("id")
	const { location, radius } = (await c.req.json()) as any
	const id = crypto.randomUUID()

	await c.env.DB.prepare(
		"INSERT INTO event_scans (id, project_id, status) VALUES (?, ?, 'PENDING')",
	)
		.bind(id, projectId)
		.run()

	// Trigger Agent logic would go here (or via DO)
	return c.json({ scanId: id, status: "PENDING" })
})

app.patch("/api/events/:id", async (c) => {
	const id = c.req.param("id")
	const { status } = (await c.req.json()) as any
	await c.env.DB.prepare("UPDATE discovered_events SET status = ? WHERE id = ?")
		.bind(status, id)
		.run()
	return c.json({ success: true })
})

app.delete("/api/events/:id", async (c) => {
	const id = c.req.param("id")
	await c.env.DB.prepare("DELETE FROM discovered_events WHERE id = ?")
		.bind(id)
		.run()
	return c.json({ success: true })
})

export default app
