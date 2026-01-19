import { GoogleGenAI } from "@google/genai"
import { countTokensSafe, logUsageEvent } from "./usage"
import {
	KnowledgeContextType,
	KnowledgeTaskType,
	buildKnowledgeSummary,
	getProjectKnowledge,
} from "./knowledge"

type ContextRouterRequest = {
	projectId: string
	task: string
	taskType?: KnowledgeTaskType
	requestedTypes?: KnowledgeContextType[]
	maxResultsPerType?: number
}

type VectorMatch = {
	id: string
	score: number
	metadata?: Record<string, unknown>
}

type ContextRouterResult = {
	task_type: KnowledgeTaskType
	types: KnowledgeContextType[]
	summary?: Record<string, unknown> | null
	vectors?: Record<KnowledgeContextType, VectorMatch[]>
}

const TASK_CONTEXT_MAP: Record<KnowledgeTaskType, KnowledgeContextType[]> = {
	creative_draft: [],
	content_revision: ["brand_voice", "product"],
	compliance_review: ["compliance"],
	strategy_planning: ["competitors", "audience"],
	executive_approval: ["summary"],
	other: [],
}

const keywordMatch = (task: string, keywords: string[]) => {
	const lower = task.toLowerCase()
	return keywords.some((keyword) => lower.includes(keyword))
}

export const classifyTaskType = (task: string): KnowledgeTaskType => {
	if (!task) return "other"
	if (
		keywordMatch(task, [
			"revise",
			"revision",
			"edit",
			"rewrite",
			"improve",
			"fix",
			"update",
		])
	) {
		return "content_revision"
	}
	if (keywordMatch(task, ["compliance", "legal", "risk", "policy"])) {
		return "compliance_review"
	}
	if (
		keywordMatch(task, [
			"strategy",
			"positioning",
			"market",
			"competitor",
			"audience",
			"plan",
		])
	) {
		return "strategy_planning"
	}
	if (keywordMatch(task, ["approve", "executive", "sign-off", "sign off"])) {
		return "executive_approval"
	}
	if (keywordMatch(task, ["draft", "write", "create", "generate", "compose"])) {
		return "creative_draft"
	}
	return "other"
}

const resolveContextTypes = (
	taskType: KnowledgeTaskType,
	requested?: KnowledgeContextType[],
): KnowledgeContextType[] => {
	const allowed = TASK_CONTEXT_MAP[taskType] || []
	if (taskType === "other") return requested || []
	if (!requested || requested.length === 0) return allowed
	return requested.filter((type) => allowed.includes(type))
}

const normalizeTopK = (value?: number) => {
	if (typeof value !== "number" || !Number.isFinite(value)) return 5
	const rounded = Math.round(value)
	return Math.min(Math.max(rounded, 1), 50)
}

const isVectorQueryBadRequest = (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error)
	return message.includes("VECTOR_QUERY_ERROR") && message.includes("400")
}

const buildVectorFilterAttempts = (
	projectId: string,
	type: KnowledgeContextType,
) => {
	const numericProjectId = Number(projectId)
	const projectIds: Array<string | number> = Number.isFinite(numericProjectId)
		? [projectId, numericProjectId]
		: [projectId]
	const filters: Array<Record<string, string | number> | undefined> = []
	for (const id of projectIds) {
		filters.push({ project_id: id, type })
		filters.push({ project_id: id })
	}
	filters.push(undefined)
	return filters
}

const matchesVectorMetadata = (
	match: { metadata?: Record<string, unknown> },
	projectId: string,
	type: KnowledgeContextType,
) => {
	const metadata = match.metadata || {}
	const projectIdValue = metadata.project_id
	const typeValue = metadata.type
	if (projectIdValue == null || typeValue == null) return false
	return String(projectIdValue) === projectId && String(typeValue) === type
}

const queryVectorsWithFallback = async (
	env: Env,
	embedding: number[],
	projectId: string,
	type: KnowledgeContextType,
	topK: number,
) => {
	const filters = buildVectorFilterAttempts(projectId, type)
	const fallbackTopK = Math.min(topK * 5, 100)

	for (const filter of filters) {
		try {
			const queryOptions = filter ? { topK, filter } : { topK: fallbackTopK }
			return (await env.VECTORIZE.query(embedding, queryOptions)) as {
				matches?: Array<{ id: string; score: number; metadata?: any }>
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			// Catch 400s (Bad Request) AND Authentication errors (10000) or others to prevent crash
			if (
				!isVectorQueryBadRequest(error) &&
				!message.includes("Authentication error")
			) {
				throw error
			}
			console.warn(
				`[ContextRouter] Vectorize query failed (${message}); relaxing filter/retrying or falling back to empty.`,
			)
		}
	}

	return { matches: [] }
}

const getEmbedding = async (
	env: Env,
	text: string,
	options?: { projectId?: string },
): Promise<number[]> => {
	if (!env.GOOGLE_API_KEY) {
		throw new Error("Missing GOOGLE_API_KEY for embeddings")
	}
	const ai = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY })
	const model = "text-embedding-004"
	const contents = [text]
	const response = await ai.models.embedContent({
		model,
		contents,
	})
	const embedding = response.embeddings?.[0]?.values
	if (!embedding || embedding.length === 0) {
		throw new Error("Embedding generation failed")
	}
	const countTokensModel = "gemini-flash-lite-latest"
	const inputTokens = await countTokensSafe(ai, model, contents, {
		countTokensModel,
		silent: true,
	})
	await logUsageEvent(env, {
		model,
		operation: "embed",
		inputTokens: inputTokens ?? 0,
		outputTokens: 0,
		totalTokens: inputTokens ?? 0,
		source: "context_router",
		projectId: options?.projectId,
		metadata: {
			operation: "route_context",
			counted_tokens: inputTokens != null,
			count_tokens_model: countTokensModel,
			count_tokens_model_is_fallback: countTokensModel !== model,
		},
	})
	return embedding
}

export const routeContext = async (
	env: Env,
	request: ContextRouterRequest,
): Promise<ContextRouterResult> => {
	const taskType = request.taskType || classifyTaskType(request.task)
	const types = resolveContextTypes(taskType, request.requestedTypes)

	const result: ContextRouterResult = {
		task_type: taskType,
		types,
		summary: null,
		vectors: undefined,
	}

	if (types.length === 0) {
		return result
	}

	if (types.includes("summary")) {
		const knowledge = await getProjectKnowledge(env, request.projectId)
		result.summary = knowledge ? buildKnowledgeSummary(knowledge) : null
	}

	const vectorTypes = types.filter((type) => type !== "summary")
	if (vectorTypes.length === 0) {
		return result
	}
	if (!request.task || request.task.trim().length === 0) {
		return result
	}

	const embedding = await getEmbedding(env, request.task, {
		projectId: request.projectId,
	})
	const vectors: Record<KnowledgeContextType, VectorMatch[]> = {}
	const topK = normalizeTopK(request.maxResultsPerType)

	for (const type of vectorTypes) {
		const response = await queryVectorsWithFallback(
			env,
			embedding,
			request.projectId,
			type,
			topK,
		)
		const filtered = (response.matches || []).filter((match) =>
			matchesVectorMetadata(match, request.projectId, type),
		)
		vectors[type] = filtered.slice(0, topK).map((match) => ({
			id: match.id,
			score: match.score,
			metadata: match.metadata,
		}))
	}

	result.vectors = vectors
	return result
}
