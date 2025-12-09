import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		'import.meta.env.APP_VERSION': JSON.stringify(packageJson.version)
	},
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
