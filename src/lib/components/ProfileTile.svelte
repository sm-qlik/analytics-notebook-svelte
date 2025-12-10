<script lang="ts">
	let { 
		tenantName, 
		tenantUrl, 
		userName, 
		onLogout,
		onManageData
	}: {
		tenantName: string | null;
		tenantUrl: string | null;
		userName: string | null;
		onLogout: () => void;
		onManageData?: () => void;
	} = $props();

	let isOpen = $state(false);
	let dropdownRef = $state<HTMLDivElement | null>(null);
	let buttonRef = $state<HTMLButtonElement | null>(null);

	// Get initials from user name
	function getInitials(name: string | null): string {
		if (!name) return '?';
		const trimmed = name.trim();
		if (!trimmed) return '?';
		const parts = trimmed.split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}
		return trimmed.substring(0, 2).toUpperCase();
	}

	const initials = $derived(getInitials(userName));

	// Close dropdown when clicking outside
	$effect(() => {
		if (!isOpen) return;

		function handleClickOutside(event: MouseEvent) {
			if (
				dropdownRef &&
				buttonRef &&
				!dropdownRef.contains(event.target as Node) &&
				!buttonRef.contains(event.target as Node)
			) {
				isOpen = false;
			}
		}

		document.addEventListener('mousedown', handleClickOutside);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	});

	function toggleDropdown() {
		isOpen = !isOpen;
	}
</script>

<div class="relative">
	<!-- Profile Tile Button -->
	<button
		bind:this={buttonRef}
		type="button"
		onclick={toggleDropdown}
		class="flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
		aria-expanded={isOpen}
		aria-haspopup="true"
	>
		<!-- Initials Avatar -->
		<div class="flex-shrink-0 w-8 h-8 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300 shadow-sm">
			{initials}
		</div>
		
		<!-- Tenant Name -->
		{#if tenantName}
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
				{tenantName}
			</span>
		{/if}
		
		<!-- Dropdown Arrow -->
		<svg
			class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 transition-transform {isOpen ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	<!-- Dropdown Menu -->
	{#if isOpen}
		<div
			bind:this={dropdownRef}
			class="absolute right-0 mt-2 min-w-72 w-max max-w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
		>
			<!-- User Info Section -->
			<div class="px-4 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-x-auto">
				{#if userName}
					<p class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{userName}</p>
				{/if}
				{#if tenantUrl}
					{@const fullUrl = tenantUrl.startsWith('http') ? tenantUrl : `https://${tenantUrl}`}
					<a
						href={fullUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap font-mono underline transition-colors"
					>
						{tenantUrl}
					</a>
				{/if}
			</div>

			<!-- Manage Data Button -->
			{#if onManageData}
				<div class="py-1.5 border-b border-gray-100 dark:border-gray-700">
					<button
						type="button"
						onclick={() => {
							isOpen = false;
							onManageData();
						}}
						class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5"
					>
						<svg
							class="w-4 h-4 text-gray-500 dark:text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
							/>
						</svg>
						Manage data
					</button>
				</div>
			{/if}

			<!-- Logout Button -->
			<div class="py-1.5">
				<button
					type="button"
					onclick={() => {
						isOpen = false;
						onLogout();
					}}
					class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5"
				>
					<svg
						class="w-4 h-4 text-gray-500 dark:text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						/>
					</svg>
					Log out
				</button>
			</div>
		</div>
	{/if}
</div>

