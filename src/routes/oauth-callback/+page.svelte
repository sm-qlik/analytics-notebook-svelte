<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	
	onMount(() => {
		// Determine the OAuth host based on the tenant URL stored in localStorage
		let oauthHost = 'oauth.eu.qlikcloud.com'; // default
		
		if (typeof window !== 'undefined') {
			const storedTenantUrl = localStorage.getItem('currentTenantUrl');
			if (storedTenantUrl) {
				// Extract region from tenant URL
				if (storedTenantUrl.includes('.us.qlikcloud.com') || storedTenantUrl.includes('.us.qlik-stage.com')) {
					oauthHost = 'oauth.us.qlikcloud.com';
				} else if (storedTenantUrl.includes('.eu.qlikcloud.com') || storedTenantUrl.includes('.eu.qlik-stage.com')) {
					oauthHost = 'oauth.eu.qlikcloud.com';
				}
			}
		}
		
		// Load the Qlik OAuth callback script
		const script = document.createElement('script');
		script.crossOrigin = 'anonymous';
		script.type = 'application/javascript';
		script.setAttribute('data-host', oauthHost);
		script.src = 'https://cdn.jsdelivr.net/npm/@qlik/embed-web-components@1/dist/oauth-callback.js';
		document.head.appendChild(script);
		
		// After OAuth callback processes, redirect back to main page
		// The OAuth callback script will handle storing the token
		script.onload = () => {
			// Give the OAuth callback script time to process and store tokens
			setTimeout(() => {
				// Clear any URL parameters before redirecting
				const cleanUrl = window.location.origin + '/';
				window.location.href = cleanUrl;
			}, 2000);
		};
		
		script.onerror = () => {
			// If script fails to load, still redirect after a delay
			setTimeout(() => {
				const cleanUrl = window.location.origin + '/';
				window.location.href = cleanUrl;
			}, 2000);
		};
	});
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
	<div class="text-center">
		<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
		<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">Completing authentication...</p>
	</div>
</div>

