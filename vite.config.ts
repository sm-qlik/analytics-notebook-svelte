import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 3000,
		host: 'localhost'
	},
	preview: {
		port: 3000,
		host: 'localhost'
	},
	build: {
		// Ensure proper cache busting with content hashes
		rollupOptions: {
			output: {
				// Add timestamp to chunk filenames for better cache busting
				entryFileNames: `assets/[name]-[hash].js`,
				chunkFileNames: `assets/[name]-[hash].js`,
				assetFileNames: `assets/[name]-[hash].[ext]`
			}
		}
	}
});
