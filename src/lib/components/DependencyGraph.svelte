<script lang="ts">
	import type { Dependency, ResourceType } from '$lib/types';
	import { getResourceTypeInfo } from '$lib/types';

	interface ResourceNode {
		id: string;
		name: string;
		type: ResourceType;
	}

	interface Props {
		resources: ResourceNode[];
		dependencies: Dependency[];
		selectedResourceId?: string;
		onResourceClick?: (id: string) => void;
	}

	let { resources, dependencies, selectedResourceId, onResourceClick }: Props = $props();

	// Build a graph representation
	const graph = $derived.by(() => {
		const nodes = new Map<string, ResourceNode>();
		const edges: { from: string; to: string; type: string }[] = [];
		
		for (const resource of resources) {
			nodes.set(resource.id, resource);
		}
		
		for (const dep of dependencies) {
			// Only include edges where both nodes exist
			if (nodes.has(dep.sourceResourceId) && nodes.has(dep.targetResourceId)) {
				edges.push({
					from: dep.sourceResourceId,
					to: dep.targetResourceId,
					type: dep.dependencyType
				});
			}
		}
		
		return { nodes, edges };
	});

	// Calculate node positions in a layered layout
	const layout = $derived.by(() => {
		const positions = new Map<string, { x: number; y: number; level: number }>();
		const visited = new Set<string>();
		const levels = new Map<string, number>();
		
		// Build adjacency list
		const outgoing = new Map<string, string[]>();
		const incoming = new Map<string, string[]>();
		
		for (const [id] of graph.nodes) {
			outgoing.set(id, []);
			incoming.set(id, []);
		}
		
		for (const edge of graph.edges) {
			outgoing.get(edge.from)?.push(edge.to);
			incoming.get(edge.to)?.push(edge.from);
		}
		
		// Find root nodes (no incoming edges)
		const roots: string[] = [];
		for (const [id] of graph.nodes) {
			if ((incoming.get(id)?.length || 0) === 0) {
				roots.push(id);
			}
		}
		
		// If no roots, pick any node
		if (roots.length === 0 && graph.nodes.size > 0) {
			roots.push(graph.nodes.keys().next().value);
		}
		
		// BFS to assign levels
		const queue = roots.map(id => ({ id, level: 0 }));
		while (queue.length > 0) {
			const { id, level } = queue.shift()!;
			if (visited.has(id)) continue;
			visited.add(id);
			levels.set(id, level);
			
			for (const targetId of outgoing.get(id) || []) {
				if (!visited.has(targetId)) {
					queue.push({ id: targetId, level: level + 1 });
				}
			}
		}
		
		// Handle any unvisited nodes (isolated or in cycles)
		for (const [id] of graph.nodes) {
			if (!visited.has(id)) {
				levels.set(id, 0);
			}
		}
		
		// Group nodes by level
		const levelGroups = new Map<number, string[]>();
		for (const [id, level] of levels) {
			if (!levelGroups.has(level)) {
				levelGroups.set(level, []);
			}
			levelGroups.get(level)!.push(id);
		}
		
		// Calculate positions
		const nodeWidth = 160;
		const nodeHeight = 70;
		const horizontalGap = 60;
		const verticalGap = 40;
		
		const maxLevel = Math.max(...Array.from(levels.values()), 0);
		const totalWidth = (maxLevel + 1) * (nodeWidth + horizontalGap);
		
		for (const [level, nodeIds] of levelGroups) {
			const levelHeight = nodeIds.length * (nodeHeight + verticalGap);
			nodeIds.forEach((id, index) => {
				positions.set(id, {
					x: level * (nodeWidth + horizontalGap) + 20,
					y: index * (nodeHeight + verticalGap) + (200 - levelHeight) / 2 + 20,
					level
				});
			});
		}
		
		return { positions, totalWidth, totalHeight: 200 };
	});

	function getColorClasses(type: ResourceType): { bg: string; border: string; text: string } {
		const info = getResourceTypeInfo(type);
		const colors: Record<string, { bg: string; border: string; text: string }> = {
			green: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-300 dark:border-green-700', text: 'text-green-700 dark:text-green-300' },
			blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300' },
			purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-700 dark:text-purple-300' },
			orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300' },
			teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-300 dark:border-teal-700', text: 'text-teal-700 dark:text-teal-300' },
			gray: { bg: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-300 dark:border-gray-700', text: 'text-gray-700 dark:text-gray-300' }
		};
		return colors[info.color] || colors.gray;
	}
</script>

<div class="relative bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
	{#if resources.length === 0}
		<div class="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
			<div class="text-center">
				<svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
				</svg>
				<p class="mt-2 text-sm">Select resources to view dependencies</p>
			</div>
		</div>
	{:else}
		<div class="relative overflow-auto" style="min-height: 200px; width: 100%;">
			<svg 
				class="absolute inset-0" 
				style="width: {Math.max(layout.totalWidth + 40, 400)}px; height: {layout.totalHeight}px;"
			>
				<!-- Draw edges -->
				{#each graph.edges as edge}
					{@const fromPos = layout.positions.get(edge.from)}
					{@const toPos = layout.positions.get(edge.to)}
					{#if fromPos && toPos}
						<line
							x1={fromPos.x + 160}
							y1={fromPos.y + 35}
							x2={toPos.x}
							y2={toPos.y + 35}
							stroke="currentColor"
							stroke-width="2"
							class="text-gray-300 dark:text-gray-600"
							marker-end="url(#arrowhead)"
						/>
					{/if}
				{/each}
				
				<!-- Arrow marker definition -->
				<defs>
					<marker
						id="arrowhead"
						markerWidth="10"
						markerHeight="7"
						refX="10"
						refY="3.5"
						orient="auto"
					>
						<polygon
							points="0 0, 10 3.5, 0 7"
							fill="currentColor"
							class="text-gray-400 dark:text-gray-500"
						/>
					</marker>
				</defs>
			</svg>
			
			<!-- Draw nodes -->
			{#each Array.from(graph.nodes.entries()) as [id, resource]}
				{@const pos = layout.positions.get(id)}
				{@const colors = getColorClasses(resource.type)}
				{@const isSelected = selectedResourceId === id}
				{#if pos}
					<div
						class="absolute w-40 rounded-lg border-2 p-3 transition-all duration-150
							{colors.bg} {isSelected ? 'ring-2 ring-green-500 border-green-500' : colors.border}
							{onResourceClick ? 'cursor-pointer hover:shadow-md' : ''}"
						style="left: {pos.x}px; top: {pos.y}px;"
						role={onResourceClick ? 'button' : undefined}
						tabindex={onResourceClick ? 0 : undefined}
						onclick={onResourceClick ? () => onResourceClick(id) : undefined}
						onkeydown={onResourceClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onResourceClick(id) : undefined}
					>
						<div class="text-xs font-medium {colors.text} uppercase tracking-wide">
							{getResourceTypeInfo(resource.type).label}
						</div>
						<div class="mt-1 text-sm font-medium text-gray-900 dark:text-white truncate" title={resource.name}>
							{resource.name}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>

{#if dependencies.length > 0}
	<div class="mt-3 text-xs text-gray-500 dark:text-gray-400">
		{dependencies.length} {dependencies.length === 1 ? 'dependency' : 'dependencies'} between selected resources
	</div>
{/if}

