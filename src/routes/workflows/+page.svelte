<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { workflowsStore } from '$lib/stores/workflows';
	import { environmentsStore } from '$lib/stores/environments';
	import { authStore } from '$lib/stores/auth';
	import WorkflowVisualization from '$lib/components/WorkflowVisualization.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import type { Workflow, Environment, WorkflowStage } from '$lib/types';
	import { generateId } from '$lib/types';
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

	let workflows = $state<Workflow[]>([]);
	let environments = $state<Environment[]>([]);
	let isLoading = $state(true);
	let showCreateModal = $state(false);
	let editingWorkflow = $state<Workflow | null>(null);

	// Form state
	let formName = $state('');
	let formDescription = $state('');
	let formStages = $state<{ environmentId: string; requiresApproval: boolean }[]>([]);

	// Available environments (not already in current workflow)
	const availableEnvironments = $derived(
		environments.filter(env => !formStages.some(s => s.environmentId === env.id))
	);

	function resetForm() {
		formName = '';
		formDescription = '';
		formStages = [];
		editingWorkflow = null;
	}

	function openCreateModal() {
		resetForm();
		showCreateModal = true;
	}

	function openEditModal(workflow: Workflow) {
		editingWorkflow = workflow;
		formName = workflow.name;
		formDescription = workflow.description || '';
		// Use spread to avoid mutating workflow.stages
		formStages = [...workflow.stages]
			.sort((a, b) => a.order - b.order)
			.map(s => ({
				environmentId: s.environmentId,
				requiresApproval: s.requiresApproval || false
			}));
		showCreateModal = true;
	}

	function closeModal() {
		showCreateModal = false;
		resetForm();
	}

	function addStage(environmentId: string) {
		formStages = [...formStages, { environmentId, requiresApproval: formStages.length > 0 }];
	}

	function removeStage(index: number) {
		formStages = formStages.filter((_, i) => i !== index);
	}

	function moveStage(index: number, direction: 'up' | 'down') {
		if (direction === 'up' && index > 0) {
			const newStages = [...formStages];
			[newStages[index - 1], newStages[index]] = [newStages[index], newStages[index - 1]];
			formStages = newStages;
		} else if (direction === 'down' && index < formStages.length - 1) {
			const newStages = [...formStages];
			[newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]];
			formStages = newStages;
		}
	}

	function handleSubmit() {
		if (!formName.trim() || formStages.length < 2) return;

		const stages: WorkflowStage[] = formStages.map((s, index) => ({
			environmentId: s.environmentId,
			order: index,
			requiresApproval: s.requiresApproval
		}));

		if (editingWorkflow) {
			workflowsStore.update(editingWorkflow.id, {
				name: formName.trim(),
				description: formDescription.trim() || undefined,
				stages
			});
		} else {
			workflowsStore.create({
				name: formName.trim(),
				description: formDescription.trim() || undefined,
				stages
			});
		}

		closeModal();
	}

	function handleDelete(id: string) {
		if (confirm('Are you sure you want to delete this workflow?')) {
			workflowsStore.delete(id);
		}
	}

	function getEnvironmentName(id: string): string {
		return environments.find(e => e.id === id)?.name || id;
	}

	onMount(() => {
		const unsubWf = workflowsStore.subscribe(wfs => {
			workflows = wfs;
		});

		const unsubEnv = environmentsStore.subscribe(envs => {
			environments = envs;
			isLoading = false;
		});

		return () => {
			unsubWf();
			unsubEnv();
		};
	});
</script>

<AppHeader onLogout={handleLogout} />

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<div class="max-w-7xl mx-auto px-4 py-8">
		<!-- Page Header -->
		<div class="flex items-center justify-between mb-8">
			<div>
				<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Workflows</h1>
				<p class="mt-2 text-gray-600 dark:text-gray-400">
					Define the promotion paths for moving resources between environments
				</p>
			</div>
			<button
				type="button"
				onclick={openCreateModal}
				class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				New Workflow
			</button>
		</div>

		<!-- Workflows List -->
		{#if isLoading}
			<div class="flex items-center justify-center h-64">
				<div class="text-center">
					<div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-4"></div>
					<p class="text-sm text-gray-600 dark:text-gray-400">Loading workflows...</p>
				</div>
			</div>
		{:else if workflows.length === 0}
			<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
				<svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
				</svg>
				<h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No workflows</h3>
				<p class="mt-2 text-gray-500 dark:text-gray-400">Create a workflow to define how resources move between environments.</p>
				<button
					type="button"
					onclick={openCreateModal}
					class="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					Create Workflow
				</button>
			</div>
		{:else}
			<div class="space-y-4">
				{#each workflows as workflow (workflow.id)}
					<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
						<div class="flex items-start justify-between mb-4">
							<div>
								<h3 class="text-lg font-semibold text-gray-900 dark:text-white">{workflow.name}</h3>
								{#if workflow.description}
									<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{workflow.description}</p>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => openEditModal(workflow)}
									class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
									aria-label="Edit workflow"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
								</button>
								<button
									type="button"
									onclick={() => handleDelete(workflow.id)}
									class="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
									aria-label="Delete workflow"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								</button>
							</div>
						</div>
						
						<WorkflowVisualization {workflow} {environments} />
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Create/Edit Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 overflow-y-auto">
		<div class="flex min-h-full items-center justify-center p-4">
			<div class="fixed inset-0 bg-black/50" onclick={closeModal}></div>
			
			<div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full p-6">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">
					{editingWorkflow ? 'Edit Workflow' : 'Create Workflow'}
				</h2>
				
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-5">
					<!-- Name -->
					<div>
						<label for="wf-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Name <span class="text-red-500">*</span>
						</label>
						<input
							id="wf-name"
							type="text"
							bind:value={formName}
							placeholder="e.g., Standard Promotion"
							class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
						/>
					</div>

					<!-- Description -->
					<div>
						<label for="wf-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Description
						</label>
						<textarea
							id="wf-description"
							bind:value={formDescription}
							placeholder="Describe the workflow and when to use it..."
							rows="2"
							class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
						></textarea>
					</div>

					<!-- Stages -->
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Stages <span class="text-red-500">*</span>
							<span class="text-xs font-normal text-gray-500 ml-1">(minimum 2)</span>
						</label>
						
						{#if formStages.length > 0}
							<div class="space-y-2 mb-4">
								{#each formStages as stage, index (stage.environmentId)}
									{@const env = environments.find(e => e.id === stage.environmentId)}
									<div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
										<div class="flex items-center gap-1">
											<button
												type="button"
												onclick={() => moveStage(index, 'up')}
												disabled={index === 0}
												class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
												</svg>
											</button>
											<button
												type="button"
												onclick={() => moveStage(index, 'down')}
												disabled={index === formStages.length - 1}
												class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
												</svg>
											</button>
										</div>
										
										<div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
											style="background-color: {env?.color || '#6b7280'}">
											{index + 1}
										</div>
										
										<div class="flex-1">
											<div class="font-medium text-gray-900 dark:text-white">{env?.name || stage.environmentId}</div>
											<div class="text-xs text-gray-500 capitalize">{env?.purpose || 'unknown'}</div>
										</div>
										
										<label class="flex items-center gap-2 text-sm">
											<input
												type="checkbox"
												bind:checked={stage.requiresApproval}
												class="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
											/>
											<span class="text-gray-600 dark:text-gray-400">Approval required</span>
										</label>
										
										<button
											type="button"
											onclick={() => removeStage(index)}
											class="p-1 text-gray-400 hover:text-red-500"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								{/each}
							</div>
						{/if}
						
						<!-- Add Stage -->
						{#if availableEnvironments.length > 0}
							<div class="flex flex-wrap gap-2">
								{#each availableEnvironments as env}
									<button
										type="button"
										onclick={() => addStage(env.id)}
										class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
									>
										<div class="w-3 h-3 rounded-full" style="background-color: {env.color}"></div>
										<span class="text-gray-700 dark:text-gray-300">{env.name}</span>
										<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
										</svg>
									</button>
								{/each}
							</div>
						{:else if formStages.length === 0}
							<p class="text-sm text-gray-500 dark:text-gray-400">
								No environments available. Create environments first.
							</p>
						{/if}
					</div>

					<!-- Actions -->
					<div class="flex justify-end gap-3 pt-4">
						<button
							type="button"
							onclick={closeModal}
							class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!formName.trim() || formStages.length < 2}
							class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
						>
							{editingWorkflow ? 'Save Changes' : 'Create Workflow'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

