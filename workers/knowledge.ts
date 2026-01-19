import { GoogleGenAI } from "@google/genai"
import { countTokensSafe, logUsageEvent } from "./usage"

export type KnowledgeDocType =
	| "product"
	| "brand_voice"
	| "audience"
	| "compliance"
	| "competitors"

export type KnowledgeTaskType =
	| "creative_draft"
	| "content_revision"
	| "compliance_review"
	| "strategy_planning"
	| "executive_approval"
	| "other"

export type KnowledgeContextType =
	| "product"
	| "brand_voice"
	| "audience"
	| "compliance"
	| "competitors"
	| "summary"

export type KnowledgeDocument = {
	metadata: {
		project_id: string
		type: KnowledgeDocType
		version: number
		generated_at: number
	}
	sections: Array<{
		id: string
		title: string
		kind: "text"
		content: string
	}>
}

type ProjectKnowledgeProduct = {
	summary?: string
	details?: string
	offer?: string
	pricing?: string
	primary_call_to_action?: string
	primary_goal?: string
	geographic_focus?: string
	website_url?: string
}

type ProjectKnowledgeBrandVoice = {
	personality?: Record<string, number>
	core_values?: string[]
	words_to_use?: string[]
	words_to_avoid?: string[]
	visual?: {
		brand_colors?: string[]
		fonts?: string[]
		image_style?: string
		logo_url?: string
	}
	topics_focus?: string[]
}

type ProjectKnowledgeAudience = {
	ideal_customer_description?: string
	pain_points?: string[]
	demographics?: string
	exclusions?: string
	geographic_focus?: string
	active_channels?: string[]
}

type ProjectKnowledgeCompetitors = {
	competitor_list?: string[]
	differentiators?: string
	we_win_because?: string
}

type ProjectKnowledgeInput = {
	company_name: string | null
	product: ProjectKnowledgeProduct
	brand_voice: ProjectKnowledgeBrandVoice
	target_audience: ProjectKnowledgeAudience
	competitors: ProjectKnowledgeCompetitors
	approved_claims: string[]
	disallowed_claims: string[]
	compliance_rules: string[]
	platforms_enabled: string[]
}

export type ProjectKnowledgeRow = {
	id: string
	project_id: number
	company_name: string | null
	product_description: string | null
	brand_voice: string | null
	target_audience: string | null
	competitors: string | null
	approved_claims: string | null
	disallowed_claims: string | null
	compliance_rules: string | null
	platforms_enabled: string | null
	last_indexed_at: number | null
	version: number
	updated_at: number
}

type KnowledgeChunk = {
	id: string
	text: string
	section_id: string
	section_title: string
	order: number
}

const KNOWLEDGE_DOC_TYPES: KnowledgeDocType[] = [
	"product",
	"brand_voice",
	"audience",
	"compliance",
	"competitors",
]

const MAX_CHUNK_CHARS = 1200
const CHUNK_OVERLAP = 120
const VECTOR_UPSERT_BATCH = 50

const toStringOrNull = (value: unknown): string | null => {
	if (typeof value !== "string") return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

const normalizeList = (value: unknown): string[] => {
	if (!value) return []
	if (Array.isArray(value)) {
		return value
			.map((item) => (typeof item === "string" ? item : ""))
			.map((item) => item.trim())
			.filter((item) => item.length > 0)
	}
	if (typeof value === "string") {
		return value
			.split(/\n|,|;|\|/)
			.map((item) => item.replace(/^\s*\d+[.)]\s*/, "").trim())
			.filter((item) => item.length > 0)
	}
	return []
}

const normalizeNumberMap = (value: Record<string, unknown> | undefined) => {
	if (!value) return undefined
	const entries = Object.entries(value)
	const numeric: Record<string, number> = {}
	for (const [key, val] of entries) {
		if (typeof val === "number" && Number.isFinite(val)) {
			numeric[key] = val
		}
	}
	return Object.keys(numeric).length > 0 ? numeric : undefined
}

const buildProductDescription = (product: ProjectKnowledgeProduct) => {
	const parts: string[] = []
	if (product.summary) parts.push(`Summary: ${product.summary}`)
	if (product.details) parts.push(`Details: ${product.details}`)
	if (product.offer) parts.push(`Primary Offer: ${product.offer}`)
	if (product.pricing) parts.push(`Pricing: ${product.pricing}`)
	if (product.primary_call_to_action)
		parts.push(`Primary CTA: ${product.primary_call_to_action}`)
	if (product.primary_goal) parts.push(`Primary Goal: ${product.primary_goal}`)
	if (product.geographic_focus)
		parts.push(`Geographic Focus: ${product.geographic_focus}`)
	if (product.website_url) parts.push(`Website: ${product.website_url}`)
	return parts.join("\n")
}

const safeJsonStringify = (value: unknown) => JSON.stringify(value ?? null)

const parseJsonOrNull = <T>(value: string | null): T | null => {
	if (!value) return null
	try {
		return JSON.parse(value) as T
	} catch {
		return null
	}
}

export const normalizeIntakeToKnowledge = (
	intakeData: Record<string, any>
): ProjectKnowledgeInput => {
	const projectBasics = intakeData.project_basics || {}
	const businessSummary = intakeData.business_summary || {}
	const offerFunnel = intakeData.offer_funnel || {}
	const brandVoice = intakeData.brand_voice || {}
	const visualBrand = intakeData.visual_brand || {}
	const targetAudience = intakeData.target_audience || {}
	const competitors = intakeData.competitors || {}
	const channels = intakeData.channels || {}
	const examples = intakeData.examples || {}
	const compliance = intakeData.compliance || {}
	const claims = intakeData.claims || {}

	const product: ProjectKnowledgeProduct = {
		summary: toStringOrNull(businessSummary.short_description) || undefined,
		details:
			toStringOrNull(businessSummary.product_or_service_description) ||
			undefined,
		offer: toStringOrNull(offerFunnel.primary_offer) || undefined,
		pricing: toStringOrNull(offerFunnel.pricing_range) || undefined,
		primary_call_to_action:
			toStringOrNull(offerFunnel.primary_call_to_action) || undefined,
		primary_goal: toStringOrNull(businessSummary.primary_goal) || undefined,
		geographic_focus:
			toStringOrNull(businessSummary.geographic_focus) || undefined,
		website_url: toStringOrNull(projectBasics.website_url) || undefined,
	}

	const brand_voice: ProjectKnowledgeBrandVoice = {
		personality: normalizeNumberMap(brandVoice) || undefined,
		core_values: normalizeList(brandVoice.brand_values),
		words_to_use: normalizeList(brandVoice.words_we_like),
		words_to_avoid: normalizeList(brandVoice.words_we_avoid),
		visual: {
			brand_colors: normalizeList(visualBrand.brand_colors),
			fonts: normalizeList(visualBrand.fonts),
			image_style: toStringOrNull(visualBrand.image_style) || undefined,
			logo_url: toStringOrNull(visualBrand.logo_url) || undefined,
		},
		topics_focus: normalizeList(channels.topics_focus),
	}

	const target_audience: ProjectKnowledgeAudience = {
		ideal_customer_description:
			toStringOrNull(targetAudience.ideal_customer_description) || undefined,
		pain_points: normalizeList(targetAudience.top_pain_points),
		demographics: toStringOrNull(targetAudience.demographics) || undefined,
		exclusions: toStringOrNull(targetAudience.exclusions) || undefined,
		geographic_focus:
			toStringOrNull(businessSummary.geographic_focus) || undefined,
		active_channels: normalizeList(channels.active_channels),
	}

	const competitors_block: ProjectKnowledgeCompetitors = {
		competitor_list: normalizeList(competitors.competitor_list),
		differentiators: toStringOrNull(competitors.differentiators) || undefined,
		we_win_because: toStringOrNull(competitors.we_win_because) || undefined,
	}

	const compliance_rules = normalizeList(compliance.rules).concat(
		normalizeList(examples.banned_content)
	)

	return {
		company_name: toStringOrNull(projectBasics.project_name),
		product,
		brand_voice,
		target_audience,
		competitors: competitors_block,
		approved_claims: normalizeList(
			compliance.approved_claims || claims.approved_claims
		),
		disallowed_claims: normalizeList(
			compliance.disallowed_claims || claims.disallowed_claims
		),
		compliance_rules,
		platforms_enabled: normalizeList(channels.active_channels),
	}
}

export const buildKnowledgeDocuments = (
	projectId: string,
	version: number,
	knowledge: ProjectKnowledgeInput
): Record<KnowledgeDocType, KnowledgeDocument> => {
	const generatedAt = Date.now()

	const productSections: KnowledgeDocument["sections"] = []
	if (knowledge.company_name) {
		productSections.push({
			id: "company-name",
			title: "Company",
			kind: "text",
			content: knowledge.company_name,
		})
	}
	const productDescription = buildProductDescription(knowledge.product)
	if (productDescription) {
		productSections.push({
			id: "product-description",
			title: "Product Description",
			kind: "text",
			content: productDescription,
		})
	}

	const brandSections: KnowledgeDocument["sections"] = []
	if (knowledge.brand_voice.core_values?.length) {
		brandSections.push({
			id: "brand-values",
			title: "Core Values",
			kind: "text",
			content: knowledge.brand_voice.core_values.join(", "),
		})
	}
	if (knowledge.brand_voice.personality) {
		brandSections.push({
			id: "brand-personality",
			title: "Voice Personality",
			kind: "text",
			content: Object.entries(knowledge.brand_voice.personality)
				.map(([key, value]) => `${key}: ${value}`)
				.join("\n"),
		})
	}
	if (knowledge.brand_voice.words_to_use?.length) {
		brandSections.push({
			id: "brand-words-use",
			title: "Words We Like",
			kind: "text",
			content: knowledge.brand_voice.words_to_use.join(", "),
		})
	}
	if (knowledge.brand_voice.words_to_avoid?.length) {
		brandSections.push({
			id: "brand-words-avoid",
			title: "Words to Avoid",
			kind: "text",
			content: knowledge.brand_voice.words_to_avoid.join(", "),
		})
	}
	if (knowledge.brand_voice.topics_focus?.length) {
		brandSections.push({
			id: "brand-topics",
			title: "Topics to Focus On",
			kind: "text",
			content: knowledge.brand_voice.topics_focus.join(", "),
		})
	}
	if (knowledge.brand_voice.visual) {
		const visuals: string[] = []
		if (knowledge.brand_voice.visual.logo_url) {
			visuals.push(`Logo: ${knowledge.brand_voice.visual.logo_url}`)
		}
		if (knowledge.brand_voice.visual.brand_colors?.length) {
			visuals.push(
				`Colors: ${knowledge.brand_voice.visual.brand_colors.join(", ")}`
			)
		}
		if (knowledge.brand_voice.visual.fonts?.length) {
			visuals.push(`Fonts: ${knowledge.brand_voice.visual.fonts.join(", ")}`)
		}
		if (knowledge.brand_voice.visual.image_style) {
			visuals.push(`Image Style: ${knowledge.brand_voice.visual.image_style}`)
		}
		if (visuals.length > 0) {
			brandSections.push({
				id: "brand-visuals",
				title: "Visual Brand",
				kind: "text",
				content: visuals.join("\n"),
			})
		}
	}

	const audienceSections: KnowledgeDocument["sections"] = []
	if (knowledge.target_audience.ideal_customer_description) {
		audienceSections.push({
			id: "audience-ideal",
			title: "Ideal Customer",
			kind: "text",
			content: knowledge.target_audience.ideal_customer_description,
		})
	}
	if (knowledge.target_audience.pain_points?.length) {
		audienceSections.push({
			id: "audience-pain-points",
			title: "Pain Points",
			kind: "text",
			content: knowledge.target_audience.pain_points.join("\n"),
		})
	}
	if (knowledge.target_audience.demographics) {
		audienceSections.push({
			id: "audience-demographics",
			title: "Demographics",
			kind: "text",
			content: knowledge.target_audience.demographics,
		})
	}
	if (knowledge.target_audience.exclusions) {
		audienceSections.push({
			id: "audience-exclusions",
			title: "Exclusions",
			kind: "text",
			content: knowledge.target_audience.exclusions,
		})
	}
	if (knowledge.target_audience.geographic_focus) {
		audienceSections.push({
			id: "audience-geo",
			title: "Geographic Focus",
			kind: "text",
			content: knowledge.target_audience.geographic_focus,
		})
	}
	if (knowledge.platforms_enabled.length > 0) {
		audienceSections.push({
			id: "audience-platforms",
			title: "Platforms Enabled",
			kind: "text",
			content: knowledge.platforms_enabled.join(", "),
		})
	}

	const complianceSections: KnowledgeDocument["sections"] = []
	if (knowledge.approved_claims.length > 0) {
		complianceSections.push({
			id: "compliance-approved",
			title: "Approved Claims",
			kind: "text",
			content: knowledge.approved_claims.join("\n"),
		})
	}
	if (knowledge.disallowed_claims.length > 0) {
		complianceSections.push({
			id: "compliance-disallowed",
			title: "Disallowed Claims",
			kind: "text",
			content: knowledge.disallowed_claims.join("\n"),
		})
	}
	if (knowledge.compliance_rules.length > 0) {
		complianceSections.push({
			id: "compliance-rules",
			title: "Compliance Rules",
			kind: "text",
			content: knowledge.compliance_rules.join("\n"),
		})
	}

	const competitorSections: KnowledgeDocument["sections"] = []
	if (knowledge.competitors.competitor_list?.length) {
		competitorSections.push({
			id: "competitors-list",
			title: "Competitors",
			kind: "text",
			content: knowledge.competitors.competitor_list.join("\n"),
		})
	}
	if (knowledge.competitors.differentiators) {
		competitorSections.push({
			id: "competitors-differentiators",
			title: "Differentiators",
			kind: "text",
			content: knowledge.competitors.differentiators,
		})
	}
	if (knowledge.competitors.we_win_because) {
		competitorSections.push({
			id: "competitors-win",
			title: "We Win Because",
			kind: "text",
			content: knowledge.competitors.we_win_because,
		})
	}

	const makeDocument = (
		type: KnowledgeDocType,
		sections: KnowledgeDocument["sections"]
	): KnowledgeDocument => ({
		metadata: {
			project_id: projectId,
			type,
			version,
			generated_at: generatedAt,
		},
		sections,
	})

	return {
		product: makeDocument("product", productSections),
		brand_voice: makeDocument("brand_voice", brandSections),
		audience: makeDocument("audience", audienceSections),
		compliance: makeDocument("compliance", complianceSections),
		competitors: makeDocument("competitors", competitorSections),
	}
}

export const storeKnowledgeDocuments = async (
	env: Env,
	projectId: string,
	docs: Record<KnowledgeDocType, KnowledgeDocument>
) => {
	await Promise.all(
		KNOWLEDGE_DOC_TYPES.map(async (type) => {
			const key = `projects/${projectId}/knowledge/${type}.json`
			await env.ARTIFACTS.put(key, JSON.stringify(docs[type]), {
				httpMetadata: { contentType: "application/json" },
			})
		})
	)
}

export const loadKnowledgeDocuments = async (
	env: Env,
	projectId: string
): Promise<Record<KnowledgeDocType, KnowledgeDocument>> => {
	const docs: Partial<Record<KnowledgeDocType, KnowledgeDocument>> = {}
	for (const type of KNOWLEDGE_DOC_TYPES) {
		const key = `projects/${projectId}/knowledge/${type}.json`
		const obj = await env.ARTIFACTS.get(key)
		if (!obj) continue
		const text = await obj.text()
		docs[type] = JSON.parse(text) as KnowledgeDocument
	}
	return docs as Record<KnowledgeDocType, KnowledgeDocument>
}

const chunkText = (text: string): string[] => {
	const paragraphs = text
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0)
	if (paragraphs.length === 0) return []

	const chunks: string[] = []
	let current = ""
	for (const paragraph of paragraphs) {
		const next = current.length > 0 ? `${current}\n\n${paragraph}` : paragraph
		if (next.length <= MAX_CHUNK_CHARS) {
			current = next
			continue
		}
		if (current.length > 0) {
			chunks.push(current)
		}
		if (paragraph.length > MAX_CHUNK_CHARS) {
			let start = 0
			while (start < paragraph.length) {
				const slice = paragraph.slice(start, start + MAX_CHUNK_CHARS)
				chunks.push(slice)
				start += MAX_CHUNK_CHARS - CHUNK_OVERLAP
			}
			current = ""
		} else {
			current = paragraph
		}
	}
	if (current.length > 0) chunks.push(current)
	return chunks
}

export const chunkKnowledgeDocument = (
	document: KnowledgeDocument
): KnowledgeChunk[] => {
	let order = 0
	const chunks: KnowledgeChunk[] = []
	for (const section of document.sections) {
		const sectionText = `${section.title}\n${section.content}`
		const sectionChunks = chunkText(sectionText)
		for (const chunk of sectionChunks) {
			chunks.push({
				id: `${document.metadata.type}-chunk-${order}`,
				text: chunk,
				section_id: section.id,
				section_title: section.title,
				order,
			})
			order++
		}
	}
	return chunks
}

const getEmbedding = async (
	env: Env,
	text: string,
	options?: { projectId?: string }
): Promise<number[]> => {
	if (!env.GOOGLE_API_KEY) {
		throw new Error("Missing GOOGLE_API_KEY for embeddings")
	}
	// @ts-ignore
	const ai = new GoogleGenAI({
		apiKey: env.GOOGLE_API_KEY,
		baseURL:
			"https://gateway.ai.cloudflare.com/v1/7435572da589819f03ce5407d4312dcb/growthopsai/google-ai-studio",
	})
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
		source: "knowledge_index",
		projectId: options?.projectId,
		metadata: {
			operation: "index_knowledge",
			counted_tokens: inputTokens != null,
			count_tokens_model: countTokensModel,
			count_tokens_model_is_fallback: countTokensModel !== model,
		},
	})
	return embedding
}

const buildVectorId = (
	projectId: string,
	type: KnowledgeDocType,
	version: number,
	chunkIndex: number
) => `project-${projectId}-${type}-v${version}-${chunkIndex}`

const writeVectorManifest = async (
	env: Env,
	projectId: string,
	manifest: {
		project_id: string
		version: number
		vector_ids: string[]
		updated_at: number
	}
) => {
	const key = `projects/${projectId}/knowledge/index/manifest.json`
	await env.ARTIFACTS.put(key, JSON.stringify(manifest), {
		httpMetadata: { contentType: "application/json" },
	})
}

const loadVectorManifest = async (env: Env, projectId: string) => {
	const key = `projects/${projectId}/knowledge/index/manifest.json`
	const obj = await env.ARTIFACTS.get(key)
	if (!obj) return null
	const text = await obj.text()
	return JSON.parse(text) as {
		project_id: string
		version: number
		vector_ids: string[]
		updated_at: number
	}
}

const deleteVectorsByManifest = async (env: Env, projectId: string) => {
	const manifest = await loadVectorManifest(env, projectId)
	if (!manifest) return
	const ids = (manifest.vector_ids || []).filter(
		(id): id is string => typeof id === "string" && id.trim().length > 0,
	)

	const canDeleteByFilter = typeof env.VECTORIZE.deleteByFilter === "function"
	const canDeleteByIds = typeof env.VECTORIZE.deleteByIds === "function"

	if (canDeleteByFilter) {
		try {
			await env.VECTORIZE.deleteByFilter({ project_id: projectId })
			return
		} catch (error) {
			console.warn(
				`[Knowledge] deleteByFilter failed for project ${projectId}`,
				error,
			)
		}
	}

	if (!canDeleteByIds || ids.length === 0) return
	for (let i = 0; i < ids.length; i += VECTOR_UPSERT_BATCH) {
		const batch = ids.slice(i, i + VECTOR_UPSERT_BATCH)
		try {
			await env.VECTORIZE.deleteByIds(batch)
		} catch (error) {
			console.warn(
				`[Knowledge] deleteByIds failed for project ${projectId}`,
				error,
			)
			break
		}
	}
}

export const indexKnowledgeDocuments = async (
	env: Env,
	projectId: string,
	version: number,
	docs: Record<KnowledgeDocType, KnowledgeDocument>
) => {
	const vectors: Array<{
		id: string
		values: number[]
		metadata: Record<string, string | number>
	}> = []
	const vectorIds: string[] = []

	let chunkIndex = 0
	for (const type of KNOWLEDGE_DOC_TYPES) {
		const doc = docs[type]
		const chunks = chunkKnowledgeDocument(doc)
		for (const chunk of chunks) {
			const embedding = await getEmbedding(env, chunk.text, { projectId })
			const id = buildVectorId(projectId, type, version, chunkIndex)
			vectorIds.push(id)
			vectors.push({
				id,
				values: embedding,
				metadata: {
					project_id: projectId,
					type,
					version,
					chunk: chunkIndex,
					section_id: chunk.section_id,
					section_title: chunk.section_title,
					content: chunk.text,
				},
			})
			chunkIndex++
		}
	}

	for (let i = 0; i < vectors.length; i += VECTOR_UPSERT_BATCH) {
		const batch = vectors.slice(i, i + VECTOR_UPSERT_BATCH)
		await env.VECTORIZE.upsert(batch)
	}

	await writeVectorManifest(env, projectId, {
		project_id: projectId,
		version,
		vector_ids: vectorIds,
		updated_at: Date.now(),
	})
}

export const upsertProjectKnowledge = async (
	env: Env,
	projectId: string,
	knowledge: ProjectKnowledgeInput,
	versionOverride?: number
): Promise<ProjectKnowledgeRow> => {
	const now = Date.now()
	const existing = await env.DB.prepare(
		"SELECT id, version FROM project_knowledge WHERE project_id = ?"
	)
		.bind(projectId)
		.first<{ id: string; version: number }>()

	const candidateVersion =
		versionOverride ?? (existing?.version ? existing.version + 1 : 1)
	const nextVersion = existing?.version
		? Math.max(existing.version, candidateVersion)
		: candidateVersion
	const id = existing?.id || crypto.randomUUID()

	const record: ProjectKnowledgeRow = {
		id,
		project_id: Number(projectId),
		company_name: knowledge.company_name,
		product_description: buildProductDescription(knowledge.product) || null,
		brand_voice: safeJsonStringify(knowledge.brand_voice),
		target_audience: safeJsonStringify(knowledge.target_audience),
		competitors: safeJsonStringify(knowledge.competitors),
		approved_claims: safeJsonStringify(knowledge.approved_claims),
		disallowed_claims: safeJsonStringify(knowledge.disallowed_claims),
		compliance_rules: safeJsonStringify(knowledge.compliance_rules),
		platforms_enabled: safeJsonStringify(knowledge.platforms_enabled),
		last_indexed_at: null,
		version: nextVersion,
		updated_at: now,
	}

	await env.DB.prepare(
		`INSERT INTO project_knowledge (
        id,
        project_id,
        company_name,
        product_description,
        brand_voice,
        target_audience,
        competitors,
        approved_claims,
        disallowed_claims,
        compliance_rules,
        platforms_enabled,
        last_indexed_at,
        version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        company_name = excluded.company_name,
        product_description = excluded.product_description,
        brand_voice = excluded.brand_voice,
        target_audience = excluded.target_audience,
        competitors = excluded.competitors,
        approved_claims = excluded.approved_claims,
        disallowed_claims = excluded.disallowed_claims,
        compliance_rules = excluded.compliance_rules,
        platforms_enabled = excluded.platforms_enabled,
        version = excluded.version`
	)
		.bind(
			record.id,
			record.project_id,
			record.company_name,
			record.product_description,
			record.brand_voice,
			record.target_audience,
			record.competitors,
			record.approved_claims,
			record.disallowed_claims,
			record.compliance_rules,
			record.platforms_enabled,
			record.last_indexed_at,
			record.version
		)
		.run()

	return record
}

export const getProjectKnowledge = async (
	env: Env,
	projectId: string
): Promise<ProjectKnowledgeRow | null> => {
	const row = await env.DB.prepare(
		"SELECT * FROM project_knowledge WHERE project_id = ?"
	)
		.bind(projectId)
		.first<ProjectKnowledgeRow>()
	return row || null
}

export const parseProjectKnowledge = (row: ProjectKnowledgeRow) => ({
	...row,
	brand_voice: parseJsonOrNull<ProjectKnowledgeBrandVoice>(row.brand_voice),
	target_audience: parseJsonOrNull<ProjectKnowledgeAudience>(
		row.target_audience
	),
	competitors: parseJsonOrNull<ProjectKnowledgeCompetitors>(row.competitors),
	approved_claims: parseJsonOrNull<string[]>(row.approved_claims) || [],
	disallowed_claims: parseJsonOrNull<string[]>(row.disallowed_claims) || [],
	compliance_rules: parseJsonOrNull<string[]>(row.compliance_rules) || [],
	platforms_enabled: parseJsonOrNull<string[]>(row.platforms_enabled) || [],
})

export const buildKnowledgeSummary = (row: ProjectKnowledgeRow) => {
	const parsed = parseProjectKnowledge(row)
	const summary: Record<string, unknown> = {
		company_name: parsed.company_name,
		product_description: parsed.product_description,
		brand_voice: parsed.brand_voice,
		audience: parsed.target_audience,
		competitors: parsed.competitors,
		approved_claims: parsed.approved_claims,
		disallowed_claims: parsed.disallowed_claims,
		compliance_rules: parsed.compliance_rules,
		platforms_enabled: parsed.platforms_enabled,
	}
	return summary
}

export const syncProjectKnowledgeFromIntake = async (
	env: Env,
	projectId: string,
	intakeData: Record<string, any>,
	options?: { versionOverride?: number; shouldIndex?: boolean }
) => {
	const knowledge = normalizeIntakeToKnowledge(intakeData)
	const record = await upsertProjectKnowledge(
		env,
		projectId,
		knowledge,
		options?.versionOverride
	)

	const docs = buildKnowledgeDocuments(projectId, record.version, knowledge)
	await storeKnowledgeDocuments(env, projectId, docs)

	let indexed = false
	if (options?.shouldIndex) {
		try {
			await deleteVectorsByManifest(env, projectId)
			await indexKnowledgeDocuments(env, projectId, record.version, docs)
			await env.DB.prepare(
				"UPDATE project_knowledge SET last_indexed_at = ? WHERE project_id = ?"
			)
				.bind(Date.now(), projectId)
				.run()
			indexed = true
		} catch (error) {
			console.error(
				`[Knowledge] Indexing failed for project ${projectId} v${record.version}`,
				error
			)
		}
	}

	return { record, docs, indexed }
}

export const reindexProjectKnowledge = async (env: Env, projectId: string) => {
	const knowledgeRow = await getProjectKnowledge(env, projectId)
	if (!knowledgeRow) {
		throw new Error("Project knowledge not found")
	}

	let docs = await loadKnowledgeDocuments(env, projectId)
	const hasDocs = KNOWLEDGE_DOC_TYPES.every((type) => docs[type])
	if (!hasDocs) {
		const parsed = parseProjectKnowledge(knowledgeRow)
		const knowledge: ProjectKnowledgeInput = {
			company_name: parsed.company_name,
			product: {
				summary: undefined,
				details: parsed.product_description || undefined,
			},
			brand_voice: parsed.brand_voice || {},
			target_audience: parsed.target_audience || {},
			competitors: parsed.competitors || {},
			approved_claims: parsed.approved_claims || [],
			disallowed_claims: parsed.disallowed_claims || [],
			compliance_rules: parsed.compliance_rules || [],
			platforms_enabled: parsed.platforms_enabled || [],
		}
		docs = buildKnowledgeDocuments(projectId, knowledgeRow.version, knowledge)
		await storeKnowledgeDocuments(env, projectId, docs)
	}

	await deleteVectorsByManifest(env, projectId)
	await indexKnowledgeDocuments(env, projectId, knowledgeRow.version, docs)
	await env.DB.prepare(
		"UPDATE project_knowledge SET last_indexed_at = ? WHERE project_id = ?"
	)
		.bind(Date.now(), projectId)
		.run()
}
