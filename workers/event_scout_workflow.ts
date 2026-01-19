import {
	WorkflowEntrypoint,
	WorkflowStep,
	type WorkflowEvent,
} from "cloudflare:workers"
import { EventScoutAgent } from "./agents"

type EventScoutParams = {
	projectId: number
	scanId: string
	searchParams?: {
		radius?: number
		eventTypes?: string[]
		location?: string
	}
}

type DiscoveredEvent = {
	name: string
	description: string
	event_date: string
	location: string
	distance: string
	source_url: string
	source_name: string
	event_type: string
	relevance_score: number
	relevance_reasoning: string
}

export class EventScoutWorkflow extends WorkflowEntrypoint<
	Env,
	EventScoutParams
> {
	async run(event: WorkflowEvent<EventScoutParams>, step: WorkflowStep) {
		const { projectId, scanId, searchParams } = event.payload
		const maxIterations = 5
		const now = Date.now()

		console.log(
			`[EventScoutWorkflow] Starting scan ${scanId} for project ${projectId}`
		)

		try {
			// Update scan status to RUNNING
			await step.do("mark_running", async () => {
				await this.env.DB.prepare(
					"UPDATE event_scans SET status = 'RUNNING', started_at = ? WHERE id = ?"
				)
					.bind(now, scanId)
					.run()
			})

			// Step 1: Fetch business context from project intake
			const businessContext = await step.do(
				"fetch_business_context",
				async () => {
					// Get project info
					const project = await this.env.DB.prepare(
						"SELECT name, description, industry, website_url FROM projects WHERE id = ?"
					)
						.bind(projectId)
						.first<{
							name: string
							description: string
							industry: string
							website_url: string
						}>()

					// Get active intake data
					const intake = await this.env.DB.prepare(
						"SELECT data_json, ai_context_pack_json FROM project_intake_versions WHERE project_id = ? AND status = 'ACTIVE' ORDER BY version_num DESC LIMIT 1"
					)
						.bind(projectId)
						.first<{ data_json: string; ai_context_pack_json: string }>()

					let intakeData = null
					let contextPack = null
					try {
						if (intake?.data_json) intakeData = JSON.parse(intake.data_json)
						if (intake?.ai_context_pack_json)
							contextPack = JSON.parse(intake.ai_context_pack_json)
					} catch (e) {
						console.warn("[EventScoutWorkflow] Failed to parse intake JSON", e)
					}

					return {
						project,
						intakeData,
						contextPack,
					}
				}
			)

			// Build business summary for the agent
			const businessSummary = this.buildBusinessSummary(
				businessContext,
				searchParams
			)
			console.log(`[EventScoutWorkflow] Business Summary:`, businessSummary)

			// Step 2: Iterative Research Loop
			const allEvents: DiscoveredEvent[] = []
			let previousSearches: string[] = []
			let iteration = 0
			let continueResearch = true

			while (continueResearch && iteration < maxIterations) {
				iteration++
				console.log(
					`[EventScoutWorkflow] Starting iteration ${iteration}/${maxIterations}`
				)

				const iterationResult = await step.do(
					`research_iteration_${iteration}`,
					async () => {
						const agent = new EventScoutAgent(
							this.env,
							"EventScoutAgent",
							"scout"
						)

						const result = await agent.run({
							task: `Find relevant events for this business. Iteration ${iteration} of ${maxIterations}.`,
							context: {
								todayDate: new Date().toLocaleDateString("en-US", {
									weekday: "long",
									year: "numeric",
									month: "long",
									day: "numeric",
								}),
								businessContext: businessSummary,
								previousSearches,
								previousEventsFound: allEvents.map((e) => e.name),
								iteration,
								maxIterations,
								searchParams: searchParams || {},
							},
							projectId: String(projectId),
							runId: scanId,
						})

						return result.output
					}
				)

				// Update iteration count in DB
				await this.env.DB.prepare(
					"UPDATE event_scans SET iteration_count = ? WHERE id = ?"
				)
					.bind(iteration, scanId)
					.run()

				// Process results
				if (
					iterationResult?.events_found &&
					Array.isArray(iterationResult.events_found)
				) {
					// Add new events (deduplicate by name + url)
					const existingKeys = new Set(
						allEvents.map((e) => `${e.name}|${e.source_url}`.toLowerCase())
					)

					for (const event of iterationResult.events_found) {
						const key = `${event.name}|${event.source_url}`.toLowerCase()
						if (!existingKeys.has(key)) {
							allEvents.push(event as DiscoveredEvent)
							existingKeys.add(key)
						}
					}
				}

				// Track what we searched
				if (iterationResult?.iteration_summary) {
					previousSearches.push(iterationResult.iteration_summary)
				}
				if (iterationResult?.next_search_ideas) {
					previousSearches.push(...iterationResult.next_search_ideas)
				}

				// Check if we should continue
				continueResearch = iterationResult?.continue_research === true

				console.log(
					`[EventScoutWorkflow] Iteration ${iteration} complete. Found ${allEvents.length} total events. Continue: ${continueResearch}`
				)
			}

			// Step 3: Persist discovered events
			await step.do("persist_events", async () => {
				for (const event of allEvents) {
					const eventId = crypto.randomUUID()
					await this.env.DB.prepare(
						`INSERT INTO discovered_events 
						(id, scan_id, project_id, name, description, event_date, location, distance, 
						 source_url, source_name, relevance_score, relevance_reasoning, event_type, 
						 status, raw_data_json)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?)`
					)
						.bind(
							eventId,
							scanId,
							projectId,
							event.name || "Unknown Event",
							event.description || "",
							event.event_date || "",
							event.location || "",
							event.distance || "",
							event.source_url || "",
							event.source_name || "",
							event.relevance_score || 50,
							event.relevance_reasoning || "",
							event.event_type || "unknown",
							JSON.stringify(event)
						)
						.run()
				}

				console.log(
					`[EventScoutWorkflow] Persisted ${allEvents.length} events to database`
				)
			})

			// Step 4: Mark scan as complete
			await step.do("mark_complete", async () => {
				await this.env.DB.prepare(
					"UPDATE event_scans SET status = 'COMPLETED', total_events_found = ?, completed_at = ? WHERE id = ?"
				)
					.bind(allEvents.length, Date.now(), scanId)
					.run()
			})

			console.log(
				`[EventScoutWorkflow] Scan ${scanId} completed with ${allEvents.length} events`
			)

			return {
				success: true,
				scanId,
				eventsFound: allEvents.length,
				iterations: iteration,
			}
		} catch (e: any) {
			console.error("[EventScoutWorkflow] Failed:", e)

			// Mark scan as failed
			await this.env.DB.prepare(
				"UPDATE event_scans SET status = 'FAILED', error_message = ?, completed_at = ? WHERE id = ?"
			)
				.bind(e.message || "Unknown error", Date.now(), scanId)
				.run()

			throw e
		}
	}

	private buildBusinessSummary(
		context: {
			project: {
				name: string
				description: string
				industry: string
				website_url: string
			} | null
			intakeData: any
			contextPack: any
		},
		searchParams?: EventScoutParams["searchParams"]
	): string {
		const parts: string[] = []

		// Project basics
		if (context.project) {
			parts.push(`Business Name: ${context.project.name || "Unknown"}`)
			if (context.project.description) {
				parts.push(`Description: ${context.project.description}`)
			}
			if (context.project.industry) {
				parts.push(`Industry: ${context.project.industry}`)
			}
			if (context.project.website_url) {
				parts.push(`Website: ${context.project.website_url}`)
			}
		}

		// From intake data
		if (context.intakeData) {
			const intake = context.intakeData
			if (intake.business_summary?.primary_offering) {
				parts.push(
					`Primary Offering: ${intake.business_summary.primary_offering}`
				)
			}
			if (intake.business_summary?.location) {
				parts.push(`Location: ${intake.business_summary.location}`)
			}
			if (intake.target_audience?.primary_audience) {
				parts.push(
					`Target Audience: ${intake.target_audience.primary_audience}`
				)
			}
			if (intake.product_services?.key_products) {
				parts.push(`Products/Services: ${intake.product_services.key_products}`)
			}
		}

		// From AI context pack
		if (context.contextPack) {
			const pack = context.contextPack
			if (pack.business_overview?.value_proposition) {
				parts.push(
					`Value Proposition: ${pack.business_overview.value_proposition}`
				)
			}
			if (pack.audience?.demographics) {
				parts.push(`Audience Demographics: ${pack.audience.demographics}`)
			}
		}

		// Search parameters override
		if (searchParams?.location) {
			parts.push(`Search Location: ${searchParams.location}`)
		}
		if (searchParams?.radius) {
			parts.push(`Search Radius: ${searchParams.radius} miles`)
		}
		if (searchParams?.eventTypes?.length) {
			parts.push(
				`Event Types of Interest: ${searchParams.eventTypes.join(", ")}`
			)
		}

		return parts.join("\n")
	}
}
