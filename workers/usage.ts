type UsageMetadata = {
	promptTokenCount?: number
	candidatesTokenCount?: number
	totalTokenCount?: number
	cachedContentTokenCount?: number
	thoughtsTokenCount?: number
	toolUsePromptTokenCount?: number
	trafficType?: string
}

type TokenUsage = {
	inputTokens: number
	outputTokens: number
	totalTokens: number
	usedCountTokens: boolean
}

type UsageEvent = {
	model: string
	operation: "generate" | "stream" | "embed"
	inputTokens?: number | null
	outputTokens?: number | null
	totalTokens?: number | null
	source?: string | null
	projectId?: string | number | null
	runId?: string | null
	metadata?: Record<string, unknown>
	createdAt?: number
	costUsdOverride?: number
}

type Pricing = {
	label: string
	inputPer1M: number
	outputPer1M: number
}

// Update these to your negotiated rates (USD per 1M tokens).
const MODEL_PRICING: Record<string, Pricing> = {
	"gemini-flash-latest": {
		label: "Gemini Flash",
		inputPer1M: 0.3,
		outputPer1M: 2.5,
	},
	"gemini-flash-lite-latest": {
		label: "Gemini Flash Lite",
		inputPer1M: 0.1,
		outputPer1M: 0.4,
	},
	"gemini-3-flash-preview": {
		label: "Gemini 3 Flash Preview",
		inputPer1M: 0.5,
		outputPer1M: 3.0,
	},
	"text-embedding-004": {
		label: "Text Embedding 004",
		inputPer1M: 0.1,
		outputPer1M: 0,
	},
	"gemini-2.5-flash-image": {
		label: "Nano Banana",
		inputPer1M: 0.3,
		outputPer1M: 2.5,
	},
}

const DEFAULT_PRICING: Pricing = {
	label: "Unpriced Model",
	inputPer1M: 0,
	outputPer1M: 0,
}

const normalizeTokenCount = (value?: number | null) => {
	if (typeof value !== "number" || !Number.isFinite(value)) return 0
	return Math.max(0, Math.round(value))
}

const roundCurrency = (value: number) =>
	Math.round(value * 1_000_000) / 1_000_000

export const getModelPricing = (model: string): Pricing =>
	MODEL_PRICING[model] || DEFAULT_PRICING

export const calculateCostUsd = (
	model: string,
	inputTokens: number,
	outputTokens: number
) => {
	const pricing = getModelPricing(model)
	const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M
	const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M
	return roundCurrency(inputCost + outputCost)
}

export const countTokensSafe = async (
	ai: any,
	model: string,
	contents: any,
	options?: { countTokensModel?: string; silent?: boolean }
): Promise<number | null> => {
	if (!ai || !model || contents == null) return null
	try {
		const targetModel = options?.countTokensModel || model
		const response = await ai.models.countTokens({
			model: targetModel,
			contents,
		})
		return normalizeTokenCount(response?.totalTokens)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		const status = (error as { status?: number } | null)?.status
		const unsupported =
			status === 404 ||
			message.includes("not supported for countTokens") ||
			message.includes("not found for API version")
		if (options?.silent || unsupported) return null
		console.error("[Usage] Token counting failed:", error)
		return null
	}
}

export const resolveTokenUsage = async ({
	ai,
	model,
	promptContents,
	outputText,
	usageMetadata,
}: {
	ai: any
	model: string
	promptContents: any
	outputText?: string
	usageMetadata?: UsageMetadata
}): Promise<TokenUsage> => {
	const promptTokens = normalizeTokenCount(usageMetadata?.promptTokenCount)
	const outputTokens = normalizeTokenCount(usageMetadata?.candidatesTokenCount)
	const totalTokens = normalizeTokenCount(usageMetadata?.totalTokenCount)

	let inputTokens = promptTokens || 0
	let completionTokens = outputTokens || 0
	let total = totalTokens || 0
	let usedCountTokens = false

	if (!promptTokens) {
		const counted = await countTokensSafe(ai, model, promptContents)
		if (typeof counted === "number") {
			inputTokens = counted
			usedCountTokens = true
		}
	}

	if (!outputTokens && outputText) {
		const counted = await countTokensSafe(ai, model, outputText)
		if (typeof counted === "number") {
			completionTokens = counted
			usedCountTokens = true
		}
	}

	if (!total) {
		total = inputTokens + completionTokens
	}

	return {
		inputTokens,
		outputTokens: completionTokens,
		totalTokens: total,
		usedCountTokens,
	}
}

const normalizeProjectId = (projectId?: string | number | null) => {
	if (projectId == null) return null
	const numeric = Number(projectId)
	if (!Number.isFinite(numeric)) return null
	return numeric
}

export const logUsageEvent = async (env: Env, event: UsageEvent) => {
	const inputTokens = normalizeTokenCount(event.inputTokens)
	const outputTokens = normalizeTokenCount(event.outputTokens)
	const totalTokens =
		normalizeTokenCount(event.totalTokens) || inputTokens + outputTokens
	const costUsd =
		typeof event.costUsdOverride === "number"
			? event.costUsdOverride
			: calculateCostUsd(event.model, inputTokens, outputTokens)

	const metadata = event.metadata ? JSON.stringify(event.metadata) : null
	const projectId = normalizeProjectId(event.projectId)

	try {
		await env.DB.prepare(
			`INSERT INTO usage_events (model, operation, input_tokens, output_tokens, total_tokens, cost_usd, source, project_id, run_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(
				event.model,
				event.operation,
				inputTokens,
				outputTokens,
				totalTokens,
				costUsd,
				event.source || null,
				projectId,
				event.runId || null,
				metadata
			)
			.run()
	} catch (error) {
		console.error("[Usage] Failed to log usage event:", error)
	}
}
