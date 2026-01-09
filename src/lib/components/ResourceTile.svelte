<script lang="ts">
	import type { ResourceType } from '$lib/types';
	import { getResourceTypeInfo } from '$lib/types';

	interface Props {
		id: string;
		name: string;
		updatedAt?: string;
		spaceId?: string;
		spaceName?: string;
		resourceType: ResourceType | string;
		thumbnailId?: string;
		tenantUrl?: string;
		description?: string;
		isSelected?: boolean;
		selectable?: boolean;
		onClick?: (id: string) => void;
		onMenuClick?: (id: string, event: MouseEvent) => void;
		onSelect?: (id: string, selected: boolean) => void;
	}

	let { 
		id, 
		name, 
		updatedAt, 
		spaceId, 
		spaceName,
		resourceType = 'app',
		thumbnailId,
		tenantUrl,
		description,
		isSelected = false,
		selectable = false,
		onClick,
		onMenuClick,
		onSelect
	}: Props = $props();

	const typeInfo = $derived(getResourceTypeInfo(resourceType));

	// Format relative time
	function formatRelativeTime(dateString?: string): string {
		if (!dateString) return '';
		
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		
		return date.toLocaleDateString();
	}

	function handleClick() {
		if (selectable && onSelect) {
			onSelect(id, !isSelected);
		} else if (onClick) {
			onClick(id);
		}
	}

	function handleMenuClick(event: MouseEvent) {
		event.stopPropagation();
		if (onMenuClick) {
			onMenuClick(id, event);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick();
		}
	}

	// Get color classes based on resource type
	function getColorClasses(): { bg: string; text: string; border: string; badge: string } {
		const colors: Record<string, { bg: string; text: string; border: string; badge: string }> = {
			green: { 
				bg: 'bg-green-50 dark:bg-green-900/20', 
				text: 'text-green-600 dark:text-green-400',
				border: 'border-green-200 dark:border-green-800',
				badge: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
			},
			blue: { 
				bg: 'bg-blue-50 dark:bg-blue-900/20', 
				text: 'text-blue-600 dark:text-blue-400',
				border: 'border-blue-200 dark:border-blue-800',
				badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
			},
			purple: { 
				bg: 'bg-purple-50 dark:bg-purple-900/20', 
				text: 'text-purple-600 dark:text-purple-400',
				border: 'border-purple-200 dark:border-purple-800',
				badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
			},
			orange: { 
				bg: 'bg-orange-50 dark:bg-orange-900/20', 
				text: 'text-orange-600 dark:text-orange-400',
				border: 'border-orange-200 dark:border-orange-800',
				badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
			},
			teal: { 
				bg: 'bg-teal-50 dark:bg-teal-900/20', 
				text: 'text-teal-600 dark:text-teal-400',
				border: 'border-teal-200 dark:border-teal-800',
				badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
			},
			yellow: { 
				bg: 'bg-yellow-50 dark:bg-yellow-900/20', 
				text: 'text-yellow-600 dark:text-yellow-400',
				border: 'border-yellow-200 dark:border-yellow-800',
				badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
			},
			indigo: { 
				bg: 'bg-indigo-50 dark:bg-indigo-900/20', 
				text: 'text-indigo-600 dark:text-indigo-400',
				border: 'border-indigo-200 dark:border-indigo-800',
				badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'
			},
			pink: { 
				bg: 'bg-pink-50 dark:bg-pink-900/20', 
				text: 'text-pink-600 dark:text-pink-400',
				border: 'border-pink-200 dark:border-pink-800',
				badge: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300'
			},
			gray: { 
				bg: 'bg-gray-50 dark:bg-gray-900/20', 
				text: 'text-gray-600 dark:text-gray-400',
				border: 'border-gray-200 dark:border-gray-700',
				badge: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
			},
			slate: { 
				bg: 'bg-slate-50 dark:bg-slate-900/20', 
				text: 'text-slate-600 dark:text-slate-400',
				border: 'border-slate-200 dark:border-slate-700',
				badge: 'bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-300'
			},
			cyan: { 
				bg: 'bg-cyan-50 dark:bg-cyan-900/20', 
				text: 'text-cyan-600 dark:text-cyan-400',
				border: 'border-cyan-200 dark:border-cyan-800',
				badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300'
			},
			lime: { 
				bg: 'bg-lime-50 dark:bg-lime-900/20', 
				text: 'text-lime-600 dark:text-lime-400',
				border: 'border-lime-200 dark:border-lime-800',
				badge: 'bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-300'
			},
			rose: { 
				bg: 'bg-rose-50 dark:bg-rose-900/20', 
				text: 'text-rose-600 dark:text-rose-400',
				border: 'border-rose-200 dark:border-rose-800',
				badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
			},
			fuchsia: { 
				bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', 
				text: 'text-fuchsia-600 dark:text-fuchsia-400',
				border: 'border-fuchsia-200 dark:border-fuchsia-800',
				badge: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-300'
			},
			violet: { 
				bg: 'bg-violet-50 dark:bg-violet-900/20', 
				text: 'text-violet-600 dark:text-violet-400',
				border: 'border-violet-200 dark:border-violet-800',
				badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300'
			},
			amber: { 
				bg: 'bg-amber-50 dark:bg-amber-900/20', 
				text: 'text-amber-600 dark:text-amber-400',
				border: 'border-amber-200 dark:border-amber-800',
				badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
			},
			emerald: { 
				bg: 'bg-emerald-50 dark:bg-emerald-900/20', 
				text: 'text-emerald-600 dark:text-emerald-400',
				border: 'border-emerald-200 dark:border-emerald-800',
				badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
			}
		};
		return colors[typeInfo.color] || colors.gray;
	}

	const colorClasses = $derived(getColorClasses());
</script>

<div
	class="group relative bg-white dark:bg-gray-800 rounded-lg border transition-all duration-200 cursor-pointer overflow-hidden
		{isSelected ? 'ring-2 ring-green-500 border-green-500' : 'border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600'}"
	role="button"
	tabindex="0"
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	<!-- Selection Checkbox (when selectable) -->
	{#if selectable}
		<div class="absolute top-2 left-2 z-10">
			<div class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
				{isSelected ? 'bg-green-500 border-green-500' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'}">
				{#if isSelected}
					<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Thumbnail Area -->
	<div class="relative h-28 {colorClasses.bg} flex items-center justify-center overflow-hidden">
		{#if thumbnailId && tenantUrl && (typeInfo.type === 'app' || typeInfo.type === 'qvapp' || typeInfo.type === 'qlikview')}
			<img 
				src="{tenantUrl}/api/v1/apps/{id}/media/thumbnail"
				alt="{name} thumbnail"
				class="w-full h-full object-cover"
				onerror={(e) => {
					const target = e.target as HTMLImageElement;
					target.style.display = 'none';
				}}
			/>
		{/if}
		
		<!-- Resource Type Icon -->
		<div class="absolute inset-0 flex items-center justify-center {thumbnailId && (typeInfo.type === 'app' || typeInfo.type === 'qvapp' || typeInfo.type === 'qlikview') ? 'opacity-0' : 'opacity-100'}">
			{#if typeInfo.type === 'app'}
				<!-- Application icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
				</svg>
			{:else if typeInfo.type === 'qvapp' || typeInfo.type === 'qlikview'}
				<!-- QlikView icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
				</svg>
			{:else if typeInfo.type === 'automation'}
				<!-- Automation/cog icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			{:else if typeInfo.type === 'dataproduct'}
				<!-- Data Product/cube icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
				</svg>
			{:else if typeInfo.type === 'dataset'}
				<!-- Dataset/table icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
				</svg>
			{:else if typeInfo.type === 'note'}
				<!-- Note/document icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
			{:else if typeInfo.type === 'glossary'}
				<!-- Glossary/book icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
				</svg>
			{:else if typeInfo.type === 'genericlink'}
				<!-- Link icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
				</svg>
			{:else if typeInfo.type === 'script'}
				<!-- Script/code icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
				</svg>
			{:else if typeInfo.type === 'dataflow'}
				<!-- Dataflow/arrows icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
			{:else if typeInfo.type === 'tablerecipe'}
				<!-- Table Recipe/clipboard icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
				</svg>
			{:else if typeInfo.type === 'automl-deployment'}
				<!-- ML Deployment/rocket icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
				</svg>
			{:else if typeInfo.type === 'automl-experiment'}
				<!-- ML Experiment/beaker icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
				</svg>
			{:else if typeInfo.type === 'assistant'}
				<!-- Assistant/chat icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 12.5c0 .47-.015.937-.045 1.4-.18 2.775-1.056 4.792-2.461 6.197-1.405 1.405-3.422 2.28-6.197 2.46A24.34 24.34 0 0110 22.5c-5.523 0-10-3.358-10-7.5 0-4.142 4.477-7.5 10-7.5s10 3.358 10 7.5z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.25 11.25a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zM8.25 11.25a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zM18.25 11.25a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" />
				</svg>
			{:else if typeInfo.type === 'knowledgebase'}
				<!-- Knowledge Base/lightbulb icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
				</svg>
			{:else if typeInfo.type === 'sharingservicetask'}
				<!-- Sharing Task/share icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
				</svg>
			{:else}
				<!-- Default document icon -->
				<svg class="w-12 h-12 {colorClasses.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
				</svg>
			{/if}
		</div>

		<!-- Resource Type Badge -->
		<div class="absolute top-2 right-2">
			<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {colorClasses.badge}">
				{typeInfo.label}
			</span>
		</div>
	</div>

	<!-- Content Area -->
	<div class="p-3">
		<!-- Resource Name -->
		<h3 class="font-medium text-gray-900 dark:text-white truncate text-sm" title={name}>
			{name}
		</h3>

		<!-- Description (if available) -->
		{#if description}
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2" title={description}>
				{description}
			</p>
		{/if}

		<!-- Metadata Row -->
		<div class="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
			<span class="truncate">{formatRelativeTime(updatedAt)}</span>
			{#if spaceName}
				<span class="truncate max-w-[50%]" title={spaceName}>{spaceName}</span>
			{/if}
		</div>
	</div>

	<!-- Menu Button (visible on hover, not in select mode) -->
	{#if !selectable}
		<button
			type="button"
			class="absolute bottom-2 right-2 p-1.5 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 opacity-0 group-hover:opacity-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-150"
			onclick={handleMenuClick}
			aria-label="More options for {name}"
		>
			<svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
				<path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
			</svg>
		</button>
	{/if}
</div>

