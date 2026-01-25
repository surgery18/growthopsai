import { createRouter, createWebHistory } from "vue-router"
import Layout from "@/layouts/Layout.vue"

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: "/",
			name: "landing",
			component: () => import("@/views/LandingPage.vue"),
		},
		{
			path: "/admin",
			name: "admin",
			component: () => import("@/views/AdminLogin.vue"),
		},
		{
			path: "/dashboard",
			component: Layout,
			children: [
				{
					path: "",
					name: "dashboard",
					component: () => import("@/views/Dashboard.vue"),
				},
				{
					path: "approvals",
					name: "approvals",
					component: () => import("@/views/Approvals.vue"),
				},
				{
					path: "chat",
					name: "chat",
					component: () => import("@/views/Chat.vue"),
				},
				{ path: "settings", name: "settings", redirect: "/dashboard/projects" },
				{
					path: "projects",
					name: "projects",
					component: () => import("@/views/Projects.vue"),
				},
				{
					path: "projects/:id",
					name: "project-details",
					component: () => import("@/views/ProjectDetails.vue"),
				},
				{
					path: "projects/:id/intake",
					name: "project-intake",
					component: () => import("@/views/ProjectIntake.vue"),
				},
				{
					path: "team",
					name: "team",
					component: () => import("@/views/Team.vue"),
				},
				{
					path: "events",
					name: "events",
					component: () => import("@/views/Events.vue"),
				},
				{
					path: "brand",
					name: "brand",
					component: () => import("@/views/Brand.vue"),
				},
				{
					path: "billing",
					name: "billing",
					component: () => import("@/views/Billing.vue"),
				},
				{
					path: "orchestration",
					name: "orchestration",
					component: () => import("@/views/Orchestration.vue"),
				},
				{
					path: "publishing",
					name: "publishing",
					component: () => import("@/views/Publishing.vue"),
				},
			],
		},
		{ path: "/projects", redirect: "/dashboard/projects" },
		{
			path: "/projects/:id",
			redirect: (to) => `/dashboard/projects/${to.params.id}`,
		},
		{
			path: "/projects/:id/intake",
			redirect: (to) => `/dashboard/projects/${to.params.id}/intake`,
		},
		{ path: "/chat", redirect: "/dashboard/chat" },
		{ path: "/team", redirect: "/dashboard/team" },
		{ path: "/events", redirect: "/dashboard/events" },
		{ path: "/brand", redirect: "/dashboard/brand" },
		{ path: "/billing", redirect: "/dashboard/billing" },
		{ path: "/orchestration", redirect: "/dashboard/orchestration" },
		{ path: "/publishing", redirect: "/dashboard/publishing" },
		{ path: "/approvals", redirect: "/dashboard/approvals" },
		{
			path: "/:pathMatch(.*)*",
			name: "not-found",
			component: () => import("@/views/NotFound.vue"),
		},
	],
})

export default router
