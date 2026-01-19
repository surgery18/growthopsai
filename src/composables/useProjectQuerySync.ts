import { watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { storeToRefs } from "pinia"
import { useAppStore } from "@/stores/app"

export const useProjectQuerySync = () => {
	const route = useRoute()
	const router = useRouter()
	const { selectedProjectId } = storeToRefs(useAppStore())

	watch(
		[() => selectedProjectId.value, () => route.query.projectId],
		([selected, queryId]) => {
			if (!selected) return
			if (String(selected) === String(queryId ?? "")) return
			router.replace({
				path: route.path,
				query: { ...route.query, projectId: selected },
			})
		},
		{ immediate: true },
	)
}
