import {
	WorkflowEntrypoint,
	WorkflowStep,
	type WorkflowEvent,
} from "cloudflare:workers"
import { GoogleGenAI } from "@google/genai"
import { logUsageEvent, resolveTokenUsage } from "./usage"
import { syncProjectKnowledgeFromIntake } from "./knowledge"

export class IntakeWorkflow extends WorkflowEntrypoint<Env, any> {
	async run(event: WorkflowEvent<any>, step: WorkflowStep) {
		const { projectId, versionId, orgId, actorId } = event.payload
		const now = Date.now()

		console.log(
			`[IntakeWorkflow] Starting for Project ${projectId}, Version ${versionId}`
		)

		// Step 1: Fetch Data
		const version = await step.do("fetch_data", async () => {
			const result = await this.env.DB.prepare(
				"SELECT data_json, version_num FROM project_intake_versions WHERE id = ?"
			)
				.bind(versionId)
				.first<any>()
			return result
		})

		if (!version) {
			console.error(`[IntakeWorkflow] Version ${versionId} not found`)
			return
		}

		const data = JSON.parse(version.data_json)

		// Step 2: Generate Context Pack (Gemini)
		const aiOutput = await step.do("generate_ai_content", async () => {
			// @ts-ignore
			const ai = new GoogleGenAI({
				apiKey: this.env.GOOGLE_API_KEY,
				baseURL:
					"https://gateway.ai.cloudflare.com/v1/7435572da589819f03ce5407d4312dcb/growthopsai/google-ai-studio",
			})
			const model = "gemini-flash-lite-latest"

			const prompt = `
            Analyze this project intake data and generate a comprehensive "AI Context Pack" JSON and a short narrative summary.
            
            Input Data:
            ${JSON.stringify(data, null, 2)}
            
            Output Schema (JSON):
            {
                "context_pack": {
                    "business_overview": { ... },
                    "audience": { ... },
                    "brand_voice": { ... },
                    "competitors": { ... },
                    "offers": { ... },
                    "channels": { ... },
                    "strategic_notes": "AI derived insights"
                },
                "summary": "One paragraph narrative summary of the project."
            }
            
            Ensure the JSON is valid and the summary is concise.
            `

			try {
				const contents = [{ role: "user", parts: [{ text: prompt }] }]
				const result = await ai.models.generateContent({
					model,
					contents,
				})

				const text = result.text || ""
				const usage = await resolveTokenUsage({
					ai,
					model,
					promptContents: contents,
					outputText: text,
					usageMetadata: result.usageMetadata,
				})
				await logUsageEvent(this.env, {
					model,
					operation: "generate",
					inputTokens: usage.inputTokens,
					outputTokens: usage.outputTokens,
					totalTokens: usage.totalTokens,
					source: "intake_workflow",
					projectId,
					runId: `intake-${versionId}`,
					metadata: {
						workflow: "intake_workflow",
						project_id: projectId,
						version_id: versionId,
						used_count_tokens: usage.usedCountTokens,
						prompt_tokens: result.usageMetadata?.promptTokenCount ?? null,
						output_tokens: result.usageMetadata?.candidatesTokenCount ?? null,
						total_tokens: result.usageMetadata?.totalTokenCount ?? null,
					},
				})

				// Extract JSON if wrapped
				const jsonMatch =
					text.match(/```json\n([\s\S]*?)\n```/) ||
					text.match(/```([\s\S]*?)\n```/)
				const jsonStr = jsonMatch ? jsonMatch[1] : text

				return JSON.parse(jsonStr)
			} catch (e) {
				console.error("[IntakeWorkflow] AI Generation Failed", e)
				return {
					context_pack: {
						meta: {
							generated_at: new Date().toISOString(),
							error: "AI Generation Failed",
						},
						business_overview: data.business_summary || {},
						audience: data.target_audience || {},
					},
					summary: "AI Generation Failed",
				}
			}
		})

		// Step 3: Activate & Audit
		await step.do("activate_and_audit", async () => {
			await this.env.DB.batch([
				// Set Active
				this.env.DB.prepare(
					`
                    UPDATE project_intake_versions 
                    SET status = 'ACTIVE', 
                        activated_at = ?, 
                        ai_context_pack_json = ?, 
                        ai_summary = ? 
                    WHERE id = ?
                `
				).bind(
					now,
					JSON.stringify(aiOutput.context_pack),
					aiOutput.summary,
					versionId
				),

				// Supersede Old
				this.env.DB.prepare(
					`
                    UPDATE project_intake_versions 
                    SET status = 'SUPERSEDED' 
                    WHERE project_id = ? AND status = 'ACTIVE' AND id != ?
                `
				).bind(projectId, versionId),

				// Activate Project
				this.env.DB.prepare(
					`
                    UPDATE projects SET status = 'ACTIVE' WHERE id = ?
                `
				).bind(projectId),

				// Audit
				this.env.DB.prepare(
					`
                    INSERT INTO audit_log (entity_type, entity_id, action, actor, details, timestamp) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `
				).bind(
					"INTAKE_VERSION",
					versionId,
					"INTAKE_PROCESSED_WORKFLOW",
					actorId || "system",
					JSON.stringify({ summary_len: aiOutput.summary.length }),
					now
				),
			])
		})

		await step.do("sync_project_knowledge", async () => {
			await syncProjectKnowledgeFromIntake(this.env, projectId, data, {
				versionOverride: version.version_num,
				shouldIndex: true,
			})
		})

		console.log(`[IntakeWorkflow] Completed for ${versionId}`)
	}
}
