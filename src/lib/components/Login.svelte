<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { parseTenantUrl, createAuthConfig, loadQlikAPI } from '$lib/utils/qlik-auth';
	
	let tenantUrl = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let tenantHistory = $state<string[]>([]);
	
	onMount(() => {
		// Load tenant history from localStorage
		if (typeof window !== 'undefined') {
			try {
				const stored = localStorage.getItem('qlik-tenant-history');
				if (stored) {
					tenantHistory = JSON.parse(stored);
				}
			} catch (e) {
				console.warn('Failed to load tenant history:', e);
			}

			// Check for tenant query parameter
			const urlParams = new URLSearchParams(window.location.search);
			const tenantParam = urlParams.get('tenant');
			
			if (tenantParam) {
				// Set the tenant URL from query parameter
				tenantUrl = tenantParam.trim();
				
				// Remove the tenant parameter from URL without reloading
				urlParams.delete('tenant');
				const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
				window.history.replaceState({}, '', newUrl);
				
				// Automatically trigger login
				handleLogin();
			}
		}
	});
	
	async function handleLogin() {
		if (!tenantUrl.trim()) {
			error = 'Please enter a tenant URL';
			return;
		}
		
		isLoading = true;
		error = null;
		
		try {
			// Parse tenant URL
			const tenantInfo = parseTenantUrl(tenantUrl.trim());
			
			// Store tenant URL
			if (typeof window !== 'undefined') {
				localStorage.setItem('currentTenantUrl', tenantInfo.tenantUrl);
				
				// Add to history (max 5)
				const updatedHistory = [
					tenantInfo.tenantUrl,
					...tenantHistory.filter(t => t !== tenantInfo.tenantUrl)
				].slice(0, 5);
				tenantHistory = updatedHistory;
				localStorage.setItem('qlik-tenant-history', JSON.stringify(updatedHistory));
			}
			
		// Configure auth once (prevents multiple setDefaultHostConfig calls)
		const { configureQlikAuthOnce } = await import('$lib/utils/qlik-auth');
		await configureQlikAuthOnce(tenantInfo.tenantUrl);
		
		// Load Qlik API
		const qlikApi = await loadQlikAPI();
		const { items, users, tenants } = qlikApi;
			
			// Check if we're returning from OAuth callback
			// The Qlik API will automatically redirect to OAuth if not authenticated
			try {
				// Try to get items to check if already authenticated
				// If not authenticated, the API will automatically redirect to OAuth
				const response = await items.getItems({ resourceType: 'app[directQuery,]' });
				
				if (response.status === 200) {
					// Already authenticated, proceed
					await completeAuthentication(tenantInfo, qlikApi);
				} else {
					// If we get here with a non-200 status, something went wrong
					// But the API should have redirected for auth, so this is unexpected
					throw new Error(`Unexpected response status: ${response.status}`);
				}
			} catch (err: any) {
				// Rethrow - the Qlik API should handle OAuth automatically.
				// If we get auth errors here, something is misconfigured.
				throw err;
			}
		} catch (err: any) {
			console.error('Login error:', err);
			error = err.message || 'Failed to authenticate. Please check your tenant URL and try again.';
			isLoading = false;
		}
	}
	
	function selectFromHistory(url: string) {
		tenantUrl = url;
	}
	
	async function completeAuthentication(tenantInfo: any, qlikApi: any) {
		const { items, users, tenants } = qlikApi;
		
		// Get items
		const response = await items.getItems({ resourceType: 'app[directQuery,]' });
		
		if (response.status !== 200) {
			throw new Error(`Authentication failed with status: ${response.status}`);
		}
		
		// Get tenant info
		let tenantName: string | null = null;
		try {
			const tenantResponse = await tenants.getMyTenant();
			if (tenantResponse.status === 200 && tenantResponse.data?.name) {
				tenantName = tenantResponse.data.name;
			}
		} catch (e) {
			console.warn('Failed to get tenant info:', e);
		}
		
		// Get user info
		let user: any = null;
		try {
			const userResponse = await users.getMyUser();
			if (userResponse.status === 200) {
				user = userResponse.data;
			}
		} catch (e) {
			console.warn('Failed to get user info:', e);
		}
		
		// Update auth store
		authStore.setAuthenticated(
			tenantInfo.tenantUrl,
			tenantName,
			user,
			response.data || []
		);
		
		isLoading = false;
	}
	
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isLoading) {
			handleLogin();
		}
	}
	
	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		handleLogin();
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 py-12 px-[10px]">
	<div class="max-w-md w-full space-y-8">
		<div class="text-center">
			<h2 class="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
				Sign in to Qlik Cloud
			</h2>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
				Enter your Qlik Cloud tenant URL to get started
			</p>
		</div>
		
		<form class="mt-8 space-y-6" onsubmit={handleSubmit}>
			<div>
				<label for="tenant-url" class="sr-only">Tenant URL</label>
				<input
					id="tenant-url"
					name="tenant-url"
					type="text"
					required
					bind:value={tenantUrl}
					onkeydown={handleKeydown}
					placeholder="your-tenant.us.qlikcloud.com or your-tenant.eu.qlikcloud.com"
					class="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					disabled={isLoading}
				/>
			</div>
			
			{#if error}
				<div class="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm text-red-800 dark:text-red-200">{error}</p>
						</div>
					</div>
				</div>
			{/if}
			
			<div>
				<button
					type="button"
					onclick={handleLogin}
					disabled={isLoading || !tenantUrl.trim()}
					class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if isLoading}
						<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Connecting...
					{:else}
						Sign in
					{/if}
				</button>
			</div>
			
			{#if tenantHistory.length > 0}
				<div class="mt-6">
					<p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Recent tenants:</p>
					<div class="space-y-2">
						{#each tenantHistory as url}
							<button
								type="button"
								onclick={() => selectFromHistory(url)}
								class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
							>
								{url}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</form>
	</div>
</div>

