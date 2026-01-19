import type { WorkflowEvent } from "cloudflare:workers"
import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers"
import {
	CampaignManager,
	ContentManager,
	GrowthManager,
	ResearchAgent,
	AudienceAnalyst,
	SEOStrategist,
	ContentWriter,
	SocialDistributionAgent,
	PerformanceAnalyst,
	CSO,
	CMO,
	CRCO,
	IntegrationManager,
} from "./agents"
import { classifyTaskType, routeContext } from "./context_router"

// Map internal agent roles to display names for the DB
const AGENT_DISPLAY_NAMES: Record<string, string> = {
	campaign_manager: "Campaign Manager",
	content_manager: "Content Manager",
	growth_manager: "Growth Manager",
	research_agent: "Research Agent",
	audience_analyst: "Audience Analyst",
	seo_strategist: "SEO Strategist",
	content_writer: "Content Writer",
	social_dist_agent: "Social Dist. Agent",
	perf_analyst: "Performance Analyst",
	cso: "Chief Strategy Officer",
	cmo: "Chief Marketing Officer",
	crco: "Chief Risk Officer",
	integration_manager: "Integration Manager",
}

type WorkflowParams = {
	campaignId: string
	instruction: string
	assignments: any[]
	isExecReview?: boolean
}

export class GrowthOpsWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
	async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
		const { campaignId, instruction, assignments, isExecReview } = event.payload
		const actualRunId = `${campaignId}-${Date.now()}` // Fallback unique ID

		console.log(`[Workflow] STARTING RUN detected. ID: ${actualRunId}`)
		console.log(`[Workflow] Initial Assignments:`, JSON.stringify(assignments))

		try {
			const campaignRow = await this.env.DB.prepare(
				"SELECT project_id FROM campaigns WHERE id = ? OR do_id = ?"
			)
				.bind(campaignId, campaignId)
				.first<{ project_id: number }>()
			const projectId = campaignRow?.project_id
				? String(campaignRow.project_id)
				: null

			await this.logRunStart(actualRunId, instruction)

			// ==========================================
			// EXECUTION PHASE (THE MUSCLE)
			// ==========================================
			// ==========================================
			// EXECUTION PHASE (THE MUSCLE)
			// ==========================================
			const results: any[] = []

			// Dynamic Job Queue: Allows agents like CampaignManager to spawn sub-tasks
			const jobQueue = [...assignments]
			// Safety: Circular loop prevention or max depth could be added,
			// but for now max steps is implicitly limited by Cloudflare Workflow limits (or we can add a counter).
			let stepCount = 0
			const MAX_STEPS = 20

			while (jobQueue.length > 0) {
				if (stepCount >= MAX_STEPS) {
					console.warn("Max workflow steps reached. Stopping expansion.")
					break
				}
				const job = jobQueue.shift()
				stepCount++

				const stepName = `exec_${job.agent}_${Date.now()}_${stepCount}`
				console.log(
					`[Workflow] Step ${stepCount}: Executing Agent ${job.agent}. Task: "${job.task?.substring(0, 50)}..."`
				)

				// Set Agent to Active
				await this.updateAgentStatus(
					job.agent,
					"active",
					job.task || "Processing task...",
					0
				)

				const jobResult = await step.do(stepName, async () => {
					let agent
					// Map agent role strings to Classes
					switch (job.agent) {
						case "campaign_manager":
							agent = new CampaignManager(
								this.env,
								"CampaignManager",
								"manager"
							)
							break
						case "content_manager":
							agent = new ContentManager(this.env, "ContentManager", "manager")
							break
						case "growth_manager":
							agent = new GrowthManager(this.env, "GrowthManager", "manager")
							break
						case "research_agent":
							agent = new ResearchAgent(this.env, "ResearchAgent", "worker")
							break
						case "audience_analyst":
							agent = new AudienceAnalyst(this.env, "AudienceAnalyst", "worker")
							break
						case "seo_strategist":
							agent = new SEOStrategist(this.env, "SEOStrategist", "worker")
							break
						case "content_writer":
							agent = new ContentWriter(this.env, "ContentWriter", "worker")
							break
						case "social_dist_agent":
							agent = new SocialDistributionAgent(
								this.env,
								"SocialDistributionAgent",
								"worker"
							)
							break
						case "perf_analyst":
							agent = new PerformanceAnalyst(
								this.env,
								"PerformanceAnalyst",
								"worker"
							)
							break
						case "cso":
							agent = new CSO(this.env, "CSO", "executive")
							break
						case "cmo":
							agent = new CMO(this.env, "CMO", "executive")
							break
						case "crco":
							agent = new CRCO(this.env, "CRCO", "executive")
							break
						case "integration_manager": // Explicit integration manager assignment
							agent = new IntegrationManager(
								this.env,
								"IntegrationManager",
								"manager"
							)
							break
						default:
							agent = new CampaignManager(this.env, "Worker", "manager")
					}

					// Execute Agent
					// Pass accumulated history of this run so agents can see previous work (e.g. Manager reviewing Writer)
					const runHistory = results.map((r) => ({
						agent: r.agent,
						output: r.output,
						task: r.input?.task || "unknown",
					}))

					let context
					if (projectId) {
						if (job.agent === "content_writer") {
							const taskType = classifyTaskType(job.task || "")
							context = await routeContext(this.env, {
								projectId,
								task: job.task || instruction,
								taskType,
								requestedTypes:
									taskType === "content_revision"
										? ["brand_voice", "product"]
										: ["brand_voice", "product", "audience"],
							})
						} else if (job.agent === "crco") {
							context = await routeContext(this.env, {
								projectId,
								task: job.task || instruction,
								taskType: "compliance_review",
								requestedTypes: ["compliance"],
							})
						} else if (job.agent === "cso" || job.agent === "cmo") {
							context = await routeContext(this.env, {
								projectId,
								task: job.task || instruction,
								taskType: "executive_approval",
								requestedTypes: ["summary"],
							})
						} else if (
							job.agent === "campaign_manager" ||
							job.agent === "growth_manager"
						) {
							context = await routeContext(this.env, {
								projectId,
								task: job.task || instruction,
								taskType: "strategy_planning",
								requestedTypes: ["competitors", "audience"],
							})
						}
					}

					const res = await agent.run({
						task: job.task,
						history: runHistory, // Pass the simplified history
						context: context || undefined,
						originalInstruction: instruction, // Pass user's original request for constraint parsing
						projectId: projectId || undefined,
						runId: actualRunId,
					})
					console.log(
						`[Workflow] Agent ${job.agent} output:`,
						JSON.stringify(res.output, null, 2)
					)

					await this.logStep(
						actualRunId, // Use unique Run ID
						job.agent,
						job.agent.toUpperCase(),
						"execution",
						{ task: job.task },
						res.output
					)

					// Set back to idle
					await this.updateAgentStatus(
						job.agent,
						"idle",
						"Waiting for next task...",
						100
					)

					return {
						agent: job.agent,
						output: res.output,
						input: { task: job.task },
					}
				})

				results.push(jobResult)

				// DYNAMIC EXPANSION: Check for new tasks
				if (
					jobResult.output &&
					jobResult.output.tasks &&
					Array.isArray(jobResult.output.tasks)
				) {
					console.log(
						`[Workflow] DETECTED SUB-TASKS in output from ${jobResult.agent}`
					)
					// Verify new tasks structure
					const newTasks = jobResult.output.tasks.filter(
						(t: any) => t.agent && (t.task || t.instruction)
					)
					if (newTasks.length > 0) {
						// Normalize 'instruction' to 'task' if needed
						const mappedTasks = newTasks.map((t: any) => ({
							agent: t.agent,
							task: t.task || t.instruction, // Handle both
						}))

						jobQueue.push(...mappedTasks)
						console.log(
							`[Workflow] ADDED ${mappedTasks.length} new tasks to queue. New Queue Length: ${jobQueue.length}`
						)
						console.log(`[Workflow] New Tasks:`, JSON.stringify(mappedTasks))
					} else {
						console.warn(
							`[Workflow] Sub-tasks found but invalid format (missing agent or task).`
						)
					}
				} else {
					console.log(`[Workflow] No sub-tasks found in output.`)
				}
			}

			console.log(
				`[Workflow] Execution Loop Finished. Total Jobs Ran: ${results.length}`
			)

			// ==========================================
			// LOGIC FORK: EXEC REVIEW vs NORMAL DRAFT
			// ==========================================

			if (isExecReview) {
				// AGGREGATE EXECUTIVE FEEDBACK
				const finalOutput = {
					approved: results.every((r) => r.output.approved === true),
					reviews: results.map((r) => ({
						agent: r.agent,
						approved: r.output.approved,
						feedback: r.output.feedback,
						flags: r.output.risk_flags || r.output.concerns || [],
					})),
				}

				// CALLBACK TO BRAIN (CampaignDO)
				const id = this.env.CAMPAIGN_DO.idFromString(campaignId)
				const stub = this.env.CAMPAIGN_DO.get(id)

				await stub.fetch("http://internal/webhook", {
					method: "POST",
					body: JSON.stringify({
						type: "EXEC_REVIEW_COMPLETE",
						payload: finalOutput,
					}),
				})

				await this.logRunComplete(actualRunId, "completed", finalOutput)
				return finalOutput
			} else {
				// NORMAL DRAFTING FLOW
				// Requires Integration Manager to synthesize

				// Check if integration already ran (if it was in assignments)
				// If not, we might want to run it automatically or assume PM assigned it.
				// For now, let's keep the automatic integration step for "Normal Drafts"
				// to ensure the PM gets a nice summary.

				const finalOutput = await step.do(
					"integration_manager_final",
					async () => {
						const agent = new IntegrationManager(
							this.env,
							"Integration Manager",
							"manager"
						)

						const { results: runHistory } = await this.env.DB.prepare(
							"SELECT agent_role, output FROM run_steps WHERE run_id = ? AND status = 'completed' ORDER BY created_at ASC"
						)
							.bind(actualRunId)
							.all()

						const result = await agent.run({
							task: "Integrate results into a cohesive draft package.",
							history: runHistory,
							projectId: projectId || undefined,
							runId: actualRunId,
						})

						// CALLBACK TO BRAIN
						const id = this.env.CAMPAIGN_DO.idFromString(campaignId)
						const stub = this.env.CAMPAIGN_DO.get(id)

						await stub.fetch("http://internal/webhook", {
							method: "POST",
							body: JSON.stringify({
								type: "WORK_COMPLETE",
								payload: result.output,
							}),
						})

						return result.output
					}
				)

				await this.logRunComplete(actualRunId, "completed", finalOutput)
				return finalOutput
			}
		} catch (e: any) {
			console.error("Workflow Failed", e)
			await this.logRunComplete(actualRunId, "failed", { error: e.message })
			throw e
		}
	}

	private async logRunStart(runId: string, instruction: string) {
		await this.env.DB.prepare(
			`INSERT INTO runs (id, instruction, status, start_time) VALUES (?, ?, ?, ?)`
		)
			.bind(runId, instruction, "pending", Date.now())
			.run()
	}

	private async logRunComplete(
		runId: string,
		status: "completed" | "failed",
		result?: any
	) {
		await this.env.DB.prepare(
			`UPDATE runs SET status = ?, end_time = ?, result = ? WHERE id = ?`
		)
			.bind(status, Date.now(), JSON.stringify(result), runId)
			.run()
	}

	private async logStep(
		runId: string,
		role: string,
		agentName: string,
		stepName: string,
		input: any,
		output: any
	) {
		await this.env.DB.prepare(
			`INSERT INTO run_steps (run_id, agent_role, agent_name, step_name, status, input, output, completed_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(
				runId,
				role,
				agentName,
				stepName,
				"completed",
				JSON.stringify(input),
				JSON.stringify(output),
				Date.now()
			)
			.run()
	}

	private async updateAgentStatus(
		slug: string,
		status: "idle" | "active" | "paused",
		activity: string,
		progress: number
	) {
		try {
			// Check if agent exists
			const exists = await this.env.DB.prepare(
				"SELECT id FROM agents WHERE slug = ?"
			)
				.bind(slug)
				.first()

			if (exists) {
				await this.env.DB.prepare(
					"UPDATE agents SET status = ?, activity = ?, progress = ?, last_updated = ? WHERE slug = ?"
				)
					.bind(status, activity, progress, Date.now(), slug)
					.run()
			} else {
				// Create if not exists (Lazy registration)
				const name = AGENT_DISPLAY_NAMES[slug] || slug
				const role =
					slug.includes("manager") || slug.includes("officer")
						? "Manager"
						: "Specialist"

				await this.env.DB.prepare(
					"INSERT INTO agents (slug, name, role, status, activity, progress, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)"
				)
					.bind(slug, name, role, status, activity, progress, Date.now())
					.run()
			}
		} catch (e) {
			console.error(`[Workflow] Failed to update agent status for ${slug}:`, e)
		}
	}
}
