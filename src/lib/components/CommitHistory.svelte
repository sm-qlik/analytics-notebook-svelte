<script lang="ts">
	import type { Commit, Environment } from '$lib/types';
	import { getResourceTypeInfo } from '$lib/types';

	interface Props {
		commits: Commit[];
		environments: Environment[];
		onCommitClick?: (id: string) => void;
		onPromote?: (commitId: string) => void;
		maxItems?: number;
	}

	let { commits, environments, onCommitClick, onPromote, maxItems }: Props = $props();

	const displayedCommits = $derived(maxItems ? commits.slice(0, maxItems) : commits);

	function getEnvironmentName(id: string): string {
		return environments.find(e => e.id === id)?.name || id;
	}

	function getEnvironmentColor(id: string): string {
		return environments.find(e => e.id === id)?.color || '#6b7280';
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		
		if (diffDays === 0) {
			return 'Today at ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
		} else if (diffDays === 1) {
			return 'Yesterday at ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
		} else if (diffDays < 7) {
			return `${diffDays} days ago`;
		}
		
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function getStatusBadge(status: Commit['status']): { class: string; label: string } {
		switch (status) {
			case 'draft':
				return { class: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', label: 'Draft' };
			case 'committed':
				return { class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Committed' };
			case 'promoted':
				return { class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Promoted' };
			default:
				return { class: 'bg-gray-100 text-gray-700', label: status };
		}
	}
</script>

<div class="space-y-4">
	{#each displayedCommits as commit (commit.id)}
		{@const statusBadge = getStatusBadge(commit.status)}
		
		<div
			class="relative pl-6 pb-4 {onCommitClick ? 'cursor-pointer' : ''}"
			role={onCommitClick ? 'button' : undefined}
			tabindex={onCommitClick ? 0 : undefined}
			onclick={onCommitClick ? () => onCommitClick(commit.id) : undefined}
			onkeydown={onCommitClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onCommitClick(commit.id) : undefined}
		>
			<!-- Timeline line -->
			<div class="absolute left-2 top-3 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></div>
			
			<!-- Commit dot -->
			<div 
				class="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800"
				style="background-color: {getEnvironmentColor(commit.currentEnvironmentId)}"
			></div>
			
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
				<!-- Header -->
				<div class="flex items-start justify-between gap-3">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<span class="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">
								{commit.hash}
							</span>
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {statusBadge.class}">
								{statusBadge.label}
							</span>
						</div>
						<h4 class="mt-2 font-medium text-gray-900 dark:text-white">
							{commit.summary}
						</h4>
						{#if commit.description}
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
								{commit.description}
							</p>
						{/if}
					</div>
				</div>

				<!-- Resources -->
				<div class="mt-3 flex flex-wrap gap-1.5">
					{#each commit.resources.slice(0, 5) as resource}
						{@const info = getResourceTypeInfo(resource.resourceType)}
						<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
							{info.label}: {resource.name}
						</span>
					{/each}
					{#if commit.resources.length > 5}
						<span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
							+{commit.resources.length - 5} more
						</span>
					{/if}
				</div>

				<!-- Current Environment -->
				<div class="mt-3 flex items-center gap-2 text-sm">
					<span class="text-gray-500 dark:text-gray-400">Currently in:</span>
					<span 
						class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
						style="background-color: {getEnvironmentColor(commit.currentEnvironmentId)}20; color: {getEnvironmentColor(commit.currentEnvironmentId)}"
					>
						<span 
							class="w-2 h-2 rounded-full"
							style="background-color: {getEnvironmentColor(commit.currentEnvironmentId)}"
						></span>
						{getEnvironmentName(commit.currentEnvironmentId)}
					</span>
				</div>

				<!-- Footer -->
				<div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
					<div class="text-xs text-gray-500 dark:text-gray-400">
						<span>{commit.createdBy}</span>
						<span class="mx-1">·</span>
						<span>{formatDate(commit.createdAt)}</span>
					</div>
					
					{#if onPromote && commit.status === 'committed'}
						<button
							type="button"
							onclick={(e) => { e.stopPropagation(); onPromote(commit.id); }}
							class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-md transition-colors"
						>
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
							</svg>
							Promote
						</button>
					{/if}
				</div>

				<!-- Promotion History -->
				{#if commit.promotionHistory.length > 0}
					<div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
						<div class="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Promotion History</div>
						<div class="space-y-1">
							{#each commit.promotionHistory as promotion}
								<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
									<span>{getEnvironmentName(promotion.fromEnvironmentId)}</span>
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
									<span>{getEnvironmentName(promotion.toEnvironmentId)}</span>
									<span class="text-gray-400">·</span>
									<span>{formatDate(promotion.promotedAt)}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/each}
	
	{#if maxItems && commits.length > maxItems}
		<div class="text-center">
			<span class="text-sm text-gray-500 dark:text-gray-400">
				+{commits.length - maxItems} more commits
			</span>
		</div>
	{/if}
</div>

