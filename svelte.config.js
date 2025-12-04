import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.argv.includes('dev');

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
			base: dev ? '' : '/analytics-notebook-svelte', // Replace 'your-repo-name' with your repository name
		}
	}
};

export default config;
