<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { projectsStore, commitsStore, dependenciesStore } from '$lib/stores/projects';
	import { workflowsStore } from '$lib/stores/workflows';
	import { environmentsStore } from '$lib/stores/environments';
	import { authStore } from '$lib/stores/auth';
	import { loadQlikAPI, configureQlikAuthOnce } from '$lib/utils/qlik-auth';
	import WorkflowVisualization from '$lib/components/WorkflowVisualization.svelte';
	import CommitHistory from '$lib/components/CommitHistory.svelte';
	import CommitForm from '$lib/components/CommitForm.svelte';
	import DependencyGraph from '$lib/components/DependencyGraph.svelte';
	import ResourceTile from '$lib/components/ResourceTile.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import type { Project, Commit, Workflow, Environment, ProjectResource, Dependency, ResourceType } from '$lib/types';
	import { getResourceTypeInfo, generateCommitHash } from '$lib/types';
	import { onMount } from 'svelte';

	function handleLogout() {
		authStore.logout();
		if (typeof window !== 'undefined') {
			localStorage.removeItem('qcs-env-tenant-url');
			Object.keys(localStorage).forEach(key => {
				if ((key.startsWith('qlik-') || key.startsWith('@qlik/')) && key !== 'qcs-env-tenant-history') {
					localStorage.removeItem(key);
				}
			});
			Object.keys(sessionStorage).forEach(key => {
				if (key.startsWith('qlik-') || key.startsWith('@qlik/')) {
					sessionStorage.removeItem(key);
				}
			});
			if ((window as any).qlikApi) {
				delete (window as any).qlikApi;
			}
			window.location.href = base || '/';
		}
	}

	let project = $state<Project | null>(null);
	let commits = $state<Commit[]>([]);
	let workflow = $state<Workflow | null>(null);
	let environments = $state<Environment[]>([]);
	let dependencies = $state<Dependency[]>([]);
	let isLoading = $state(true);
	
	// Resource selection
	let showResourceSelector = $state(false);
	let availableResources = $state<any[]>([]);
	let selectedResourceIds = $state<Set<string>>(new Set());
	let spaces = $state<{ id: string; name: string }[]>([]);
	let isLoadingResources = $state(false);

	// Commit creation
	let showCommitForm = $state(false);

	// Promotion
	let showPromotionModal = $state(false);
	let promotingCommit = $state<Commit | null>(null);
	let promotionNotes = $state('');

	const projectId = $derived($page.params.id);

	// Project commits (use spread to avoid mutating)
	const projectCommits = $derived(
		[...commits]
			.filter(c => c.projectId === projectId)
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
	);

	// Project dependencies (only between project resources)
	const projectDependencies = $derived.by(() => {
		if (!project) return [];
		const resourceIds = project.resources.map(r => r.resourceId);
		return dependencies.filter(d => 
			resourceIds.includes(d.sourceResourceId) && resourceIds.includes(d.targetResourceId)
		);
	});

	// Resources for dependency graph
	const graphResources = $derived.by(() => {
		if (!project) return [];
		return project.resources.map(r => ({
			id: r.resourceId,
			name: r.name,
			type: r.resourceType
		}));
	});

	// Current environment version info
	const environmentVersions = $derived.by(() => {
		if (!workflow) return [];
		
		// Use spread to avoid mutating workflow.stages
		return [...workflow.stages]
			.sort((a, b) => a.order - b.order)
			.map(stage => {
				const env = environments.find(e => e.id === stage.environmentId);
				const latestCommit = projectCommits.find(c => c.currentEnvironmentId === stage.environmentId);
				
				return {
					environment: env,
					commit: latestCommit,
					stageOrder: stage.order
				};
			});
	});

	async function loadAvailableResources() {
		isLoadingResources = true;
		try {
			let tenantUrl: string | null = null;
			const unsubscribe = authStore.subscribe(state => {
				tenantUrl = state.tenantUrl;
			});
			unsubscribe();

			if (!tenantUrl) return;

			await configureQlikAuthOnce(tenantUrl);
			const qlikApi = await loadQlikAPI();
			const { items, spaces: spacesApi } = qlikApi;

			// Fetch resources (use correct Qlik Cloud API resource type format)
			const resourceTypes = 'app[script,directQuery,],qvapp,qlikview,dataset[qix-df,qvd,connection_based_dataset],automation[],dataproduct[],note[view,edit,none]';
			const response = await items.getItems({ resourceType: resourceTypes, limit: 100 });
			
			if (response.status === 200) {
				availableResources = response.data?.data || [];
			}

			// Fetch spaces
			if (spacesApi) {
				const spacesResponse = await spacesApi.getSpaces({ limit: 100 });
				if (spacesResponse.status === 200) {
					spaces = (spacesResponse.data?.data || []).map((s: any) => ({
						id: s.id,
						name: s.name
					}));
				}
			}
		} catch (err) {
			console.warn('Failed to load resources:', err);
		} finally {
			isLoadingResources = false;
		}
	}

	function openResourceSelector() {
		if (project) {
			selectedResourceIds = new Set(project.resources.map(r => r.resourceId));
		}
		loadAvailableResources();
		showResourceSelector = true;
	}

	function toggleResourceSelection(resourceId: string) {
		const newSet = new Set(selectedResourceIds);
		if (newSet.has(resourceId)) {
			newSet.delete(resourceId);
		} else {
			newSet.add(resourceId);
		}
		selectedResourceIds = newSet;
	}

	function saveResourceSelection() {
		if (!project) return;

		const currentResourceIds = new Set(project.resources.map(r => r.resourceId));

		// Remove unselected resources
		for (const resourceId of currentResourceIds) {
			if (!selectedResourceIds.has(resourceId)) {
				projectsStore.removeResource(project.id, resourceId);
			}
		}

		// Add new resources
		for (const resourceId of selectedResourceIds) {
			if (!currentResourceIds.has(resourceId)) {
				const resource = availableResources.find(r => r.resourceId === resourceId);
				if (resource) {
					const projectResource: ProjectResource = {
						resourceId: resource.resourceId,
						resourceType: resource.resourceType?.split('[')[0] || 'app',
						name: resource.name,
						environmentResourceIds: {}
					};
					projectsStore.addResource(project.id, projectResource);
				}
			}
		}

		showResourceSelector = false;
	}

	function openCommitForm() {
		showCommitForm = true;
	}

	function handleCommitSubmit(summary: string, description: string) {
		if (!project) return;

		// Get current user (mock for now)
		let userName = 'Current User';
		const unsubscribe = authStore.subscribe(state => {
			userName = state.user?.name || 'Current User';
		});
		unsubscribe();

		// Determine the first environment in the workflow (use spread to avoid mutation)
		const firstEnvId = workflow ? [...workflow.stages].sort((a, b) => a.order - b.order)[0]?.environmentId : 'env-dev';

		commitsStore.create({
			projectId: project.id,
			summary,
			description: description || undefined,
			resources: project.resources.map(r => ({
				resourceId: r.resourceId,
				resourceType: r.resourceType,
				name: r.name,
				checksum: Math.random().toString(36).substring(7)
			})),
			currentEnvironmentId: firstEnvId,
			createdBy: userName
		});

		showCommitForm = false;
	}

	function handlePromoteClick(commitId: string) {
		const commit = commits.find(c => c.id === commitId);
		if (commit && workflow) {
			const currentStage = workflow.stages.find(s => s.environmentId === commit.currentEnvironmentId);
			const nextStage = workflow.stages.find(s => s.order === (currentStage?.order ?? -1) + 1);
			
			if (nextStage) {
				promotingCommit = commit;
				promotionNotes = '';
				showPromotionModal = true;
			}
		}
	}

	function confirmPromotion() {
		if (!promotingCommit || !workflow) return;

		const currentStage = workflow.stages.find(s => s.environmentId === promotingCommit.currentEnvironmentId);
		const nextStage = workflow.stages.find(s => s.order === (currentStage?.order ?? -1) + 1);

		if (nextStage) {
			let userName = 'Current User';
			const unsubscribe = authStore.subscribe(state => {
				userName = state.user?.name || 'Current User';
			});
			unsubscribe();

			commitsStore.promote(promotingCommit.id, nextStage.environmentId, userName, promotionNotes || undefined);
		}

		showPromotionModal = false;
		promotingCommit = null;
		promotionNotes = '';
	}

	function getSpaceName(spaceId?: string): string | undefined {
		if (!spaceId) return 'Personal';
		return spaces.find(s => s.id === spaceId)?.name;
	}

	onMount(() => {
		const unsubProj = projectsStore.subscribe(projs => {
			project = projs.find(p => p.id === projectId) || null;
		});

		const unsubCommits = commitsStore.subscribe(comms => {
			commits = comms;
		});

		const unsubWf = workflowsStore.subscribe(wfs => {
			if (project) {
				workflow = wfs.find(w => w.id === project.workflowId) || null;
			}
		});

		const unsubEnv = environmentsStore.subscribe(envs => {
			environments = envs;
		});

		const unsubDeps = dependenciesStore.subscribe(deps => {
			dependencies = deps;
			isLoading = false;
		});

		return () => {
			unsubProj();
			unsubCommits();
			unsubWf();
			unsubEnv();
			unsubDeps();
		};
	});

	// Update workflow when project changes
	$effect(() => {
		if (project) {
			const wfs = workflowsStore.getById(project.workflowId);
			if (wfs) workflow = wfs;
		}
	});
</script>

<AppHeader onLogout={handleLogout} />

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<div class="max-w-7xl mx-auto px-4 py-8">
		<!-- Back Button -->
		<button
			type="button"
			onclick={() => goto(`${base}/projects`)}
			class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Projects
		</button>

		{#if isLoading}
			<div class="flex items-center justify-center h-64">
				<div class="text-center">
					<div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-4"></div>
					<p class="text-sm text-gray-600 dark:text-gray-400">Loading project...</p>
				</div>
			</div>
		{:else if !project}
			<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
				<svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">Project not found</h3>
				<button
					type="button"
					onclick={() => goto(`${base}/projects`)}
					class="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
				>
					Go to Projects
				</button>
			</div>
		{:else}
			<!-- Header -->
			<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
				<div class="flex items-start justify-between">
					<div>
						<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
						{#if project.description}
							<p class="mt-2 text-gray-600 dark:text-gray-400">{project.description}</p>
						{/if}
					</div>
					<button
						type="button"
						onclick={openCommitForm}
						disabled={project.resources.length === 0}
						class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						Create Commit
					</button>
				</div>

				<!-- Workflow -->
				{#if workflow}
					<div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
						<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Workflow: {workflow.name}</h3>
						<WorkflowVisualization {workflow} {environments} compact />
					</div>
				{/if}
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<!-- Left Column: Resources & Dependencies -->
				<div class="lg:col-span-2 space-y-6">
					<!-- Resources Section -->
					<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
						<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
							<div>
								<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Resources</h2>
								<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									{project.resources.length} resources in this project
								</p>
							</div>
							<button
								type="button"
								onclick={openResourceSelector}
								class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
								</svg>
								Manage Resources
							</button>
						</div>

						{#if project.resources.length === 0}
							<div class="p-8 text-center">
								<svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
								</svg>
								<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">No resources added yet</p>
								<button
									type="button"
									onclick={openResourceSelector}
									class="mt-3 text-sm text-green-600 dark:text-green-400 hover:text-green-700"
								>
									Add resources to this project
								</button>
							</div>
						{:else}
							<div class="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
								{#each project.resources as resource}
									{@const info = getResourceTypeInfo(resource.resourceType)}
									<div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
										<div class="flex items-center gap-2 mb-1">
											<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-{info.color}-100 text-{info.color}-800 dark:bg-{info.color}-900/30 dark:text-{info.color}-400">
												{info.label}
											</span>
										</div>
										<div class="text-sm font-medium text-gray-900 dark:text-white truncate" title={resource.name}>
											{resource.name}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Dependencies Section -->
					{#if project.resources.length > 0}
						<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
							<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
								<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Dependencies</h2>
								<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									Relationships between resources in this project
								</p>
							</div>
							<div class="p-4">
								<DependencyGraph
									resources={graphResources}
									dependencies={projectDependencies}
								/>
							</div>
						</div>
					{/if}
				</div>

				<!-- Right Column: Environment Versions & Commits -->
				<div class="space-y-6">
					<!-- Environment Versions -->
					<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
						<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
							<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Environment Versions</h2>
						</div>
						<div class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each environmentVersions as { environment, commit, stageOrder }}
								<div class="px-6 py-4">
									<div class="flex items-center gap-3">
										<div 
											class="w-3 h-3 rounded-full"
											style="background-color: {environment?.color || '#6b7280'}"
										></div>
										<span class="font-medium text-gray-900 dark:text-white">
											{environment?.name || 'Unknown'}
										</span>
									</div>
									{#if commit}
										<div class="mt-2 ml-6">
											<div class="flex items-center gap-2 text-sm">
												<span class="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
													{commit.hash}
												</span>
												<span class="text-gray-500 dark:text-gray-400 truncate">
													{commit.summary}
												</span>
											</div>
										</div>
									{:else}
										<div class="mt-2 ml-6 text-sm text-gray-500 dark:text-gray-400">
											No version deployed
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>

					<!-- Commit History -->
					<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
						<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
							<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Commit History</h2>
						</div>
						<div class="p-4">
							{#if projectCommits.length === 0}
								<div class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
									No commits yet
								</div>
							{:else}
								<CommitHistory
									commits={projectCommits}
									{environments}
									onPromote={handlePromoteClick}
									maxItems={5}
								/>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Resource Selector Modal -->
{#if showResourceSelector}
	<div class="fixed inset-0 z-50 overflow-y-auto">
		<div class="flex min-h-full items-center justify-center p-4">
			<div class="fixed inset-0 bg-black/50" onclick={() => showResourceSelector = false}></div>
			
			<div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
				<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
					<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Select Resources</h2>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Choose the resources to include in this project
					</p>
				</div>
				
				<div class="flex-1 overflow-y-auto p-6">
					{#if isLoadingResources}
						<div class="flex items-center justify-center h-48">
							<div class="text-center">
								<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-3"></div>
								<p class="text-sm text-gray-500">Loading resources...</p>
							</div>
						</div>
					{:else if availableResources.length === 0}
						<div class="text-center py-12 text-gray-500 dark:text-gray-400">
							No resources available
						</div>
					{:else}
						<div class="mb-4 text-sm text-gray-600 dark:text-gray-400">
							{selectedResourceIds.size} selected
						</div>
						<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
							{#each availableResources as resource}
								<div
									class="p-4 rounded-lg border-2 cursor-pointer transition-all
										{selectedResourceIds.has(resource.resourceId) 
											? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
											: 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}"
									onclick={() => toggleResourceSelection(resource.resourceId)}
									role="checkbox"
									aria-checked={selectedResourceIds.has(resource.resourceId)}
									tabindex="0"
									onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleResourceSelection(resource.resourceId)}
								>
									<div class="flex items-start gap-3">
										<div class="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
											{selectedResourceIds.has(resource.resourceId) 
												? 'bg-green-500 border-green-500' 
												: 'border-gray-300 dark:border-gray-600'}">
											{#if selectedResourceIds.has(resource.resourceId)}
												<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
													<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
												</svg>
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<div class="text-sm font-medium text-gray-900 dark:text-white truncate">
												{resource.name}
											</div>
											<div class="text-xs text-gray-500 dark:text-gray-400">
												{getResourceTypeInfo(resource.resourceType?.split('[')[0] || 'app').label}
											</div>
											{#if resource.spaceId}
												<div class="text-xs text-gray-400 dark:text-gray-500 truncate">
													{getSpaceName(resource.spaceId)}
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
				
				<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => showResourceSelector = false}
						class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={saveResourceSelection}
						class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
					>
						Save Selection
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Commit Form Modal -->
{#if showCommitForm && project}
	<div class="fixed inset-0 z-50 overflow-y-auto">
		<div class="flex min-h-full items-center justify-center p-4">
			<div class="fixed inset-0 bg-black/50" onclick={() => showCommitForm = false}></div>
			
			<div class="relative max-w-2xl w-full">
				<CommitForm
					resources={project.resources}
					projectName={project.name}
					onSubmit={handleCommitSubmit}
					onCancel={() => showCommitForm = false}
				/>
			</div>
		</div>
	</div>
{/if}

<!-- Promotion Modal -->
{#if showPromotionModal && promotingCommit && workflow}
	{@const currentStage = workflow.stages.find(s => s.environmentId === promotingCommit.currentEnvironmentId)}
	{@const nextStage = workflow.stages.find(s => s.order === (currentStage?.order ?? -1) + 1)}
	{@const nextEnv = environments.find(e => e.id === nextStage?.environmentId)}
	
	<div class="fixed inset-0 z-50 overflow-y-auto">
		<div class="flex min-h-full items-center justify-center p-4">
			<div class="fixed inset-0 bg-black/50" onclick={() => showPromotionModal = false}></div>
			
			<div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full p-6">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Promote Commit</h2>
				
				<div class="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
					<div class="flex items-center gap-2 text-sm">
						<span class="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">{promotingCommit.hash}</span>
						<span class="text-gray-700 dark:text-gray-300">{promotingCommit.summary}</span>
					</div>
				</div>
				
				<div class="mb-4 flex items-center justify-center gap-4">
					<div class="text-center">
						<div 
							class="w-4 h-4 rounded-full mx-auto mb-1"
							style="background-color: {environments.find(e => e.id === promotingCommit.currentEnvironmentId)?.color || '#6b7280'}"
						></div>
						<span class="text-sm text-gray-600 dark:text-gray-400">
							{environments.find(e => e.id === promotingCommit.currentEnvironmentId)?.name}
						</span>
					</div>
					<svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
					<div class="text-center">
						<div 
							class="w-4 h-4 rounded-full mx-auto mb-1"
							style="background-color: {nextEnv?.color || '#6b7280'}"
						></div>
						<span class="text-sm font-medium text-gray-900 dark:text-white">
							{nextEnv?.name}
						</span>
					</div>
				</div>
				
				<div class="mb-6">
					<label for="promotion-notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Notes (optional)
					</label>
					<textarea
						id="promotion-notes"
						bind:value={promotionNotes}
						placeholder="Add any notes about this promotion..."
						rows="3"
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 resize-none"
					></textarea>
				</div>
				
				<div class="flex justify-end gap-3">
					<button
						type="button"
						onclick={() => showPromotionModal = false}
						class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={confirmPromotion}
						class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
						</svg>
						Promote to {nextEnv?.name}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

