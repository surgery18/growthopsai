import { DurableObject } from "cloudflare:workers"
import {
	ProjectManager,
	ResearchAgent,
	ContentManager,
	ContentWriter,
	EventScoutAgent,
	IntegrationManager,
	PerformanceAnalyst,
	StrategistAgent,
	AudienceAnalyst,
	GrowthManager,
	CSO,
	CMO,
	CRCO,
} from "./agents/index"
import { routeContext } from "./context_router"

// Map internal agent roles to display names for the DB
const AGENT_DISPLAY_NAMES: Record<string, string> = {
	campaign_manager: "Campaign Manager",
	content_manager: "Content Manager",
	growth_manager: "Growth Manager",
	research_agent: "Research Agent",
	audience_analyst: "Audience Analyst",
	content_writer: "Content Writer",
	lead_strategist: "Lead Strategist",
	social_dist_agent: "Social Dist. Agent",
	perf_analyst: "Performance Analyst",
	cso: "Chief Strategy Officer",
	cmo: "Chief Marketing Officer",
	crco: "Chief Risk Officer",
	integration_manager: "Integration Manager",
}

// ==========================================
// STATE TYPES
// ==========================================

type CampaignPhase =
	| "IDLE" // Waiting for user input
	| "PLANNING" // PM analyzing request
	| "RESEARCHING" // Research/Analyst gathering data
	| "WRITING" // ContentWriter drafting
	| "INTERNAL_REVIEW" // ContentManager reviewing
	| "EXEC_REVIEW" // Execs reviewing
	| "REVISING" // Writer fixing based on feedback
	| "AWAITING_USER_FEEDBACK" // Max attempts reached, awaiting user direction
	| "APPROVED" // Ready for user

interface CampaignState {
	phase: CampaignPhase
	instruction: string
	parsedRequest: {
		topic: string
		quantity: number
		platform: string
	}
	projectId?: string | null
	history: { role: string; content: string; timestamp: number }[]
	workingData: {
		research?: any
		audience?: any
		draft?: any
		internalReview?: any
		execReview?: any
	}
	artifacts: {
		posts: any[]
		strategy_brief?: string
		exec_reviews?: any[]
	}
	revisionCount: number
	maxRevisions: number
	last_updated: number
	currentRunId?: string // ID for the current D1 run record
}

const createDefaultState = (): CampaignState => ({
	phase: "IDLE",
	instruction: "",
	parsedRequest: { topic: "", quantity: 3, platform: "x" },
	projectId: null,
	history: [],
	workingData: {},
	artifacts: { posts: [] },
	revisionCount: 0,
	maxRevisions: 5,
	last_updated: Date.now(),
})

// ==========================================
// CAMPAIGN DURABLE OBJECT
// ==========================================

export class CampaignDO extends DurableObject<Env> {
	private state: CampaignState

	constructor(state: DurableObjectState, env: Env) {
		super(state, env)
		// Create fresh state for this instance
		this.state = createDefaultState()
		this.ctx.blockConcurrencyWhile(async () => {
			const stored = await this.ctx.storage.get<CampaignState>("state")
			if (stored) {
				// Deep merge stored state with fresh defaults
				this.state = {
					...createDefaultState(),
					...stored,
					// Ensure nested objects are properly merged
					parsedRequest: {
						...createDefaultState().parsedRequest,
						...stored.parsedRequest,
					},
					workingData: { ...stored.workingData },
					artifacts: { ...createDefaultState().artifacts, ...stored.artifacts },
				}
			}
		})
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url)

		// GET /status - Poll current state
		if (url.pathname === "/status" || url.pathname === "/") {
			return Response.json(this.state)
		}

		// POST /chat - User message
		if (url.pathname === "/chat" && request.method === "POST") {
			const {
				message,
				role = "user",
				timestamp,
			} = (await request.json()) as any

			// Use provided timestamp (from frontend) to prevent duplicate display
			const msgTimestamp = timestamp || Date.now()

			this.state.history.push({
				role,
				content: message,
				timestamp: msgTimestamp,
			})
			this.state.last_updated = Date.now()
			await this.save()

			if (role === "user") {
				await this.auditLog(`User: ${message}`, "User")
				return this.processUserMessage(message)
			}

			return Response.json({ success: true })
		}

		// POST /action - Manual actions (approve, reject, publish)
		if (url.pathname === "/action" && request.method === "POST") {
			const { action, feedback } = (await request.json()) as any
			return this.handleAction(action, feedback)
		}

		// POST /daily-strategy - Targeted Daily Material Pipeline
		if (url.pathname === "/daily-strategy" && request.method === "POST") {
			const { message, timestamp, projectId } = (await request.json()) as any
			// Initialize Project ID if provided (Critical for Context)
			if (projectId && !this.state.projectId) {
				this.state.projectId = projectId
				await this.save()
			}
			return this.runDailyStrategyPipeline(message, timestamp, projectId)
		}

		return new Response("Not Found", { status: 404 })
	}

	// ==========================================
	// CORE: PROCESS USER MESSAGE
	// ==========================================

	private async processUserMessage(message: string): Promise<Response> {
		console.log(`[CampaignDO] Processing: "${message}"`)

		// Step 1: PM analyzes the request
		this.state.phase = "PLANNING"
		await this.save()

		const pm = new ProjectManager(this.env, "Elena", "project_manager")
		const projectId = await this.getProjectId()
		const runId = this.state.currentRunId || undefined
		const pmResponse = await pm.run({
			task: message,
			history: this.state.history.slice(-10),
			projectId: projectId || undefined,
			runId,
		})

		const pmOutput = pmResponse.output
		console.log(`[CampaignDO] PM Output:`, JSON.stringify(pmOutput, null, 2))

		// Log PM reply
		this.state.history.push({
			role: "assistant",
			content: JSON.stringify({
				reply: pmOutput.reply,
			}),
			timestamp: Date.now(),
		})

		// Parse the request
		this.state.instruction = message
		this.state.parsedRequest = {
			topic: pmOutput.extracted_topic || this.extractTopic(message),
			quantity: pmOutput.extracted_quantity || this.parseQuantity(message),
			platform: "x",
		}

		// Determine intent
		if (pmOutput.intent === "new_mission" || pmOutput.intent === "follow_up") {
			// Show "Internal Comms" style message
			const { topic, quantity } = this.state.parsedRequest
			this.state.history.push({
				role: "assistant",
				content: JSON.stringify({
					internal_comms: true,
					assignments: [
						{
							agent: "research_agent",
							task: `Research factual context on ${topic}.`,
						},
						{
							agent: "audience_analyst",
							task: `Analyze audience interested in ${topic}.`,
						},
						{
							agent: "content_writer",
							task: `Write exactly ${quantity} post(s) about ${topic}.`,
						},
						{ agent: "content_manager", task: `Review draft for quality.` },
						{ agent: "executives", task: `Final approval.` },
					],
				}),
				timestamp: Date.now(),
			})

			// Start the pipeline
			await this.save()
			this.runContentPipeline() // Fire and forget - runs async
			return Response.json({
				reply: pmOutput.reply,
				message: "Starting content pipeline...",
			})
		}

		// Just a chat - return PM response
		await this.save()
		return Response.json(pmOutput)
	}

	// ==========================================
	// CORE: DAILY STRATEGY PIPELINE (SPLIT PHASE)
	// ==========================================

	private async runDailyStrategyPipeline(
		message: string,
		timestamp: number,
		passedProjectId?: string,
	): Promise<Response> {
		console.log(`[CampaignDO] Starting Daily Strategy Pipeline: "${message}"`)

		// Initialize State
		this.state.phase = "RESEARCHING" // Start with research/planning
		this.state.instruction = message
		this.state.last_updated = timestamp || Date.now()
		if (passedProjectId) this.state.projectId = passedProjectId

		// Add user message to history
		this.state.history.push({
			role: "user",
			content: message,
			timestamp: this.state.last_updated,
		})

		// Initial Assistant Acknowledgement & Workflow Plan
		this.state.history.push({
			role: "assistant",
			content: JSON.stringify({
				reply:
					"I'm starting the daily strategy process. Phase 1: Developing the Strategy Plan.",
				assignments: [
					{
						agent: "ResearchAgent",
						task: "Research factual context on relevant trending topics.",
					},
					{
						agent: "AudienceAnalyst",
						task: "Analyze audience sentiment and intent for today.",
					},
					{
						agent: "LeadStrategist",
						task: "Develop a cohesive Daily Strategy Plan.",
					},
					{
						agent: "ContentWriter",
						task: "Draft posts aligned with approved strategy.",
					},
					{
						agent: "ExecutiveTeam",
						task: "CSO, CMO, CRCO review for strategy, brand, and compliance.",
					},
				],
			}),
			timestamp: Date.now(),
		})
		await this.save()

		// Run async (Fire and Forget)
		this.ctx.waitUntil(this.executeSplitPipeline())

		return Response.json({ success: true, message: "Pipeline started" })
	}

	private async executeSplitPipeline() {
		try {
			const projectId = await this.getProjectId()
			const runId = `daily-${this.ctx.id.toString()}-${Date.now()}`
			this.state.currentRunId = runId

			// Insert run record to satisfy FK constraints
			await this.env.DB.prepare(
				`INSERT INTO runs (id, instruction, status, start_time, project_id) VALUES (?, ?, ?, ?, ?)`,
			)
				.bind(
					runId,
					"Daily Strategy Generation",
					"running",
					Date.now(),
					projectId || null,
				)
				.run()

			// --- PHASE 1: STRATEGY ---
			this.state.phase = "PLANNING"
			await this.save()
			console.log(`[Pipeline] Phase 1: Strategy Generation`)

			// 0. Load Context
			const context = projectId
				? await this.routeContextWithRetry({
						projectId,
						task: "Daily Marketing Strategy",
						taskType: "strategy_planning",
						requestedTypes: ["competitors", "audience", "brand_voice"],
					})
				: undefined

			// 1. Research Phase (Explicit Agent Run)
			console.log(`[Pipeline] Phase 0: Research & Analysis`)

			// A. Research Agent
			const researcher = new ResearchAgent(
				this.env,
				"ResearchAgent",
				"researcher",
			)
			await this.updateAgentStatus(
				"research_agent",
				"active",
				"Researching trending topics...",
				0,
			)
			const researchResult = await researcher.run({
				task: "Find 3 relevant/trending facts or news items related to the users topic/industry that could inform today's strategy.",
				context: context || undefined,
				history: [],
				projectId: projectId || undefined,
				runId,
			})
			const researchOutput =
				researchResult.output.facts ||
				researchResult.output.data_points ||
				"No specific research found."

			await this.updateAgentStatus(
				"research_agent",
				"idle",
				"Research complete",
				100,
			)
			await this.logStep("research_agent", researchResult.output)

			// Log Research
			this.state.history.push({
				role: "assistant",
				content: JSON.stringify({
					reply:
						"🔍 Research Agent: I've gathered some key insights for today.",
					research: researchOutput,
				}),
				timestamp: Date.now(),
			})
			await this.save()

			// B. Audience Analyst
			const analyst = new AudienceAnalyst(
				this.env,
				"AudienceAnalyst",
				"analyst",
			)
			await this.updateAgentStatus(
				"audience_analyst",
				"active",
				"Analyzing audience intent...",
				0,
			)
			const analystResult = await analyst.run({
				task: "Analyze the target audience for today's strategy based on the research and overall brand voice.",
				context: context || undefined,
				history: [{ agent: "ResearchAgent", output: researchResult.output }],
				projectId: projectId || undefined,
				runId,
			})
			const analystOutput =
				analystResult.output.intent_analysis || "Targeting general audience."

			await this.updateAgentStatus(
				"audience_analyst",
				"idle",
				"Analysis complete",
				100,
			)
			await this.logStep("audience_analyst", analystResult.output)

			// Log Analysis
			this.state.history.push({
				role: "assistant",
				content: JSON.stringify({
					reply:
						"👥 Audience Analyst: I've analyzed the target sentiment and intent.",
					analysis: analystOutput,
				}),
				timestamp: Date.now(),
			})
			await this.save()

			// 2. Generate Strategy Brief (Markdown)
			// Use the dedicated StrategistAgent
			const strategist = new StrategistAgent(
				this.env,
				"LeadStrategist",
				"manager",
			)
			await this.updateAgentStatus(
				"lead_strategist",
				"active",
				"Developing daily strategy...",
				0,
			)
			const strategyTask = `Develop a "Daily Strategy Plan" in Markdown. 
Start with "# Daily Strategy". 
Include: 
- **Core Theme**: Short impact statement.
- **Audience Focus**: Who are we targeting today?
- **Key Message**: What is the one thing they need to know?
- **Content Plan**: Brief bullet points of what to post.`

			const strategyResult = await strategist.run({
				task: strategyTask,
				context: context || undefined,
				history: [
					{ agent: "ResearchAgent", output: researchResult.output },
					{ agent: "AudienceAnalyst", output: analystResult.output },
				],
				originalInstruction: this.state.instruction,
				projectId: projectId || undefined,
				runId,
			})

			const strategyBrief =
				strategyResult.output.strategy ||
				strategyResult.output.content ||
				"No strategy generated."
			this.state.artifacts.strategy_brief = strategyBrief

			// Log Strategy Step
			this.state.history.push({
				role: "assistant", // Intermediate update
				content: JSON.stringify({
					reply: `✅ Phase 1 Complete: Daily Strategy Plan generated.\n\n${strategyBrief}`,
					plan: strategyBrief,
				}),
				timestamp: Date.now(),
			})
			await this.save()

			// --- PHASE 2: WRITING (Using existing flow) ---
			this.state.phase = "WRITING"
			await this.save()
			console.log(`[Pipeline] Phase 2: Content Generation via generateDraft`)

			// Store working data for review loops
			this.state.workingData.research = researchResult.output
			this.state.workingData.audience = analystResult.output

			// Use existing draft generation (includes research/audience context)
			const topic = "Daily Marketing Strategy" // Derived from strategy
			const quantity = 3 // Default daily quantity

			await this.sendStatus(
				`✍️ @ContentWriter is drafting ${quantity} post(s) using research and audience insights...`,
			)

			let draft = await this.generateDraft(topic, quantity)

			await this.sendStatus(
				`✅ @ContentWriter completed ${draft.posts?.length || 0} draft post(s). Sending for internal review...`,
			)

			// --- PHASE 3: INTERNAL REVIEW LOOP ---
			this.state.phase = "INTERNAL_REVIEW"
			await this.save()
			console.log(`[Pipeline] Phase 3: Internal Review Loop`)

			draft = await this.runInternalReviewLoop(topic, quantity, draft)

			// Store final draft
			this.state.workingData.draft = draft
			this.state.artifacts.posts = draft.posts || []
			// Keep the strategy brief from Phase 1

			// --- PHASE 4: EXEC REVIEW LOOP ---
			console.log(`[Pipeline] Phase 4: Executive Review Loop`)
			const execSuccess = await this.runExecReviewLoop(topic, quantity)

			if (execSuccess) {
				console.log(`[Pipeline] ✅ Exec Review APPROVED`)
				this.state.phase = "APPROVED"
				await this.save()
				await this.updateCampaignStatus("READY_FOR_APPROVAL")
			} else {
				console.log(
					`[Pipeline] ❌ Max exec attempts reached, awaiting user input`,
				)
			}

			// Sync to D1 approvals table
			await this.syncToApprovals()

			// Mark run as completed in D1
			if (this.state.currentRunId) {
				try {
					await this.env.DB.prepare(
						`UPDATE runs SET status = ?, end_time = ?, result = ? WHERE id = ?`,
					)
						.bind(
							"completed",
							Date.now(),
							JSON.stringify({ posts: this.state.artifacts.posts }),
							this.state.currentRunId,
						)
						.run()
					console.log(
						`[Pipeline] ✅ Run ${this.state.currentRunId} marked as COMPLETED`,
					)
				} catch (e) {
					console.error("[Pipeline] Failed to update run status:", e)
				}
			}

			console.log("[Pipeline] ✅ DAILY PIPELINE COMPLETE")
			await this.save()
		} catch (error: any) {
			console.error("[Pipeline] Daily Strategy Failed:", error)
			this.state.history.push({
				role: "system",
				content: `Error in daily pipeline: ${error.message}`,
				timestamp: Date.now(),
			})
			await this.save()
		}
	}

	// ==========================================
	// CORE: CONTENT PIPELINE (DETERMINISTIC)
	// ==========================================

	private async runContentPipeline() {
		try {
			const { topic, quantity, platform } = this.state.parsedRequest

			// Create a run record in D1 for orchestration tracking
			const runId = `run-${this.ctx.id.toString()}-${Date.now()}`
			this.state.currentRunId = runId
			try {
				await this.env.DB.prepare(
					`INSERT INTO runs (id, instruction, status, start_time) VALUES (?, ?, ?, ?)`,
				)
					.bind(runId, this.state.instruction, "running", Date.now())
					.run()
			} catch (e) {
				console.error("[CampaignDO] Failed to create run record:", e)
			}
			const projectId = await this.getProjectId()
			const usageRunId = this.state.currentRunId || runId

			// ========== PHASE 1: RESEARCH ==========
			this.state.phase = "RESEARCHING"
			await this.save()

			console.log(`[Pipeline] ========== PHASE 1: RESEARCH ==========`)
			console.log(
				`[Pipeline] Topic: ${topic}, Quantity: ${quantity}, Platform: ${platform}`,
			)

			// ResearchAgent
			await this.sendStatus(
				`🔬 @ResearchAgent is gathering factual information about "${topic}"...`,
			)

			const researchAgent = new ResearchAgent(
				this.env,
				"ResearchAgent",
				"worker",
			)
			console.log(`[Pipeline] 🔬 Running ResearchAgent...`)
			const researchResult = await researchAgent.run({
				task: `Research factual information about: ${topic}`,
				originalInstruction: this.state.instruction,
				projectId: projectId || undefined,
				runId: usageRunId,
			})
			this.state.workingData.research = researchResult.output
			console.log(
				`[Pipeline] ✅ ResearchAgent complete:`,
				JSON.stringify(researchResult.output, null, 2),
			)
			await this.logStep("research_agent", researchResult.output)

			await this.sendStatus(
				`✅ @ResearchAgent completed research. Found ${researchResult.output?.facts?.length || 0} key facts.`,
			)

			// AudienceAnalyst
			await this.sendStatus(
				`👥 @AudienceAnalyst is analyzing the target audience...`,
			)

			const audienceAgent = new AudienceAnalyst(
				this.env,
				"AudienceAnalyst",
				"worker",
			)
			console.log(`[Pipeline] 👥 Running AudienceAnalyst...`)
			const audienceResult = await audienceAgent.run({
				task: `Analyze the target audience interested in: ${topic}`,
				originalInstruction: this.state.instruction,
				projectId: projectId || undefined,
				runId: usageRunId,
			})
			this.state.workingData.audience = audienceResult.output
			console.log(
				`[Pipeline] ✅ AudienceAnalyst complete:`,
				JSON.stringify(audienceResult.output, null, 2),
			)
			await this.logStep("audience_analyst", audienceResult.output)

			await this.sendStatus(
				`✅ @AudienceAnalyst identified target demographics and engagement preferences.`,
			)

			// ========== PHASE 2: WRITING ==========
			this.state.phase = "WRITING"
			await this.save()

			console.log(`[Pipeline] ========== PHASE 2: WRITING ==========`)
			console.log(
				`[Pipeline] ✍️ Generating ${quantity} post(s) about: ${topic}`,
			)

			await this.sendStatus(
				`✍️ @ContentWriter is drafting ${quantity} post(s) using research and audience insights...`,
			)

			let draft = await this.generateDraft(topic, quantity)

			await this.sendStatus(
				`✅ @ContentWriter completed ${draft.posts?.length || 0} draft post(s). Sending for internal review...`,
			)

			// ========== PHASE 3: INTERNAL REVIEW LOOP ==========
			this.state.phase = "INTERNAL_REVIEW"
			await this.save()

			draft = await this.runInternalReviewLoop(topic, quantity, draft)

			// Store final draft
			this.state.workingData.draft = draft
			this.state.artifacts.posts = draft.posts || []
			this.state.artifacts.strategy_brief = draft.strategy || ""

			// ========== PHASE 4: EXEC REVIEW LOOP ==========
			const execSuccess = await this.runExecReviewLoop(topic, quantity)

			if (execSuccess) {
				console.log(`[Pipeline] ✅ Exec Review APPROVED`)
				this.state.phase = "APPROVED"
				await this.save()
				await this.updateCampaignStatus("READY_FOR_APPROVAL")
			} else {
				console.log(
					`[Pipeline] ❌ Max exec attempts reached, awaiting user input`,
				)
			}

			// Sync to D1 approvals table
			await this.syncToApprovals()

			// Mark run as completed in D1
			if (this.state.currentRunId) {
				try {
					await this.env.DB.prepare(
						`UPDATE runs SET status = ?, end_time = ?, result = ? WHERE id = ?`,
					)
						.bind(
							"completed",
							Date.now(),
							JSON.stringify({ posts: this.state.artifacts.posts }),
							this.state.currentRunId,
						)
						.run()
					console.log(
						`[Pipeline] ✅ Run ${this.state.currentRunId} marked as COMPLETED`,
					)
				} catch (e) {
					console.error("[Pipeline] Failed to update run status:", e)
				}
			}

			console.log("[Pipeline] ✅ PIPELINE COMPLETE")
			console.log(
				"[Pipeline] Final Posts:",
				JSON.stringify(this.state.artifacts.posts, null, 2),
			)

			await this.save()
		} catch (error: any) {
			console.error("[Pipeline] ❌ Error:", error)
			// Mark run as failed
			if (this.state.currentRunId) {
				try {
					await this.env.DB.prepare(
						`UPDATE runs SET status = ?, end_time = ? WHERE id = ?`,
					)
						.bind("failed", Date.now(), this.state.currentRunId)
						.run()
				} catch (e) {
					console.error("[Pipeline] Failed to update run status:", e)
				}
			}
			this.state.history.push({
				role: "system",
				content: `Error in pipeline: ${error.message}`,
				timestamp: Date.now(),
			})
			await this.save()
		}
	}

	// ==========================================
	// HELPER: PROJECT CONTEXT
	// ==========================================

	private async routeContextWithRetry(
		request: Parameters<typeof routeContext>[1],
		options?: { maxAttempts?: number; baseDelayMs?: number },
	): Promise<Awaited<ReturnType<typeof routeContext>> | null> {
		const maxAttempts = options?.maxAttempts ?? 3
		const baseDelayMs = options?.baseDelayMs ?? 250

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				return await routeContext(this.env, request)
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				const isVectorQueryError =
					message.includes("VECTOR_QUERY_ERROR") && message.includes("400")

				if (!isVectorQueryError) {
					throw error
				}

				if (attempt === maxAttempts) {
					console.error(
						"[CampaignDO] Vector query failed after retries:",
						error,
					)
					return null
				}

				const delayMs = baseDelayMs * attempt
				console.warn(
					`[CampaignDO] Vector query failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms.`,
				)
				await new Promise((resolve) => setTimeout(resolve, delayMs))
			}
		}

		return null
	}

	private async getProjectId(): Promise<string | null> {
		if (this.state.projectId) return this.state.projectId
		const record = await this.env.DB.prepare(
			"SELECT project_id FROM campaigns WHERE do_id = ?",
		)
			.bind(this.ctx.id.toString())
			.first<{ project_id: number }>()
		if (!record?.project_id) return null
		this.state.projectId = String(record.project_id)
		await this.save()
		return this.state.projectId
	}

	private async getProjectWebsiteUrl(
		projectId: string,
	): Promise<string | null> {
		try {
			// First try to get from intake data (project_basics.website_url)
			const intake = await this.env.DB.prepare(
				"SELECT data_json FROM project_intake_versions WHERE project_id = ? AND status = 'ACTIVE' ORDER BY version_num DESC LIMIT 1",
			)
				.bind(projectId)
				.first<{ data_json: string | null }>()

			if (intake?.data_json) {
				try {
					const data = JSON.parse(intake.data_json)
					const url = data?.project_basics?.website_url
					if (url) {
						console.log(`[CampaignDO] Found website URL from intake: ${url}`)
						return url
					}
				} catch (e) {
					console.warn("[CampaignDO] Failed to parse intake JSON:", e)
				}
			}

			// Fallback to projects table
			const project = await this.env.DB.prepare(
				"SELECT website_url FROM projects WHERE id = ?",
			)
				.bind(projectId)
				.first<{ website_url: string | null }>()
			return project?.website_url || null
		} catch (e) {
			console.error("[CampaignDO] Failed to get website URL:", e)
			return null
		}
	}

	// ==========================================
	// HELPER: GENERATE DRAFT
	// ==========================================

	private async generateDraft(
		topic: string,
		quantity: number,
		feedback?: string,
		options?: { includePreviousDraft?: boolean },
	) {
		const writer = new ContentWriter(this.env, "ContentWriter", "worker")
		const includePreviousDraft = options?.includePreviousDraft !== false

		const currentPosts = this.state.artifacts.posts || []
		const postsContent = currentPosts
			.map((p) => {
				const content =
					typeof p === "string" ? p : p.content || JSON.stringify(p)
				return content
			})
			.join("\n\n---\n\n")

		const taskDescription = feedback
			? `Revise the content based on feedback: "${feedback}". Topic: ${topic}. Create EXACTLY ${quantity} post(s).`
			: `Write EXACTLY ${quantity} post(s) about: ${topic}. Each post must be under 280 characters.`

		console.log(`[Pipeline] 📝 ContentWriter task: ${taskDescription}`)

		const history = [
			{ agent: "research_agent", output: this.state.workingData.research },
			{ agent: "audience_analyst", output: this.state.workingData.audience },
		]

		// Important: If revising, inject the current draft into history so the agent sees what to fix
		if (feedback && postsContent && includePreviousDraft) {
			console.log(
				`[Pipeline] 💉 Injecting previous draft into Writer history for revision`,
			)
			history.push({
				agent: "previous_draft",
				output: { posts: currentPosts, raw_text: postsContent },
			})
		}

		console.log(
			`[Pipeline] 📝 ContentWriter history:`,
			JSON.stringify(history, null, 2),
		)

		const projectId = await this.getProjectId()
		const runId = this.state.currentRunId || undefined
		const context =
			projectId &&
			(await this.routeContextWithRetry({
				projectId,
				task: taskDescription,
				taskType: feedback ? "content_revision" : "creative_draft",
				requestedTypes: feedback
					? ["brand_voice", "product"]
					: ["brand_voice", "product", "audience"],
			}))

		await this.updateAgentStatus(
			"content_writer",
			"active",
			taskDescription.substring(0, 100) + "...",
			0,
		)
		const result = await writer.run({
			task: taskDescription,
			history: history,
			context: context || undefined,
			originalInstruction: this.state.instruction,
			projectId: projectId || undefined,
			runId,
		})
		await this.updateAgentStatus(
			"content_writer",
			"idle",
			"Drafting complete",
			100,
		)

		console.log(
			`[Pipeline] ✅ ContentWriter raw output:`,
			JSON.stringify(result.output, null, 2),
		)

		// ===== GET WEBSITE URL =====
		const websiteUrl = projectId
			? await this.getProjectWebsiteUrl(projectId)
			: null
		console.log(
			`[Pipeline] 🔗 Website URL for project: ${websiteUrl || "not found"}`,
		)

		// ===== PROGRAMMATIC ENFORCEMENT =====
		let posts = result.output.posts || []
		console.log(
			`[Pipeline] 🔧 Raw post count: ${posts.length}, enforcing quantity: ${quantity}`,
		)

		// Enforce quantity
		posts = posts.slice(0, quantity)

		// Enforce character limit for single posts
		if (quantity === 1 && posts[0]) {
			if (posts[0].content && posts[0].content.length > 280) {
				console.log(
					`[Pipeline] 🔧 Truncating post from ${posts[0].content.length} chars to 280`,
				)
				posts[0].content = posts[0].content.substring(0, 277) + "..."
			}
		}

		// Ensure we have the right structure and inject website URL
		posts = posts.map((p: any, i: number) => {
			let content = typeof p === "string" ? p : p.content || JSON.stringify(p)

			// Replace [Website URL] placeholder with actual URL
			if (websiteUrl) {
				// Replace various placeholder patterns
				content = content.replace(/\[Website URL\]/gi, websiteUrl)
				content = content.replace(/\[URL\]/gi, websiteUrl)
				content = content.replace(/\[WEBSITE\]/gi, websiteUrl)
				content = content.replace(/\[LINK\]/gi, websiteUrl)

				// If no URL in content and we have one, append it
				const hasUrl =
					content.includes("http://") || content.includes("https://")
				if (!hasUrl) {
					// Add URL at the end, making sure we stay under 280 chars
					const urlSuffix = ` ${websiteUrl}`
					if (content.length + urlSuffix.length <= 280) {
						content = content.trimEnd() + urlSuffix
					} else {
						// Truncate content to fit URL
						const maxContentLength = 280 - urlSuffix.length - 3
						content = content.substring(0, maxContentLength) + "..." + urlSuffix
					}
				}
			}

			return {
				day: 1,
				sequence: i + 1,
				content,
				notes: p.notes || "",
			}
		})

		console.log(
			`[Pipeline] ✅ Final enforced posts:`,
			JSON.stringify(posts, null, 2),
		)
		await this.logStep("content_writer", { ...result.output, posts })

		return {
			posts,
			strategy: result.output.strategy || result.output.plan || "",
			topic_understood: result.output.topic_understood,
		}
	}

	// ==========================================
	// HELPER: REVIEW LOOPS
	// ==========================================

	private async runInternalReviewLoop(
		topic: string,
		quantity: number,
		initialDraft: any,
	) {
		let draft = initialDraft
		let internalApproved = false
		const projectId = await this.getProjectId()
		const runId = this.state.currentRunId || undefined

		while (
			!internalApproved &&
			this.state.revisionCount < this.state.maxRevisions
		) {
			const contentManager = new ContentManager(
				this.env,
				"ContentManager",
				"manager",
			)
			const reviewResult = await contentManager.run({
				task: `Review this draft for quality. Topic: ${topic}. Quantity requested: ${quantity}.`,
				history: [
					{
						agent: "research_agent",
						output: this.state.workingData.research,
					},
					{
						agent: "audience_analyst",
						output: this.state.workingData.audience,
					},
					{ agent: "content_writer", output: draft },
				],
				originalInstruction: this.state.instruction,
				projectId: projectId || undefined,
				runId,
			})

			this.state.workingData.internalReview = reviewResult.output
			await this.logStep("content_manager", reviewResult.output)

			if (
				reviewResult.output.ready_for_exec_review ||
				reviewResult.output.approved
			) {
				internalApproved = true
			} else {
				// Revise
				this.state.phase = "REVISING"
				this.state.revisionCount++
				await this.save()

				draft = await this.generateDraft(
					topic,
					quantity,
					reviewResult.output.feedback,
				)
			}
		}
		return draft
	}

	private async runExecReviewLoop(topic: string, quantity: number) {
		let execApproved = false
		let execAttempts = 0
		const maxExecAttempts = 5

		while (!execApproved && execAttempts < maxExecAttempts) {
			execAttempts++
			this.state.phase = "EXEC_REVIEW"
			await this.save()

			// Status update to client
			this.state.history.push({
				role: "assistant",
				content: JSON.stringify({
					status_update: true,
					reply: `🔍 Submitting content for Executive Review (attempt ${execAttempts}/${maxExecAttempts})...`,
				}),
				timestamp: Date.now(),
			})
			await this.save()

			console.log(
				`[Pipeline] ========== EXEC REVIEW (Attempt ${execAttempts}) ==========`,
			)
			const execResult = await this.runExecReview()

			if (execResult.approved) {
				execApproved = true

				// Show final result with posts
				this.state.history.push({
					role: "assistant",
					content: JSON.stringify({
						approved: true,
						reply:
							"✅ Executive Review PASSED. Your content is approved and ready!",
						plan: this.state.artifacts.strategy_brief, // Explicitly include the plan
						posts: this.state.artifacts.posts,
					}),
					timestamp: Date.now(),
				})
				console.log(
					`[Pipeline] ✅ Exec Review APPROVED on attempt ${execAttempts}`,
				)
			} else {
				console.log(
					`[Pipeline] ⚠️ Exec Review REJECTED: ${execResult.feedback}`,
				)

				if (execAttempts < maxExecAttempts) {
					// Notify client about revision
					this.state.history.push({
						role: "assistant",
						content: JSON.stringify({
							status_update: true,
							reply: `⚠️ Executive feedback: ${execResult.feedback}\n\n🔄 Revising content based on feedback...`,
						}),
						timestamp: Date.now(),
					})
					await this.save()

					// Revise the content
					this.state.phase = "REVISING"
					this.state.revisionCount++
					await this.save()

					console.log(
						`[Pipeline] 🔄 Revising content based on exec feedback...`,
					)
					const draft = await this.generateDraft(
						topic,
						quantity,
						execResult.feedback,
					)
					this.state.artifacts.posts = draft.posts || []

					console.log(
						`[Pipeline] ✅ Revision ${this.state.revisionCount} complete, re-submitting...`,
					)
				} else {
					// Max attempts reached
					this.state.phase = "AWAITING_USER_FEEDBACK"
					this.state.history.push({
						role: "assistant",
						content: JSON.stringify({
							approved: false,
							awaitingFeedback: true,
							reply: `⚠️ Executive Review still requires changes after ${maxExecAttempts} attempts.\n\n**Last executive feedback:** ${execResult.feedback}\n\nHere's the current draft for your review. Please provide specific feedback and I'll revise it:`,
							posts: this.state.artifacts.posts,
						}),
						timestamp: Date.now(),
					})
					console.log(
						`[Pipeline] ❌ Max exec attempts reached, awaiting user input`,
					)
				}
			}
		}
		return execApproved
	}

	// ==========================================
	// HELPER: EXEC REVIEW
	// ==========================================

	private async runExecReview(): Promise<{
		approved: boolean
		feedback: string
	}> {
		const postsPreview = this.state.artifacts.posts
			.map((p: any) => p.content || "")
			.join(" | ")

		const reviews: any[] = []
		const projectId = await this.getProjectId()
		const runId = this.state.currentRunId || undefined
		const execContext =
			projectId &&
			(await this.routeContextWithRetry({
				projectId,
				task: `Executive approval review. Content: ${postsPreview}`,
				taskType: "executive_approval",
				requestedTypes: ["summary"],
			}))

		// CSO Review
		await this.sendStatus(
			`📊 @CSO (Chief Strategy Officer) is reviewing strategy alignment...`,
		)
		const cso = new CSO(this.env, "CSO", "executive")

		await this.updateAgentStatus(
			"cso",
			"active",
			"Reviewing strategy strategy...",
			0,
		)
		const csoResult = await cso.run({
			task: `Review strategy alignment. Goal: "${this.state.instruction}". Content: ${postsPreview}`,
			context: execContext || undefined,
			originalInstruction: this.state.instruction,
			projectId: projectId || undefined,
			runId,
		})
		await this.updateAgentStatus("cso", "idle", "Strategy review complete", 100)
		reviews.push({ agent: "CSO", ...csoResult.output })
		await this.logStep("cso", csoResult.output)

		// CMO Review
		await this.sendStatus(
			`📈 @CMO (Chief Marketing Officer) is reviewing brand voice and messaging...`,
		)
		const cmo = new CMO(this.env, "CMO", "executive")

		await this.updateAgentStatus("cmo", "active", "Reviewing brand voice...", 0)
		const cmoResult = await cmo.run({
			task: `Review brand voice and messaging. Content: ${postsPreview}`,
			context: execContext || undefined,
			originalInstruction: this.state.instruction,
			projectId: projectId || undefined,
			runId,
		})
		await this.updateAgentStatus("cmo", "idle", "Brand review complete", 100)
		reviews.push({ agent: "CMO", ...cmoResult.output })
		await this.logStep("cmo", cmoResult.output)

		// CRCO Review
		await this.sendStatus(
			`⚖️ @CRCO (Chief Risk & Compliance Officer) is reviewing for legal and compliance risks...`,
		)
		const complianceContext =
			projectId &&
			(await this.routeContextWithRetry({
				projectId,
				task: `Compliance review. Content: ${postsPreview}`,
				taskType: "compliance_review",
				requestedTypes: ["compliance"],
			}))
		const crco = new CRCO(this.env, "CRCO", "executive")

		await this.updateAgentStatus("crco", "active", "Reviewing compliance...", 0)
		const crcoResult = await crco.run({
			task: `Review for compliance and legal risks. Content: ${postsPreview}`,
			context: complianceContext || undefined,
			originalInstruction: this.state.instruction,
			projectId: projectId || undefined,
			runId,
		})
		await this.updateAgentStatus(
			"crco",
			"idle",
			"Compliance review complete",
			100,
		)
		reviews.push({ agent: "CRCO", ...crcoResult.output })
		await this.logStep("crco", crcoResult.output)

		this.state.artifacts.exec_reviews = reviews
		this.state.workingData.execReview = reviews

		// All must approve
		const approved = reviews.every((r) => r.approved === true)
		const feedback = reviews
			.filter((r) => !r.approved)
			.map((r) => `${r.agent}: ${r.feedback}`)
			.join("; ")

		return { approved, feedback }
	}

	// ==========================================
	// HELPER: SEND STATUS UPDATE TO CLIENT
	// ==========================================

	private async sendStatus(message: string) {
		this.state.history.push({
			role: "assistant",
			content: JSON.stringify({
				status_update: true,
				reply: message,
			}),
			timestamp: Date.now(),
		})
		await this.save()
		await this.auditLog(message, "System")
	}

	// ==========================================
	// HELPER: PARSE QUANTITY
	// ==========================================

	private parseQuantity(instruction: string): number {
		const lower = instruction.toLowerCase()
		if (
			lower.includes("single") ||
			lower.includes("one post") ||
			lower.includes("a post") ||
			lower.includes("1 post")
		) {
			return 1
		}
		if (lower.includes("two") || lower.includes("2 post")) return 2
		if (lower.includes("three") || lower.includes("3 post")) return 3
		return 3 // Default
	}

	private extractTopic(instruction: string): string {
		// Simple extraction - get text after "about"
		const match = instruction.match(/about\s+(.+?)(\.|$)/i)
		return match ? match[1].trim() : instruction
	}

	private extractTopicFromFeedback(feedback: string): string | null {
		const match = feedback.match(/about\s+(.+?)(\.|$)/i)
		if (!match) return null
		const topic = match[1].trim()
		return topic.length > 0 ? topic : null
	}

	// ==========================================
	// HELPER: LOG STEP & SYNC
	// ==========================================

	private async logStep(agent: string, output: any) {
		const now = Date.now()
		// Use 'trace' role so frontend can hide these from main chat
		this.state.history.push({
			role: "trace",
			content: JSON.stringify({ agent, output }),
			timestamp: now,
		})
		await this.save()

		// Log to audit log
		const agentName = AGENT_DISPLAY_NAMES[agent] || agent
		// Create a friendly message based on output summary if possible, or generic
		let summary = "completed task"
		if (output?.facts) summary = `found ${output.facts.length} facts`
		if (output?.posts) summary = `drafted ${output.posts.length} posts`
		if (output?.feedback)
			summary = `provided feedback: ${output.feedback.substring(0, 30)}...`

		await this.auditLog(`${agentName} ${summary}`, agentName)

		// Also log to D1 for orchestration view (only if we have a run ID)
		if (!this.state.currentRunId) return

		try {
			await this.env.DB.prepare(
				`INSERT INTO run_steps (run_id, agent_role, agent_name, step_name, status, input, output, completed_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
				.bind(
					this.state.currentRunId, // Use the run ID we created at pipeline start
					agent,
					agent,
					`${agent}_step`,
					"completed",
					JSON.stringify({ task: this.state.instruction }),
					JSON.stringify(output),
					now,
				)
				.run()
		} catch (e) {
			console.error("[CampaignDO] Failed to log step to D1:", e)
		}
	}

	private async auditLog(message: string, actor: string = "System") {
		const projectId = await this.getProjectId()
		if (!projectId) return

		try {
			await this.env.DB.prepare(
				`INSERT INTO audit_log (project_id, timestamp, action, entity_type, entity_id, actor, details) 
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
				.bind(
					projectId,
					Date.now(),
					message,
					"CAMPAIGN",
					0, // Default entity_id
					actor,
					"{}",
				)
				.run()
		} catch (e) {
			console.error("[CampaignDO] Failed to write audit log:", e)
		}
	}

	private async updateCampaignStatus(status: string) {
		try {
			await this.env.DB.prepare(
				"UPDATE campaigns SET status = ? WHERE do_id = ?",
			)
				.bind(status, this.ctx.id.toString())
				.run()
		} catch (e) {
			console.error("[CampaignDO] Failed to update campaign status:", e)
		}
	}

	private async syncToApprovals() {
		try {
			const campaignRecord = await this.env.DB.prepare(
				"SELECT id FROM campaigns WHERE do_id = ?",
			)
				.bind(this.ctx.id.toString())
				.first<{ id: number }>()

			if (campaignRecord) {
				const campaignId = campaignRecord.id
				const posts = this.state.artifacts.posts || []
				const platform = this.state.parsedRequest.platform || "unknown"

				// Batch insert new posts
				// Note: In a real system we might version existing rows, but here we append new approved options.
				// We rely on the timestamp to find the latest batch.

				const stmt = this.env.DB.prepare(
					`INSERT INTO posts (campaign_id, status, content, platform) 
					 VALUES (?, 'INTERNAL_APPROVED', ?, ?)`,
				)

				const batch = []
				for (const p of posts) {
					// Ensure content is string
					const content =
						typeof p === "string" ? p : p.content || JSON.stringify(p)
					batch.push(stmt.bind(campaignId, content, platform))
				}

				if (batch.length > 0) {
					await this.env.DB.batch(batch)
					console.log(`[CampaignDO] Synced ${batch.length} posts to D1`)
				}
			}
		} catch (e) {
			console.error("[CampaignDO] Failed to sync to D1:", e)
		}
	}

	// ==========================================
	// ACTIONS
	// ==========================================

	private async handleAction(
		action: string,
		feedback?: string,
	): Promise<Response> {
		if (
			action === "approve" &&
			(this.state.phase === "EXEC_REVIEW" ||
				this.state.phase === "APPROVED" ||
				this.state.phase === "AWAITING_USER_FEEDBACK")
		) {
			// This is internal approval? Or client approval triggered via API?
			// If via API, we are already processed in app.ts, but maybe we want to keep DO in sync.
			// The API calls "POST /client/approve", which updates DB.
			// Does it call DO? No, app.ts /approve endpoint DOES NOT call DO.
			// Only /reject calls DO.
			// So internal approval flow logic here is for INTERNAL agents or Dev Console?
			// Let's assume this handleAction is generic.

			this.state.phase = "APPROVED"
			this.state.history.push({
				role: "system",
				content: "Campaign manually approved.",
				timestamp: Date.now(),
			})
			await this.updateCampaignStatus("CLIENT_APPROVED")
			await this.auditLog("Campaign manually approved by client", "Client")
		}

		if (action === "reject") {
			this.state.phase = "REVISING"
			this.state.revisionCount = 0

			// Log the rejection as user feedback
			const msg = `Client REJECTED content. Reason: ${feedback || "No reason provided"}`
			this.state.history.push({
				role: "user",
				content: msg,
				timestamp: Date.now(),
			})

			await this.auditLog(`Client REJECTED content: ${feedback}`, "Client")

			// Trigger Revision Task (Async)
			// This calls the ContentWriter agent to revise the content
			this.ctx.waitUntil(
				(async () => {
					console.log("[CampaignDO] Starting client rejection revision...")
					try {
						const { quantity } = this.state.parsedRequest
						let revisionTopic = this.state.parsedRequest.topic
						let topicChanged = false

						if (feedback) {
							const hintedTopic = this.extractTopicFromFeedback(feedback)
							if (hintedTopic && hintedTopic !== revisionTopic) {
								revisionTopic = hintedTopic
								this.state.parsedRequest.topic = hintedTopic
								topicChanged = true
							}
							if (!this.state.instruction.includes(feedback)) {
								this.state.instruction = `${this.state.instruction}\nClient revision: ${feedback}`
							}
							await this.save()
						}

						// If the feedback implies a new topic, refresh research and audience data
						if (feedback && topicChanged) {
							this.state.phase = "RESEARCHING"
							await this.save()
							const projectId = await this.getProjectId()
							const runId = this.state.currentRunId || undefined

							const researchAgent = new ResearchAgent(
								this.env,
								"ResearchAgent",
								"worker",
							)

							await this.updateAgentStatus(
								"research_agent",
								"active",
								`Researching: ${revisionTopic}`,
								0,
							)
							const researchResult = await researchAgent.run({
								task: `Research factual information about: ${revisionTopic}`,
								originalInstruction: this.state.instruction,
								projectId: projectId || undefined,
								runId,
							})
							await this.updateAgentStatus(
								"research_agent",
								"idle",
								"Research complete",
								100,
							)
							this.state.workingData.research = researchResult.output
							await this.logStep("research_agent", researchResult.output)

							const audienceAgent = new AudienceAnalyst(
								this.env,
								"AudienceAnalyst",
								"worker",
							)

							await this.updateAgentStatus(
								"audience_analyst",
								"active",
								`Analyzing audience for: ${revisionTopic}`,
								0,
							)
							const audienceResult = await audienceAgent.run({
								task: `Analyze the target audience interested in: ${revisionTopic}`,
								originalInstruction: this.state.instruction,
								projectId: projectId || undefined,
								runId,
							})
							await this.updateAgentStatus(
								"audience_analyst",
								"idle",
								"Analysis complete",
								100,
							)
							this.state.workingData.audience = audienceResult.output
							await this.logStep("audience_analyst", audienceResult.output)
						}

						// 1. Writer Revision
						let draft = await this.generateDraft(
							revisionTopic,
							quantity,
							feedback,
							{ includePreviousDraft: !topicChanged },
						)

						// 2. Internal Review Loop
						this.state.phase = "INTERNAL_REVIEW"
						await this.save()
						draft = await this.runInternalReviewLoop(
							revisionTopic,
							quantity,
							draft,
						)

						// Persist revised draft so exec review uses the updated content
						this.state.workingData.draft = draft
						this.state.artifacts.posts = draft.posts || []
						this.state.artifacts.strategy_brief = draft.strategy || ""
						await this.save()

						// 3. Exec Review Loop
						this.state.phase = "EXEC_REVIEW"
						await this.save()
						const execSuccess = await this.runExecReviewLoop(
							revisionTopic,
							quantity,
						)

						if (execSuccess) {
							// Update state with new draft
							this.state.phase = "APPROVED"
							await this.save()
							await this.updateCampaignStatus("READY_FOR_APPROVAL")

							// Create entry in history
							this.state.history.push({
								role: "assistant",
								content: JSON.stringify({
									reply:
										"🔄 Content revised based on client feedback. Passed all reviews.",
									posts: this.state.artifacts.posts,
								}),
								timestamp: Date.now(),
							})
							await this.save()

							// Sync to client approvals so user can review the revision
							await this.syncToApprovals()
						} else {
							// Stuck in Exec review?
							console.log(
								"[CampaignDO] Rejection revision failed at Exec Review",
							)
						}
					} catch (e) {
						console.error("[CampaignDO] Revision failed:", e)
					}
				})(),
			)
		}

		if (action === "publish" && this.state.phase === "APPROVED") {
			this.state.history.push({
				role: "system",
				content: "Campaign published! 🚀",
				timestamp: Date.now(),
			})
			await this.updateCampaignStatus("COMPLETED")
		}

		await this.save()
		return Response.json({ success: true, phase: this.state.phase })
	}

	private async save() {
		await this.ctx.storage.put("state", this.state)
	}

	private async updateAgentStatus(
		slug: string,
		status: "idle" | "active" | "paused",
		activity: string,
		progress: number,
	) {
		try {
			// Check if agent exists
			const exists = await this.env.DB.prepare(
				"SELECT id FROM agents WHERE slug = ?",
			)
				.bind(slug)
				.first()

			if (exists) {
				await this.env.DB.prepare(
					"UPDATE agents SET status = ?, activity = ?, progress = ?, last_updated = ? WHERE slug = ?",
				)
					.bind(status, activity, progress, Date.now(), slug)
					.run()
			} else {
				// Create if not exists (Lazy registration)
				// @ts-ignore
				const name =
					(typeof AGENT_DISPLAY_NAMES !== "undefined"
						? AGENT_DISPLAY_NAMES[slug]
						: slug) || slug
				const role =
					slug.includes("manager") || slug.includes("officer")
						? "Manager"
						: "Specialist"

				await this.env.DB.prepare(
					"INSERT INTO agents (slug, name, role, status, activity, progress, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
				)
					.bind(slug, name, role, status, activity, progress, Date.now())
					.run()
			}
		} catch (e) {
			console.error(
				`[CampaignDO] Failed to update agent status for ${slug}:`,
				e,
			)
		}
	}
}
