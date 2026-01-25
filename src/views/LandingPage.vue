<template>
	<div
		class="min-h-screen bg-[#0a0a0f] text-white selection:bg-brand-primary/30 font-sans">
		<!-- Background Effects -->
		<div class="fixed inset-0 overflow-hidden pointer-events-none">
			<div
				class="absolute top-0 left-1/4 w-96 h-96 bg-brand-primary/20 rounded-full blur-[128px] animate-pulse"></div>
			<div
				class="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px] animate-pulse delay-1000"></div>
			<!-- Grid Pattern -->
			<div
				class="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20"></div>
		</div>

		<!-- Navigation -->
		<nav
			class="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl transition-all duration-300"
			:class="{ 'bg-[#0a0a0f] border-white/10': isScrolled }">
			<div
				class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
				<div
					class="flex items-center gap-3 font-bold text-2xl tracking-wider cursor-pointer"
					@click="scrollTo('hero')">
					<Activity class="h-8 w-8 text-brand-primary animate-pulse-slow" />
					<span
						class="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60"
						>GROWTHOPS</span
					>
				</div>

				<!-- Desktop Menu -->
				<div
					class="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
					<button
						@click="scrollTo('features')"
						class="hover:text-white transition-colors">
						Features
					</button>
				</div>

				<div class="flex items-center gap-6">
					<RouterLink
						to="/dashboard"
						class="px-5 py-2.5 rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-white font-medium transition-all shadow-[0_0_20px_-5px_var(--color-brand-primary)] hover:shadow-[0_0_25px_-5px_var(--color-brand-primary)] hover:-translate-y-0.5">
						Launch Dashboard
					</RouterLink>
				</div>
			</div>
		</nav>

		<!-- Hero Section -->
		<section id="hero" class="relative z-10 pt-40 pb-20 px-6">
			<div class="max-w-5xl mx-auto text-center">
				<div
					class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-brand-primary mb-8 animate-fade-in-up">
					<span class="relative flex h-2 w-2">
						<span
							class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
						<span
							class="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
					</span>
					AI-Powered Operations Platform v2.0
				</div>

				<h1
					class="text-6xl md:text-8xl font-bold tracking-tight mb-8 leading-tight">
					<span
						class="block bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/40">
						Automate Your
					</span>
					<span
						class="block bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-purple-500">
						Digital Empire
					</span>
				</h1>

				<p
					class="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
					Orchestrate content, analyze markets, and scale your operations with
					the world's most advanced AI command center. Built for modern growth
					teams.
				</p>

				<div
					class="flex flex-col sm:flex-row items-center justify-center gap-4">
					<RouterLink
						to="/dashboard"
						class="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-black font-bold text-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 group">
						Get Started Now
						<ArrowRight
							class="h-5 w-5 group-hover:translate-x-1 transition-transform" />
					</RouterLink>
				</div>
			</div>
		</section>

		<!-- Features Section -->
		<section id="features" class="py-32 relative">
			<div class="max-w-7xl mx-auto px-6">
				<div class="text-center mb-20 max-w-3xl mx-auto">
					<h2 class="text-4xl md:text-5xl font-bold mb-6">
						Powerful Capabilities
					</h2>
					<p class="text-xl text-gray-400">
						Everything you need to scale your operations, powered by
						next-generation AI models.
					</p>
				</div>

				<div class="grid md:grid-cols-3 gap-8">
					<div
						v-for="(feature, index) in features"
						:key="index"
						class="p-8 rounded-2xl bg-white/5 border border-white/5 hover:border-brand-primary/30 transition-all duration-300 hover:-translate-y-1 group">
						<div
							class="h-12 w-12 rounded-lg bg-brand-primary/10 flex items-center justify-center mb-6 group-hover:bg-brand-primary/20 transition-colors">
							<component
								:is="feature.icon"
								class="h-6 w-6 text-brand-primary" />
						</div>
						<h3 class="text-xl font-semibold mb-3">{{ feature.title }}</h3>
						<p class="text-gray-400 leading-relaxed">
							{{ feature.description }}
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- CTA Bottom -->
		<section class="py-32 border-t border-white/5">
			<div class="max-w-4xl mx-auto px-6 text-center">
				<h2 class="text-4xl md:text-6xl font-bold mb-8">
					Ready to automate your growth?
				</h2>
				<p class="text-xl text-gray-400 mb-12">
					Join hundreds of forward-thinking companies using GrowthOps to scale
					faster.
				</p>
				<RouterLink
					to="/dashboard"
					class="inline-flex items-center gap-3 px-10 py-5 rounded-xl bg-white text-black font-bold text-xl hover:bg-gray-100 transition-all hover:scale-105">
					Get Started for Free
					<ArrowRight class="h-6 w-6" />
				</RouterLink>
			</div>
		</section>

		<!-- Footer -->
		<footer
			class="relative z-10 border-t border-white/5 bg-black/40 backdrop-blur-xl">
			<div
				class="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-gray-500">
				<div class="flex items-center gap-2">
					<Activity class="h-5 w-5" />
					<span>© 2024 GrowthOps AI</span>
				</div>
				<div class="flex gap-8">
					<a href="#" class="hover:text-white transition-colors"
						>Privacy Policy</a
					>
					<a href="#" class="hover:text-white transition-colors"
						>Terms of Service</a
					>
					<a href="#" class="hover:text-white transition-colors">Twitter</a>
					<a href="#" class="hover:text-white transition-colors">GitHub</a>
				</div>
			</div>
		</footer>
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted, onUnmounted } from "vue"
	import { RouterLink } from "vue-router"
	import {
		Activity,
		ArrowRight,
		Zap,
		BarChart3,
		Bot,
		Layers,
		Shield,
		Globe,
	} from "lucide-vue-next"

	const isScrolled = ref(false)

	const checkScroll = () => {
		isScrolled.value = window.scrollY > 50
	}

	onMounted(() => {
		window.addEventListener("scroll", checkScroll)
	})

	onUnmounted(() => {
		window.removeEventListener("scroll", checkScroll)
	})

	const scrollTo = (id: string) => {
		const element = document.getElementById(id)
		if (element) {
			element.scrollIntoView({ behavior: "smooth" })
		}
	}

	const features = [
		{
			icon: Bot,
			title: "Autonomous Agents",
			description:
				"Deploy specialized AI agents to handle complex tasks 24/7 without supervision. They learn and adapt to your workflows.",
		},
		// {
		// 	icon: BarChart3,
		// 	title: "Real-time Analytics",
		// 	description:
		// 		"Visualize your growth metrics with beautiful, real-time dashboards and reports. Make data-driven decisions instantly.",
		// },
		// {
		// 	icon: Zap,
		// 	title: "Instant Scaling",
		// 	description:
		// 		"Scale your operations effortlessly with our high-performance infrastructure. Handle millions of requests with ease.",
		// },
		{
			icon: Layers,
			title: "Workflow Orchestration",
			description:
				"Visual builder to connect your agents and tools into powerful automated workflows. No coding required.",
		},
		// {
		// 	icon: Shield,
		// 	title: "Enterprise Security",
		// 	description:
		// 		"Bank-grade security with SOC2 compliance, role-based access control, and end-to-end encryption.",
		// },
		{
			icon: Globe,
			title: "Global Infrastructure",
			description:
				"Deployed on edge networks worldwide for low-latency access from anywhere on the planet.",
		},
	]
</script>

<style scoped>
	@keyframes fade-in-up {
		0% {
			opacity: 0;
			transform: translateY(20px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-fade-in-up {
		animation: fade-in-up 0.8s ease-out forwards;
	}

	.animate-pulse-slow {
		animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
