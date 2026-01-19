import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"
import vue from "@vitejs/plugin-vue"
import tailwindcss from "@tailwindcss/vite"
import tsconfigPaths from "vite-tsconfig-paths"
import vueDevTools from "vite-plugin-vue-devtools"
import { cloudflare } from "@cloudflare/vite-plugin"

export default defineConfig({
	plugins: [cloudflare(), vue(), tailwindcss(), tsconfigPaths(), vueDevTools()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
})
