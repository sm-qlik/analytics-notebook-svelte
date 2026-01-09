<script lang="ts">
	import type { Environment } from '$lib/types';

	interface Props {
		environment: Environment;
		spacesMap?: Map<string, string>; // spaceId -> spaceName
		onEdit?: (id: string) => void;
		onDelete?: (id: string) => void;
		onClick?: (id: string) => void;
	}

	let { environment, spacesMap = new Map(), onEdit, onDelete, onClick }: Props = $props();

	function handleClick() {
		if (onClick) onClick(environment.id);
	}

	function handleEdit(e: MouseEvent) {
		e.stopPropagation();
		if (onEdit) onEdit(environment.id);
	}

	function handleDelete(e: MouseEvent) {
		e.stopPropagation();
		if (onDelete) onDelete(environment.id);
	}

	function getSpaceNames(): string[] {
		return environment.spaceIds.map(id => spacesMap.get(id) || id);
	}

	const purposeLabel = $derived(environment.purpose === 'production' ? 'Production' : 'Authoring');
	const purposeColor = $derived(environment.purpose === 'production' 
		? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
		: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400');
</script>

<div
	class="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 overflow-hidden {onClick ? 'cursor-pointer' : ''}"
	role={onClick ? 'button' : undefined}
	tabindex={onClick ? 0 : undefined}
	onclick={onClick ? handleClick : undefined}
	onkeydown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && handleClick() : undefined}
>
	<!-- Color Banner -->
	<div 
		class="h-2 w-full" 
		style="background-color: {environment.color}"
	></div>

	<div class="p-5">
		<!-- Header -->
		<div class="flex items-start justify-between gap-3">
			<div class="flex-1 min-w-0">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
					{environment.name}
				</h3>
				{#if environment.description}
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
						{environment.description}
					</p>
				{/if}
			</div>
			
			<!-- Purpose Badge -->
			<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {purposeColor}">
				{purposeLabel}
			</span>
		</div>

		<!-- Variables Summary -->
		<div class="mt-4 flex items-center gap-4 text-sm">
			<div class="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
				<span>{environment.variables.length} variables</span>
			</div>
			
			<div class="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
				</svg>
				<span>{environment.spaceIds.length} spaces</span>
			</div>
		</div>

		<!-- Spaces List -->
		{#if environment.spaceIds.length > 0}
			<div class="mt-3 flex flex-wrap gap-1.5">
				{#each getSpaceNames().slice(0, 3) as spaceName}
					<span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
						{spaceName}
					</span>
				{/each}
				{#if environment.spaceIds.length > 3}
					<span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
						+{environment.spaceIds.length - 3} more
					</span>
				{/if}
			</div>
		{/if}

		<!-- Actions -->
		{#if onEdit || onDelete}
			<div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
				{#if onEdit}
					<button
						type="button"
						onclick={handleEdit}
						class="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
					>
						Configure
					</button>
				{/if}
				{#if onDelete}
					<button
						type="button"
						onclick={handleDelete}
						class="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						aria-label="Delete environment"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

