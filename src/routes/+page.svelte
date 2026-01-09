<script lang="ts">
  import Logo from './Logo.svelte';
  import Login from '$lib/components/Login.svelte';
  import ResourceCatalog from '$lib/components/ResourceCatalog.svelte';
  import HelpModal from '$lib/components/HelpModal.svelte';
  import ProfileTile from '$lib/components/ProfileTile.svelte';
  import { authStore } from '$lib/stores/auth';
  import { onMount } from 'svelte';
  import { parseTenantUrl, createAuthConfig, loadQlikAPI } from '$lib/utils/qlik-auth';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  
  type NavItem = 'catalog' | 'environments' | 'workflows' | 'projects';
  let activeNav = $state<NavItem>('catalog');
  
  const version = import.meta.env.APP_VERSION;
  
  let isAuthenticated = $state(false);
  let isCheckingAuth = $state(true);
  let authState = $state<any>(null);
  let isHelpOpen = $state(false);
  let helpInitialSection = $state<string | undefined>(undefined);
  
  let pageTitle = $derived(
    authState?.isAuthenticated && authState?.tenantName
      ? `${authState.tenantName} - QCS Environments`
      : 'QCS Environments'
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
          currentTenantUrl = localStorage.getItem('qcs-env-tenant-url');
        }
        
        // Compare tenants (normalized)
        const normalizedNewTenant = normalizeTenantUrl(newTenantUrl);
        const normalizedCurrentTenant = currentTenantUrl ? normalizeTenantUrl(currentTenantUrl) : null;
        
        // If different tenant, logout first and clear everything
        if (normalizedCurrentTenant && normalizedNewTenant !== normalizedCurrentTenant) {
          // Logout from current tenant
          authStore.logout();
          // Clear currentTenantUrl from localStorage
          localStorage.removeItem('qcs-env-tenant-url');
          // Clear any Qlik API tokens
          localStorage.removeItem('qcs-env-access-token');
          sessionStorage.removeItem('qcs-env-access-token');
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
      const storedTenantUrl = localStorage.getItem('qcs-env-tenant-url');
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
      localStorage.removeItem('qcs-env-tenant-url');
      // Note: We preserve qcs-env-tenant-history so users can see recent tenants after logout
      
      // Clear all Qlik-related localStorage keys (except tenant history)
      Object.keys(localStorage).forEach(key => {
        if ((key.startsWith('qlik-') || key.startsWith('@qlik/')) && key !== 'qcs-env-tenant-history') {
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
      
      const itemsPromise = items.getItems({ resourceType: 'app[directQuery,]' }, { noCache: false });
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
        
        // Don't pass items - just set authenticated state
        authStore.setAuthenticated(tenantUrl, tenantName, user, []);
        isCheckingAuth = false;
      } else {
        // Session expired, clear stored tenant
        console.warn('Authentication check failed with status:', response?.status);
        localStorage.removeItem('qcs-env-tenant-url');
        isCheckingAuth = false;
      }
    } catch (err: any) {
      console.warn('Failed to restore session:', err);
      // If it's an auth error, clear and show login
      if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('unauthorized') || err.message?.includes('timeout')) {
        localStorage.removeItem('qcs-env-tenant-url');
      }
      isCheckingAuth = false;
    }
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<header class="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
	<div class="px-4 max-w-full">
		<div class="flex justify-between items-center h-16">
			<!-- Logo and Navigation -->
			<div class="flex items-center gap-6">
				<div class="flex-shrink-0 relative">
					<div class="flex items-center">
						<Logo />
						<h1 class="text-xl font-semibold text-gray-600 dark:text-gray-400">QCS Environments</h1>
					</div>
				</div>
				
				{#if isAuthenticated && authState}
					<!-- Navigation Items -->
					<nav class="flex items-center gap-1">
						<button
							onclick={() => activeNav = 'catalog'}
							class="px-3 py-2 text-sm font-medium transition-colors rounded-lg
								{activeNav === 'catalog' 
									? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' 
									: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}"
						>
							Catalog
						</button>
						<button
							onclick={() => goto(`${base}/environments`)}
							class="px-3 py-2 text-sm font-medium transition-colors rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
						>
							Environments
						</button>
						<button
							onclick={() => goto(`${base}/workflows`)}
							class="px-3 py-2 text-sm font-medium transition-colors rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
						>
							Workflows
						</button>
						<button
							onclick={() => goto(`${base}/projects`)}
							class="px-3 py-2 text-sm font-medium transition-colors rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
						>
							Projects
						</button>
					</nav>
				{/if}
			</div>
			
			<!-- Right side: Help button (always), Profile (when authenticated) -->
			<div class="flex items-center gap-3">
				<!-- Help Button - Always visible for both authenticated and unauthenticated users -->
				<button
					type="button"
					onclick={() => {
						helpInitialSection = undefined;
						isHelpOpen = true;
					}}
					class="flex items-center justify-center w-8 h-8 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					aria-label="Help"
					title="Help & Information"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</button>
				
				{#if isAuthenticated && authState}
					<ProfileTile
						tenantName={authState.tenantName}
						tenantUrl={authState.tenantUrl}
						userName={authState.user?.name}
						onLogout={handleLogout}
					/>
				{/if}
			</div>
		</div>
	</div>
</header>

<!-- Main Content -->
{#if isCheckingAuth}
	<main class="flex-1 px-4 py-8 w-full flex items-center justify-center max-w-full">
		<div class="text-center">
			<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
			<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">Checking authentication...</p>
		</div>
	</main>
{:else if isAuthenticated}
	<main class="flex-1 w-full flex flex-col min-h-0 max-w-full">
		<ResourceCatalog />
	</main>
{:else}
	<Login onOpenHelp={(section?: string) => {
		helpInitialSection = section;
		isHelpOpen = true;
	}} />
{/if}

<!-- Footer -->
<footer class="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
	<div class="px-4 py-4 max-w-full">
		<div class="flex justify-between items-center">
			<div class="text-sm text-gray-500 dark:text-gray-400">
				<p>QCS Environments v{version}</p>
			</div>
		</div>
	</div>
</footer>

<!-- Help Modal -->
<HelpModal
	isOpen={isHelpOpen}
	initialSection={helpInitialSection}
	onClose={() => isHelpOpen = false}
/>
