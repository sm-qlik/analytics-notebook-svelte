import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import process from 'node:process';

const dev = process.argv.includes('dev');

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://kit.svelte.dev/docs/integrations#preprocessors
    // for more information about preprocessors
    preprocess: vitePreprocess(),

    kit: {
        adapter: adapter({
            // Set the output directory for the final static files
            pages: 'build', // or 'dist', 'docs', etc.
            assets: 'build', // must match 'pages'
            fallback: 'index.html', // Optional: creates a fallback 404 page
            precompress: false,
            strict: true
        }),
        paths: {
            base: dev ? '' : '/analytics-notebook-svelte',
        },
        // Ensures files with underscores (like _app) are served correctly
        appDir: 'app',
    }
};

export default config;
