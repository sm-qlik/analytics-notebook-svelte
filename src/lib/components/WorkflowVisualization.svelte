<script lang="ts">
	import type { Workflow, Environment } from '$lib/types';

	interface Props {
		workflow: Workflow;
		environments: Environment[];
		currentEnvironmentId?: string;
		highlightedEnvironmentIds?: string[];
		onStageClick?: (environmentId: string) => void;
		compact?: boolean;
	}

	let { 
		workflow, 
		environments, 
		currentEnvironmentId, 
		highlightedEnvironmentIds = [],
		onStageClick,
		compact = false
	}: Props = $props();

	// Get environment by ID
	function getEnvironment(id: string): Environment | undefined {
		return environments.find(e => e.id === id);
	}

	// Sort stages by order
	const sortedStages = $derived(
		[...workflow.stages].sort((a, b) => a.order - b.order)
	);
</script>

<div class="flex items-center gap-2 {compact ? '' : 'py-4'}">
	{#each sortedStages as stage, index (stage.environmentId)}
		{@const env = getEnvironment(stage.environmentId)}
		{@const isCurrent = currentEnvironmentId === stage.environmentId}
		{@const isHighlighted = highlightedEnvironmentIds.includes(stage.environmentId)}
		
		<!-- Stage Card -->
		<div
			class="relative flex-shrink-0 {compact ? 'px-3 py-2' : 'px-4 py-3'} rounded-lg border-2 transition-all duration-200
				{isCurrent 
					? 'border-green-500 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500/20' 
					: isHighlighted
						? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
						: 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}
				{onStageClick ? 'cursor-pointer hover:border-gray-400 dark:hover:border-gray-500' : ''}"
			role={onStageClick ? 'button' : undefined}
			tabindex={onStageClick ? 0 : undefined}
			onclick={onStageClick ? () => onStageClick(stage.environmentId) : undefined}
			onkeydown={onStageClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onStageClick(stage.environmentId) : undefined}
		>
			<!-- Environment Color Indicator -->
			{#if env}
				<div 
					class="absolute top-0 left-0 w-1 h-full rounded-l-md"
					style="background-color: {env.color}"
				></div>
			{/if}
			
			<div class="pl-2">
				<div class="flex items-center gap-2">
					<span class="{compact ? 'text-sm' : 'text-base'} font-medium text-gray-900 dark:text-white">
						{env?.name || stage.environmentId}
					</span>
					
					{#if isCurrent}
						<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
							Current
						</span>
					{/if}
				</div>
				
				{#if !compact && env}
					<div class="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
						<span class="capitalize">{env.purpose}</span>
						{#if stage.requiresApproval}
							<span class="flex items-center gap-1">
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
								</svg>
								Approval required
							</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
		
		<!-- Arrow between stages -->
		{#if index < sortedStages.length - 1}
			<div class="flex-shrink-0 text-gray-400 dark:text-gray-500">
				<svg class="{compact ? 'w-4 h-4' : 'w-5 h-5'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</div>
		{/if}
	{/each}
</div>

{#if !compact && workflow.description}
	<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
		{workflow.description}
	</p>
{/if}

