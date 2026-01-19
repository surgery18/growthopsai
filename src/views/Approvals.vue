<template>
	<div class="space-y-12 max-w-4xl mx-auto pb-20">
		<div class="flex items-center justify-between">
			<h1 class="text-3xl font-bold tracking-tight">Approval Queue</h1>
			<RouterLink to="/publishing">
				<Button variant="ghost" size="sm">Go to Publishing Studio →</Button>
			</RouterLink>
		</div>

		<div class="flex items-center gap-2 mb-4">
			<Badge variant="default" class="text-sm">{{ pendingPosts.length }} Reviews Pending</Badge>
		</div>

		<div class="space-y-4">
			<h2 class="text-xl font-semibold text-white flex items-center gap-2">
				<Clock class="h-5 w-5" /> Pending Review
			</h2>
			<Card v-if="pendingPosts.length === 0" class="p-12 flex flex-col items-center justify-center text-gray-500 border-dashed">
				<CheckCircle class="h-12 w-12 mb-4 opacity-50" />
				<p class="text-lg font-medium">No pending items</p>
			</Card>
			<Card v-for="item in pendingPosts" :key="item.id" class="overflow-hidden">
				<div class="border-l-4 border-l-brand-primary h-full">
					<CardHeader class="flex flex-row items-start justify-between pb-2">
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<CardTitle class="text-lg">POST #{{ item.id }}</CardTitle>
								<Badge variant="default" class="text-[10px] uppercase">{{ item.platform }}</Badge>
								<span class="text-xs text-brand-primary">{{ campaignName(item.campaign_id) }}</span>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<div v-if="cancelId === item.id" class="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
								<span class="text-xs text-red-400 font-bold">Kill Campaign?</span>
								<Button size="sm" variant="danger" @click="handleCancel(item.campaign_id, item.id)">Confirm</Button>
								<Button size="sm" variant="ghost" @click="cancelId = null">Back</Button>
							</div>
							<Button
								v-else
								variant="ghost"
								size="icon"
								class="text-gray-500 hover:text-red-500"
								@click="handleCancel(item.campaign_id, item.id)"
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						</div>
					</CardHeader>
					<CardContent class="space-y-4">
						<div v-if="previewFor(item).previewPosts.length" class="space-y-4">
							<div v-if="previewFor(item).strategyText" class="text-sm text-gray-400 bg-black/50 p-2 rounded">
								<MarkdownContent :content="previewFor(item).strategyText" />
							</div>
							<XPostPreview
								v-for="(post, idx) in previewFor(item).previewPosts"
								:key="idx"
								:content="post.content"
								:id="idx"
								:hide-actions="true"
								:day="post.day || 1"
								:thread-index="idx"
								:thread-count="previewFor(item).previewPosts.length"
							/>
						</div>
						<div
							v-else
							class="p-4 bg-black/30 rounded-lg border border-white/5 font-mono text-sm text-gray-300 whitespace-pre-wrap"
						>
							{{ item.content }}
						</div>
						<div class="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
							<div
								v-if="rejectId === item.id"
								class="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4 bg-white/5 p-4 rounded-lg border border-white/10 w-full max-w-md ml-auto"
							>
								<div class="space-y-2">
									<label class="text-xs text-gray-400 font-medium ml-1">Reason for Revision</label>
									<div class="relative">
										<select
											class="w-full bg-black/40 border border-white/20 text-gray-200 text-sm rounded-md h-10 px-3 pr-8 appearance-none focus:ring-2 focus:ring-brand-primary outline-none"
											v-model="rejectReason"
										>
											<option>Brand Guidelines Violation</option>
											<option>Tone Mismatch</option>
											<option>Factual Error</option>
											<option>Compliance Risk</option>
											<option>Other</option>
										</select>
									</div>
								</div>
								<textarea
									v-if="rejectReason === 'Other'"
									class="w-full bg-black/40 border border-white/20 text-gray-200 text-sm rounded-md p-3 min-h-[80px]"
									placeholder="Details..."
									v-model="customRejectReason"
								/>
								<div class="flex items-center justify-end gap-2 pt-2">
									<Button size="sm" variant="ghost" @click="rejectId = null">Cancel</Button>
									<Button size="sm" variant="danger" @click="handleReject(item.id)">Confirm Revision</Button>
								</div>
							</div>
							<template v-else>
								<Button variant="ghost" class="text-red-400 hover:bg-red-500/10" @click="rejectId = item.id">
									<XCircle class="h-4 w-4 mr-2" /> Request Revision
								</Button>
								<Button variant="primary" class="bg-green-600 hover:bg-green-700" @click="handleApprove(item.id)">
									<CheckCircle class="h-4 w-4 mr-2" /> Approve
								</Button>
							</template>
						</div>
					</CardContent>
				</div>
			</Card>
		</div>

		<div v-if="revisionPosts.length > 0" class="space-y-4">
			<h2 class="text-xl font-semibold text-yellow-500 flex items-center gap-2">
				<AlertCircle class="h-5 w-5" /> Changes Requested
			</h2>
			<Card
				v-for="item in revisionPosts"
				:key="item.id"
				class="overflow-hidden border-yellow-500/20 bg-yellow-950/5 opacity-75"
			>
				<CardHeader>
					<div class="flex items-center gap-3">
						<Badge variant="warning" class="border-yellow-500 text-yellow-500">REVISION IN PROGRESS</Badge>
						<span class="text-sm text-gray-400">{{ campaignName(item.campaign_id) }}</span>
					</div>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded text-yellow-200 text-sm">
						<span class="font-bold">Rejection Reason:</span> {{ revisionReason(item.id) }}
					</div>
					<div class="opacity-50 pointer-events-none grayscale">
						<div v-if="previewFor(item).previewPosts.length" class="space-y-4">
							<div v-if="previewFor(item).strategyText" class="text-sm text-gray-400 bg-black/50 p-2 rounded">
								<MarkdownContent :content="previewFor(item).strategyText" />
							</div>
							<XPostPreview
								v-for="(post, idx) in previewFor(item).previewPosts"
								:key="idx"
								:content="post.content"
								:id="idx"
								:hide-actions="true"
								:day="post.day || 1"
								:thread-index="idx"
								:thread-count="previewFor(item).previewPosts.length"
							/>
						</div>
						<div
							v-else
							class="p-4 bg-black/30 rounded-lg border border-white/5 font-mono text-sm text-gray-300 whitespace-pre-wrap"
						>
							{{ item.content }}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRoute, RouterLink } from "vue-router"
import { useProjectQuerySync } from "@/composables/useProjectQuerySync"
import Card from "@/components/ui/Card.vue"
import CardContent from "@/components/ui/CardContent.vue"
import CardHeader from "@/components/ui/CardHeader.vue"
import CardTitle from "@/components/ui/CardTitle.vue"
import Badge from "@/components/ui/Badge.vue"
import Button from "@/components/ui/Button.vue"
import MarkdownContent from "@/components/shared/MarkdownContent.vue"
import XPostPreview from "@/components/social/XPostPreview.vue"
import { AlertCircle, CheckCircle, Clock, Trash2, XCircle } from "lucide-vue-next"
import type { Post } from "@/types"

useProjectQuerySync()

const route = useRoute()

const posts = ref<Post[]>([])
const campaigns = ref<any[]>([])
const publishJobs = ref<any[]>([])
const revisions = ref<any[]>([])

const rejectId = ref<number | null>(null)
const cancelId = ref<number | null>(null)
const rejectReason = ref("Brand Guidelines Violation")
const customRejectReason = ref("")

const pendingPosts = computed(() => posts.value.filter((post) => post.status === "INTERNAL_APPROVED"))
const readyPosts = computed(() => posts.value.filter((post) => post.status === "CLIENT_APPROVED"))
const revisionPosts = computed(() => posts.value.filter((post) => post.status === "CLIENT_CHANGES_REQUESTED"))

const fetchQueue = async () => {
	const projectId = route.query.projectId as string | undefined
	if (!projectId) {
		posts.value = []
		campaigns.value = []
		publishJobs.value = []
		revisions.value = []
		return
	}

	const apiUrl = new URL("/api/approvals/queue", window.location.origin)
	apiUrl.searchParams.set("projectId", projectId)

	try {
		const response = await fetch(apiUrl.toString(), {
			headers: { "x-org-id": "demo-org" },
		})
		if (!response.ok) throw new Error("Failed to fetch approvals queue")
		const data = (await response.json()) as {
			posts: Post[]
			campaigns: any[]
			publishJobs: any[]
			revisions: any[]
		}
		posts.value = data.posts
		campaigns.value = data.campaigns
		publishJobs.value = data.publishJobs
		revisions.value = data.revisions
	} catch (error) {
		console.error("Failed to fetch approvals queue", error)
		posts.value = []
		campaigns.value = []
		publishJobs.value = []
		revisions.value = []
	}
}

const handleApprove = async (id: number) => {
	const res = await fetch(`/api/client/posts/${id}/approve`, { method: "POST" })
	if (res.ok) fetchQueue()
}

const handleReject = async (id: number) => {
	if (rejectId.value !== id) {
		rejectId.value = id
		cancelId.value = null
		return
	}
	const feedback = rejectReason.value === "Other" ? customRejectReason.value : rejectReason.value
	const res = await fetch(`/api/client/posts/${id}/reject`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ reason: feedback, category: "brand_violation" }),
	})
	if (res.ok) {
		fetchQueue()
		rejectId.value = null
	}
}

const handleCancel = async (campaignId: number, itemPostId: number) => {
	if (cancelId.value !== itemPostId) {
		cancelId.value = itemPostId
		rejectId.value = null
		return
	}
	const res = await fetch(`/api/client/campaigns/${campaignId}/cancel`, { method: "POST" })
	if (res.ok) {
		fetchQueue()
		cancelId.value = null
	}
}

const campaignName = (campaignId: number) => {
	return campaigns.value.find((c: any) => c.id === campaignId)?.name || ""
}

const revisionReason = (postId: number) => {
	return revisions.value.find((r: any) => r.post_id === postId)?.reason || "Reason not recorded"
}

const previewFor = (item: Post) => {
	try {
		const data = item.content.startsWith("{") ? JSON.parse(item.content) : { text: item.content }
		let previewPosts: any[] = []
		const strategyText = data.text || ""

		if (data.posts && Array.isArray(data.posts)) {
			previewPosts = data.posts
		} else if (data.content) {
			previewPosts = [data]
		} else if (typeof data === "string") {
			previewPosts = [{ content: data }]
		} else {
			previewPosts = [{ content: data.text || JSON.stringify(data) }]
		}

		return { previewPosts, strategyText }
	} catch (error) {
		return { previewPosts: [], strategyText: "" }
	}
}

onMounted(fetchQueue)

watch(
	() => route.query.projectId,
	() => {
		fetchQueue()
	},
)
</script>
