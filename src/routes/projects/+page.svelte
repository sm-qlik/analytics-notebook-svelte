<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { projectsStore, commitsStore } from '$lib/stores/projects';
	import { workflowsStore } from '$lib/stores/workflows';
	import { environmentsStore } from '$lib/stores/environments';
	import { authStore } from '$lib/stores/auth';
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import type { Project, Commit, Workflow, Environment } from '$lib/types';
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

	let projects = $state<Project[]>([]);
	let commits = $state<Commit[]>([]);
	let workflows = $state<Workflow[]>([]);
	let environments = $state<Environment[]>([]);
	let isLoading = $state(true);
	let showCreateModal = $state(false);

	// Form state
	let formName = $state('');
	let formDescription = $state('');
	let formWorkflowId = $state('');

	function resetForm() {
		formName = '';
		formDescription = '';
		formWorkflowId = workflows[0]?.id || '';
	}

	function openCreateModal() {
		resetForm();
		showCreateModal = true;
	}

	function closeModal() {
		showCreateModal = false;
		resetForm();
	}

	function handleSubmit() {
		if (!formName.trim() || !formWorkflowId) return;

		const newProject = projectsStore.create({
			name: formName.trim(),
			description: formDescription.trim() || undefined,
			workflowId: formWorkflowId,
			spaceIds: [], // Spaces will be assigned after project creation
			resources: []
		});

		closeModal();
		goto(`${base}/projects/${newProject.id}`);
	}

	function handleProjectClick(id: string) {
		goto(`${base}/projects/${id}`);
	}

	function handleProjectEdit(id: string) {
		goto(`${base}/projects/${id}`);
	}

	function handleProjectDelete(id: string) {
		if (confirm('Are you sure you want to delete this project? All commits will also be deleted.')) {
			projectsStore.delete(id);
		}
	}

	// Pre-compute latest commits per project to avoid state access during render
	const latestCommitsByProject = $derived.by(() => {
		const map = new Map<string, Commit>();
		// Group commits by project and find the latest
		const sortedCommits = [...commits].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
		for (const commit of sortedCommits) {
			if (!map.has(commit.projectId)) {
				map.set(commit.projectId, commit);
			}
		}
		return map;
	});

	// Pre-compute workflows by id
	const workflowsById = $derived.by(() => {
		const map = new Map<string, Workflow>();
		for (const wf of workflows) {
			map.set(wf.id, wf);
		}
		return map;
	});

	onMount(() => {
		const unsubProj = projectsStore.subscribe(projs => {
			projects = projs;
		});

		const unsubCommits = commitsStore.subscribe(comms => {
			commits = comms;
		});

		const unsubWf = workflowsStore.subscribe(wfs => {
			workflows = wfs;
			if (!formWorkflowId && wfs.length > 0) {
				formWorkflowId = wfs[0].id;
			}
		});

		const unsubEnv = environmentsStore.subscribe(envs => {
			environments = envs;
			isLoading = false;
		});

		return () => {
			unsubProj();
			unsubCommits();
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
				<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
				<p class="mt-2 text-gray-600 dark:text-gray-400">
					Manage your deployment projects and track versions across environments
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
				New Project
			</button>
		</div>

		<!-- Projects Grid -->
		{#if isLoading}
			<div class="flex items-center justify-center h-64">
				<div class="text-center">
					<div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-4"></div>
					<p class="text-sm text-gray-600 dark:text-gray-400">Loading projects...</p>
				</div>
			</div>
		{:else if projects.length === 0}
			<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
				<svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
				</svg>
				<h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No projects</h3>
				<p class="mt-2 text-gray-500 dark:text-gray-400">Create a project to start tracking resources across environments.</p>
				<button
					type="button"
					onclick={openCreateModal}
					class="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					Create Project
				</button>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each projects as project (project.id)}
					<ProjectCard
						{project}
						latestCommit={latestCommitsByProject.get(project.id)}
						workflow={workflowsById.get(project.workflowId)}
						{environments}
						onClick={handleProjectClick}
						onEdit={handleProjectEdit}
						onDelete={handleProjectDelete}
					/>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 overflow-y-auto">
		<div class="flex min-h-full items-center justify-center p-4">
			<div class="fixed inset-0 bg-black/50 z-40" onclick={closeModal}></div>
			
			<div class="relative z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full p-6">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Create Project</h2>
				
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-5">
					<!-- Name -->
					<div>
						<label for="proj-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Name <span class="text-red-500">*</span>
						</label>
						<input
							id="proj-name"
							type="text"
							bind:value={formName}
							placeholder="e.g., Finance Reporting Suite"
							class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
						/>
					</div>

					<!-- Description -->
					<div>
						<label for="proj-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Description
						</label>
						<textarea
							id="proj-description"
							bind:value={formDescription}
							placeholder="Describe the project and its purpose..."
							rows="3"
							class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
						></textarea>
					</div>

					<!-- Workflow -->
					<div>
						<label for="proj-workflow" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Workflow <span class="text-red-500">*</span>
						</label>
						<select
							id="proj-workflow"
							bind:value={formWorkflowId}
							class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
						>
							{#each workflows as workflow}
								<option value={workflow.id}>{workflow.name}</option>
							{/each}
						</select>
						{#if workflows.length === 0}
							<p class="mt-2 text-sm text-amber-600 dark:text-amber-400">
								No workflows available. Create a workflow first.
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
							disabled={!formName.trim() || !formWorkflowId}
							class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
						>
							Create Project
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

