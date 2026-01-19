import { createRouter, createWebHistory } from "vue-router"
import Layout from "@/layouts/Layout.vue"

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: "/",
			component: Layout,
			children: [
				{ path: "", name: "dashboard", component: () => import("@/views/Dashboard.vue") },
				{ path: "approvals", name: "approvals", component: () => import("@/views/Approvals.vue") },
				{ path: "chat", name: "chat", component: () => import("@/views/Chat.vue") },
				{ path: "settings", name: "settings", redirect: "/projects" },
				{ path: "projects", name: "projects", component: () => import("@/views/Projects.vue") },
				{ path: "projects/:id", name: "project-details", component: () => import("@/views/ProjectDetails.vue") },
				{ path: "projects/:id/intake", name: "project-intake", component: () => import("@/views/ProjectIntake.vue") },
				{ path: "team", name: "team", component: () => import("@/views/Team.vue") },
				{ path: "events", name: "events", component: () => import("@/views/Events.vue") },
				{ path: "brand", name: "brand", component: () => import("@/views/Brand.vue") },
				{ path: "billing", name: "billing", component: () => import("@/views/Billing.vue") },
				{ path: "orchestration", name: "orchestration", component: () => import("@/views/Orchestration.vue") },
				{ path: "publishing", name: "publishing", component: () => import("@/views/Publishing.vue") },
			],
		},
		{ path: "/:pathMatch(.*)*", name: "not-found", component: () => import("@/views/NotFound.vue") },
	],
})

export default router
