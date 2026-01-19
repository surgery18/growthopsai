<template>
	<div class="mt-4 max-w-md w-full bg-black border border-gray-800 rounded-xl overflow-hidden shadow-lg select-none relative group">
		<div v-if="day || (threadCount && threadCount > 1)" class="absolute top-3 right-3 flex gap-2 z-10">
			<div
				v-if="day"
				class="bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase tracking-wider"
			>
				Day {{ day }}
			</div>
			<div
				v-if="threadCount && threadCount > 1"
				class="bg-gray-700 text-gray-200 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase tracking-wider"
			>
				Thread {{ (threadIndex ?? 0) + 1 }}/{{ threadCount }}
			</div>
		</div>

		<div class="flex items-center gap-3 p-3 pt-4">
			<div class="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500" />
			<div class="flex flex-col leading-tight">
				<span class="font-bold text-white text-[15px]">Grub Vision</span>
				<span class="text-gray-500 text-[14px]">@grubvision</span>
			</div>
		</div>

		<div class="px-3 pb-3 text-white text-[15px]">
			<MarkdownContent :content="content" />
		</div>

		<div class="flex justify-between items-center px-3 py-2 border-t border-gray-800 text-gray-500">
			<div class="flex gap-1 items-center group cursor-pointer hover:text-blue-400 transition-colors">
				<div class="p-2 rounded-full group-hover:bg-blue-500/10">
					<svg viewBox="0 0 24 24" class="w-4.5 h-4.5 fill-current">
						<g>
							<path
								d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.29c-4.426 0-8.005-3.58-8.005-8z"
							></path>
						</g>
					</svg>
				</div>
				<span class="text-sm">24</span>
			</div>
			<div class="flex gap-1 items-center group cursor-pointer hover:text-green-400 transition-colors">
				<div class="p-2 rounded-full group-hover:bg-green-500/10">
					<svg viewBox="0 0 24 24" class="w-4.5 h-4.5 fill-current">
						<g>
							<path
								d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"
							></path>
						</g>
					</svg>
				</div>
				<span class="text-sm">12</span>
			</div>
			<div class="flex gap-1 items-center group cursor-pointer hover:text-pink-400 transition-colors">
				<div class="p-2 rounded-full group-hover:bg-pink-500/10">
					<svg viewBox="0 0 24 24" class="w-4.5 h-4.5 fill-current">
						<g>
							<path
								d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.6-4.38-2.48-7.03-5.12-8.38-7.6-1.045-1.92-1.324-3.67-1.082-5.156.416-2.586 2.56-4.596 5.223-4.596 1.953 0 3.908 1.032 5.535 2.5 1.63-1.468 3.586-2.5 5.539-2.5 2.66 0 4.8 2.01 5.22 4.596.24 1.486-.04 3.236-1.08 5.156z"
							></path>
						</g>
					</svg>
				</div>
				<span class="text-sm">182</span>
			</div>
			<div class="flex gap-1 items-center group cursor-pointer hover:text-blue-400 transition-colors">
				<div class="p-2 rounded-full group-hover:bg-blue-500/10">
					<svg viewBox="0 0 24 24" class="w-4.5 h-4.5 fill-current">
						<g>
							<path
								d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"
							></path>
						</g>
					</svg>
				</div>
				<span class="text-sm">842</span>
			</div>
		</div>

		<div v-if="!hideActions" class="bg-gray-900/50 border-t border-gray-800 p-3 flex gap-3">
			<Button
				variant="secondary"
				class="w-full bg-white text-black hover:bg-gray-200"
				@click="goToApprovals"
			>
				Review in Approvals
			</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
import Button from "@/components/ui/Button.vue"
import MarkdownContent from "@/components/shared/MarkdownContent.vue"

const props = defineProps<{
	content: string
	id: number
	hideActions?: boolean
	day?: number
	threadIndex?: number
	threadCount?: number
}>()

const goToApprovals = () => {
	window.location.href = "/approvals"
}
</script>
