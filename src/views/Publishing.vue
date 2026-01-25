<template>
	<div class="space-y-8 max-w-5xl mx-auto pb-20">
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-bold text-white">Publishing Studio</h1>
			<RouterLink
				to="/approvals"
				class="text-sm text-brand-accent hover:text-white"
				>View Approvals</RouterLink
			>
		</div>

		<div class="space-y-4">
			<h2 class="text-xl font-semibold text-white">Ready to Publish</h2>
			<Card v-if="readyPosts.length === 0" class="p-6 text-gray-400"
				>No approved posts ready to publish.</Card
			>
			<Card v-for="post in readyPosts" :key="post.id" class="p-6 space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<div class="text-sm text-gray-400">
							Campaign: {{ campaignName(post.campaign_id) }}
						</div>
						<div class="text-xs text-gray-500">Post #{{ post.id }}</div>
					</div>
					<Button
						:disabled="publishingId === post.id"
						@click="handlePublish(post)">
						<Send class="w-4 h-4 mr-2" />
						{{ publishingId === post.id ? "Publishing..." : "Publish" }}
					</Button>
				</div>
				<XPostPreview
					v-for="(preview, idx) in previewFor(post).previewPosts"
					:key="idx"
					:content="preview.content"
					:id="idx"
					:hide-actions="true"
					:day="preview.day || 1"
					:thread-index="idx"
					:thread-count="previewFor(post).previewPosts.length" />
				<div
					v-if="previewFor(post).strategyText"
					class="text-sm text-gray-400 bg-black/50 p-2 rounded">
					<MarkdownContent :content="previewFor(post).strategyText" />
				</div>
			</Card>
		</div>

		<div class="space-y-4">
			<h2 class="text-xl font-semibold text-white">Published</h2>
			<Card v-if="publishedPosts.length === 0" class="p-6 text-gray-400"
				>No published posts yet.</Card
			>
			<Card v-for="post in publishedPosts" :key="post.id" class="p-6 space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<div class="text-sm text-gray-400">
							Campaign: {{ campaignName(post.campaign_id) }}
						</div>
						<div class="text-xs text-gray-500">
							Published Post #{{ post.id }}
						</div>
					</div>
				</div>
				<XPostPreview
					v-for="(preview, idx) in previewFor(post).previewPosts"
					:key="idx"
					:content="preview.content"
					:id="idx"
					:hide-actions="true"
					:day="preview.day || 1"
					:thread-index="idx"
					:thread-count="previewFor(post).previewPosts.length" />
				<div
					v-if="previewFor(post).strategyText"
					class="text-sm text-gray-400 bg-black/50 p-2 rounded">
					<MarkdownContent :content="previewFor(post).strategyText" />
				</div>
			</Card>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref, watch } from "vue"
	import { useRoute, RouterLink } from "vue-router"
	import { useProjectQuerySync } from "@/composables/useProjectQuerySync"
	import { toast } from "vue-sonner"
	import Card from "@/components/ui/Card.vue"
	import Button from "@/components/ui/Button.vue"
	import XPostPreview from "@/components/social/XPostPreview.vue"
	import MarkdownContent from "@/components/shared/MarkdownContent.vue"
	import { Send } from "lucide-vue-next"
	import type { Post } from "@/types"

	useProjectQuerySync()

	const route = useRoute()

	const posts = ref<Post[]>([])
	const campaigns = ref<any[]>([])
	const publishJobs = ref<any[]>([])
	const publishingId = ref<number | null>(null)

	const readyPosts = computed(() =>
		posts.value.filter((post) => post.status === "CLIENT_APPROVED"),
	)
	const publishedPosts = computed(() =>
		posts.value.filter((post) => post.status === "PUBLISHED"),
	)

	const fetchDashboard = async () => {
		const projectId = route.query.projectId as string | undefined
		if (!projectId) {
			posts.value = []
			campaigns.value = []
			publishJobs.value = []
			return
		}

		const apiUrl = new URL("/api/publishing/dashboard", window.location.origin)
		apiUrl.searchParams.set("projectId", projectId)

		const response = await fetch(apiUrl.toString())
		if (!response.ok) {
			posts.value = []
			campaigns.value = []
			publishJobs.value = []
			return
		}

		const data = (await response.json()) as {
			posts: Post[]
			campaigns: any[]
			publishJobs: any[]
		}
		posts.value = data.posts
		campaigns.value = data.campaigns
		publishJobs.value = data.publishJobs
	}

	const campaignName = (campaignId: number) =>
		campaigns.value.find((c) => c.id === campaignId)?.name || ""

	const previewFor = (item: Post) => {
		try {
			const data = item.content.startsWith("{")
				? JSON.parse(item.content)
				: { text: item.content }
			let previewPosts: any[] = []
			const strategyText = data.text || ""
			if (data.posts && Array.isArray(data.posts)) previewPosts = data.posts
			else if (data.content) previewPosts = [data]
			else if (typeof data === "string") previewPosts = [{ content: data }]
			else previewPosts = [{ content: data.text || JSON.stringify(data) }]
			return { previewPosts, strategyText }
		} catch {
			return { previewPosts: [{ content: item.content }], strategyText: "" }
		}
	}

	const handlePublish = async (post: Post) => {
		const job = publishJobs.value.find((job) => job.post_id === post.id)
		if (!job) return
		publishingId.value = post.id
		try {
			const res = await fetch(`/api/publish-jobs/${job.id}/run`, {
				method: "POST",
			})
			if (res.ok) {
				toast.success("Post published successfully")
				fetchDashboard()
			} else {
				const data = (await res.json()) as { error?: string; message?: string }
				toast.error(
					"Failed to publish: " +
						(data.message || data.error || "Unknown error"),
				)
			}
		} catch (err) {
			toast.error("Network error publishing post")
		} finally {
			publishingId.value = null
		}
	}

	onMounted(fetchDashboard)

	watch(
		() => route.query.projectId,
		() => fetchDashboard(),
	)
</script>
