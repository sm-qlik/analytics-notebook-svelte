import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Determine if we're in development mode
// Only use empty base path when explicitly running dev server (npm run dev)
// During build (npm run build), always use the base path for GitHub Pages
const isDevServer = process.argv.includes('dev');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// default options are shown. On some platforms
			// these options are set automatically — see below
			pages: 'build',
			assets: 'build',
			fallback: '404.html', // GitHub Pages serves 404.html for missing routes
			precompress: false,
			strict: true
		}),
		paths: {
			base: isDevServer ? '' : '/analytics-notebook-svelte', // Use base path for production builds (GitHub Pages)
		}
	}
};

export default config;
