<script lang="ts">
	import type { Project, Commit, Environment, Workflow } from '$lib/types';
	import { getResourceTypeInfo } from '$lib/types';

	interface Props {
		project: Project;
		latestCommit?: Commit;
		workflow?: Workflow;
		environments?: Environment[];
		onClick?: (id: string) => void;
		onEdit?: (id: string) => void;
		onDelete?: (id: string) => void;
	}

	let { project, latestCommit, workflow, environments = [], onClick, onEdit, onDelete }: Props = $props();

	// Group resources by type
	const resourcesByType = $derived.by(() => {
		const groups = new Map<string, number>();
		for (const resource of project.resources) {
			const count = groups.get(resource.resourceType) || 0;
			groups.set(resource.resourceType, count + 1);
		}
		return Array.from(groups.entries()).map(([type, count]) => ({
			type,
			count,
			info: getResourceTypeInfo(type)
		}));
	});

	// Get environment names for the workflow
	const workflowEnvironments = $derived.by(() => {
		if (!workflow) return [];
		// Use spread to avoid mutating the original array with sort()
		return [...workflow.stages]
			.sort((a, b) => a.order - b.order)
			.map(stage => {
				const env = environments.find(e => e.id === stage.environmentId);
				return { id: stage.environmentId, name: env?.name || stage.environmentId, color: env?.color || '#6b7280' };
			});
	});

	function handleClick() {
		if (onClick) onClick(project.id);
	}

	function handleEdit(e: MouseEvent) {
		e.stopPropagation();
		if (onEdit) onEdit(project.id);
	}

	function handleDelete(e: MouseEvent) {
		e.stopPropagation();
		if (onDelete) onDelete(project.id);
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<div
	class="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 overflow-hidden {onClick ? 'cursor-pointer' : ''}"
	role={onClick ? 'button' : undefined}
	tabindex={onClick ? 0 : undefined}
	onclick={onClick ? handleClick : undefined}
	onkeydown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && handleClick() : undefined}
>
	<div class="p-5">
		<!-- Header -->
		<div class="flex items-start justify-between gap-3">
			<div class="flex-1 min-w-0">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
					{project.name}
				</h3>
				{#if project.description}
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
						{project.description}
					</p>
				{/if}
			</div>
			
			{#if latestCommit}
				<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
					<span class="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
						{latestCommit.hash}
					</span>
				</div>
			{/if}
		</div>

		<!-- Workflow Stages -->
		{#if workflowEnvironments.length > 0}
			<div class="mt-4 flex items-center gap-1.5">
				{#each workflowEnvironments as env, index}
					<div 
						class="flex items-center gap-1"
						title={env.name}
					>
						<div 
							class="w-3 h-3 rounded-full border-2"
							style="background-color: {env.color}; border-color: {env.color}"
						></div>
						<span class="text-xs text-gray-600 dark:text-gray-400">{env.name}</span>
					</div>
					{#if index < workflowEnvironments.length - 1}
						<svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					{/if}
				{/each}
			</div>
		{/if}

		<!-- Resources Summary -->
		<div class="mt-4 flex flex-wrap gap-2">
			{#each resourcesByType as { type, count, info }}
				<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
					{count} {count === 1 ? info.label : info.pluralLabel}
				</span>
			{/each}
		</div>

		<!-- Latest Commit Info -->
		{#if latestCommit}
			<div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
				<div class="flex items-center gap-2 text-sm">
					<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="text-gray-600 dark:text-gray-400">
						Latest: <span class="font-medium text-gray-900 dark:text-white">{latestCommit.summary}</span>
					</span>
				</div>
				<div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					by {latestCommit.createdBy} on {formatDate(latestCommit.createdAt)}
				</div>
			</div>
		{:else}
			<div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
				<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<span>No commits yet</span>
				</div>
			</div>
		{/if}

		<!-- Actions -->
		{#if onEdit || onDelete}
			<div class="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
				{#if onEdit}
					<button
						type="button"
						onclick={handleEdit}
						class="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
					>
						Edit
					</button>
				{/if}
				{#if onDelete}
					<button
						type="button"
						onclick={handleDelete}
						class="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						aria-label="Delete project"
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

