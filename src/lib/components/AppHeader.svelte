<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import Logo from '../../routes/Logo.svelte';
	import ProfileTile from './ProfileTile.svelte';
	import HelpModal from './HelpModal.svelte';
	import { authStore } from '$lib/stores/auth';

	interface Props {
		onLogout?: () => void;
	}

	let { onLogout }: Props = $props();

	let authState = $state<any>(null);
	let isHelpOpen = $state(false);
	let helpInitialSection = $state<string | undefined>(undefined);

	// Get current path to highlight active nav
	const currentPath = $derived($page.url.pathname);

	function isActive(path: string): boolean {
		if (path === base || path === `${base}/`) {
			return currentPath === base || currentPath === `${base}/`;
		}
		return currentPath.startsWith(path);
	}

	$effect(() => {
		const unsubscribe = authStore.subscribe(state => {
			authState = state;
		});
		return unsubscribe;
	});

	const navItems = [
		{ path: base || '/', label: 'Catalog' },
		{ path: `${base}/environments`, label: 'Environments' },
		{ path: `${base}/workflows`, label: 'Workflows' },
		{ path: `${base}/projects`, label: 'Projects' }
	];
</script>

<header class="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
	<div class="px-4 max-w-full">
		<div class="flex justify-between items-center h-16">
			<!-- Logo and Navigation -->
			<div class="flex items-center gap-6">
				<div class="flex-shrink-0 relative">
					<a href={base || '/'} class="flex items-center">
						<Logo />
						<h1 class="text-xl font-semibold text-gray-600 dark:text-gray-400">QCS Environments</h1>
					</a>
				</div>
				
				{#if authState?.isAuthenticated}
					<!-- Navigation Items -->
					<nav class="flex items-center gap-1">
						{#each navItems as item}
							<button
								onclick={() => goto(item.path)}
								class="px-3 py-2 text-sm font-medium transition-colors rounded-lg
									{isActive(item.path) 
										? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' 
										: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}"
							>
								{item.label}
							</button>
						{/each}
					</nav>
				{/if}
			</div>
			
			<!-- Right side: Help button, Profile -->
			<div class="flex items-center gap-3">
				<!-- Help Button -->
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
				
				{#if authState?.isAuthenticated}
					<ProfileTile
						tenantName={authState.tenantName}
						tenantUrl={authState.tenantUrl}
						userName={authState.user?.name}
						onLogout={onLogout}
					/>
				{/if}
			</div>
		</div>
	</div>
</header>

<!-- Help Modal -->
<HelpModal
	isOpen={isHelpOpen}
	initialSection={helpInitialSection}
	onClose={() => isHelpOpen = false}
/>

