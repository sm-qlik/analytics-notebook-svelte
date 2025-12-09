<script lang="ts">
  import Logo from './Logo.svelte';
  import Search from '$lib/components/Search.svelte';
  import Login from '$lib/components/Login.svelte';
  import { authStore } from '$lib/stores/auth';
  import { onMount } from 'svelte';
  import { parseTenantUrl, createAuthConfig, loadQlikAPI } from '$lib/utils/qlik-auth';
  import { base } from '$app/paths';
  
  const version = import.meta.env.APP_VERSION;
  
  let isAuthenticated = $state(false);
  let isCheckingAuth = $state(true);
  let authState = $state<any>(null);
  
  let pageTitle = $derived(
    authState?.isAuthenticated && authState?.tenantName
      ? `${authState.tenantName} - Analytics Notebook`
      : 'Analytics Notebook'
  );
  
  onMount(() => {
    // Subscribe to auth store
    const unsubscribe = authStore.subscribe(state => {
      authState = state;
      isAuthenticated = state.isAuthenticated;
    });
    
    // Check if we're returning from OAuth callback
    if (typeof window !== 'undefined') {
      // Check for tenant query parameter FIRST - this takes priority
      const urlParams = new URLSearchParams(window.location.search);
      const tenantParam = urlParams.get('tenant');
      
      if (tenantParam) {
        const newTenantUrl = tenantParam.trim();
        
        // Normalize tenant URLs for comparison (remove protocol, trailing slashes)
        const normalizeTenantUrl = (url: string): string => {
          return url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
        };
        
        // Get current tenant from auth store or localStorage
        let currentTenantUrl: string | null = null;
        
        // Check auth store first
        const storeUnsubscribe = authStore.subscribe(state => {
          if (state.tenantUrl) {
            currentTenantUrl = state.tenantUrl;
          }
        });
        storeUnsubscribe();
        
        // Fallback to localStorage if not in store
        if (!currentTenantUrl) {
          currentTenantUrl = localStorage.getItem('currentTenantUrl');
        }
        
        // Compare tenants (normalized)
        const normalizedNewTenant = normalizeTenantUrl(newTenantUrl);
        const normalizedCurrentTenant = currentTenantUrl ? normalizeTenantUrl(currentTenantUrl) : null;
        
        // If different tenant, logout first and clear everything
        if (normalizedCurrentTenant && normalizedNewTenant !== normalizedCurrentTenant) {
          // Logout from current tenant
          authStore.logout();
          // Clear currentTenantUrl from localStorage
          localStorage.removeItem('currentTenantUrl');
          // Clear any Qlik API tokens
          localStorage.removeItem('qlik-access-token');
          sessionStorage.removeItem('qlik-access-token');
          // Clear any other Qlik-related storage
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('qlik-') || key.startsWith('@qlik/')) {
              localStorage.removeItem(key);
            }
          });
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('qlik-') || key.startsWith('@qlik/')) {
              sessionStorage.removeItem(key);
            }
          });
          // Clear cached Qlik API instance
          if ((window as any).qlikApi) {
            delete (window as any).qlikApi;
          }
          // Set isAuthenticated to false to show login page
          isAuthenticated = false;
          isCheckingAuth = false;
          return unsubscribe;
        }
      }
      
      // Now check for existing session (only if no tenant parameter or same tenant)
      const storedTenantUrl = localStorage.getItem('currentTenantUrl');
      if (storedTenantUrl) {
        // Check if we just returned from OAuth callback
        const isReturningFromOAuth = document.referrer?.includes('/oauth-callback') || 
                                     window.location.search.includes('code=');
        
        if (isReturningFromOAuth || !isAuthenticated) {
          checkExistingSession(storedTenantUrl);
        } else {
          isCheckingAuth = false;
        }
      } else {
        isCheckingAuth = false;
      }
    }
    
    return unsubscribe;
  });
  
  function handleLogout() {
    authStore.logout();
    if (typeof window !== 'undefined') {
      // Clear all Qlik-related storage
      localStorage.removeItem('currentTenantUrl');
      localStorage.removeItem('qlik-tenant-history');
      
      // Clear all Qlik-related localStorage keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('qlik-') || key.startsWith('@qlik/')) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear all Qlik-related sessionStorage keys
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('qlik-') || key.startsWith('@qlik/')) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Clear cached Qlik API instance
      if ((window as any).qlikApi) {
        delete (window as any).qlikApi;
      }
      
      // Reset auth checking state
      isCheckingAuth = false;
      isAuthenticated = false;
      
      // Reload the page to ensure clean state (respecting base path)
      window.location.href = base || '/';
    }
  }
  
  async function checkExistingSession(tenantUrl: string) {
    try {
      isCheckingAuth = true;
      const { configureQlikAuthOnce } = await import('$lib/utils/qlik-auth');
      
      // Configure auth once (prevents multiple setDefaultHostConfig calls)
      await configureQlikAuthOnce(tenantUrl);
      
      const qlikApi = await loadQlikAPI();
      const { items, users, tenants } = qlikApi;
      
      // Try to get items to check authentication with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Authentication check timeout')), 10000)
      );
      
      const itemsPromise = items.getItems({ resourceType: 'app[directQuery,]' });
      const response = await Promise.race([itemsPromise, timeoutPromise]) as any;
      
      if (response && response.status === 200) {
        // Get tenant and user info
        let tenantName: string | null = null;
        let user: any = null;
        
        try {
          const tenantResponse = await tenants.getMyTenant();
          if (tenantResponse.status === 200 && tenantResponse.data?.name) {
            tenantName = tenantResponse.data.name;
          }
        } catch (e) {
          console.warn('Failed to get tenant info:', e);
        }
        
        try {
          const userResponse = await users.getMyUser();
          if (userResponse.status === 200) {
            user = userResponse.data;
          }
        } catch (e) {
          console.warn('Failed to get user info:', e);
        }
        
        authStore.setAuthenticated(tenantUrl, tenantName, user, response.data || []);
        isCheckingAuth = false;
      } else {
        // Session expired, clear stored tenant
        console.warn('Authentication check failed with status:', response?.status);
        localStorage.removeItem('currentTenantUrl');
        isCheckingAuth = false;
      }
    } catch (err: any) {
      console.warn('Failed to restore session:', err);
      // If it's an auth error, clear and show login
      if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('unauthorized') || err.message?.includes('timeout')) {
        localStorage.removeItem('currentTenantUrl');
      }
      isCheckingAuth = false;
    }
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<header class="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
	<div class="px-[10px] max-w-full">
		<div class="flex justify-between items-center h-16">
			<!-- Logo and Navigation -->
			<div class="flex items-center pl-4">
				<div class="flex-shrink-0 relative">
					<div class="flex items-center">
						<Logo />
						<h1 class="text-xl font-semibold text-gray-600 dark:text-gray-400">Analytics Notebook</h1>
					</div>
				</div>
			</div>
			
			{#if isAuthenticated && authState}
				<div class="flex items-center gap-4">
				{#if authState.tenantName}
					<a
						href={authState.tenantUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm text-gray-600 dark:text-gray-400 hidden sm:block hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
					>
						{authState.tenantName}
					</a>
				{/if}
					{#if authState.user?.name}
						<span class="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
							{authState.user.name}
						</span>
					{/if}
					<button
						type="button"
						onclick={handleLogout}
						class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
					>
						Log out
					</button>
				</div>
			{/if}
		</div>
	</div>
</header>

<!-- Main Content -->
{#if isCheckingAuth}
	<main class="flex-1 px-[10px] py-8 w-full flex items-center justify-center max-w-full">
		<div class="text-center">
			<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
			<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">Checking authentication...</p>
		</div>
	</main>
{:else if isAuthenticated}
	<main class="flex-1 px-[10px] py-8 w-full flex flex-col min-h-0 max-w-full">
		<!-- Search Component -->
		<Search />
		
		<!-- Template Container -->
		<div id="templateContainer">
			<!-- Templates will be loaded here -->
		</div>
	</main>
{:else}
	<Login />
{/if}

<!-- Footer -->
<footer class="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
	<div class="px-[10px] py-4 max-w-full">
		<div class="flex justify-between items-center">
			<div class="text-sm text-gray-500 dark:text-gray-400">
				<p>Analytics Notebook v{version}</p>
			</div>
			<div class="flex items-center space-x-4">
			</div>
		</div>
	</div>
</footer>