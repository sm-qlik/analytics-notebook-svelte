<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { environmentsStore } from '$lib/stores/environments';
	import { authStore } from '$lib/stores/auth';
	import { loadQlikAPI, configureQlikAuthOnce } from '$lib/utils/qlik-auth';
	import EnvironmentCard from '$lib/components/EnvironmentCard.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import type { Environment, EnvironmentPurpose } from '$lib/types';
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

	let environments = $state<Environment[]>([]);
	let spaces = $state<{ id: string; name: string }[]>([]);
	let isLoading = $state(true);
	let showCreateModal = $state(false);
	let editingEnvironment = $state<Environment | null>(null);

	// Form state
	let formName = $state('');
	let formDescription = $state('');
	let formPurpose = $state<EnvironmentPurpose>('authoring');
	let formColor = $state('#3b82f6');

	const colors = [
		'#3b82f6', // Blue
		'#22c55e', // Green
		'#f59e0b', // Amber
		'#ef4444', // Red
		'#8b5cf6', // Purple
		'#06b6d4', // Cyan
		'#ec4899', // Pink
		'#6b7280'  // Gray
	];

	// Create space map for display
	const spacesMap = $derived(new Map(spaces.map(s => [s.id, s.name])));

	function resetForm() {
		formName = '';
		formDescription = '';
		formPurpose = 'authoring';
		formColor = '#3b82f6';
		editingEnvironment = null;
	}

	function openCreateModal() {
		resetForm();
		showCreateModal = true;
	}

	function openEditModal(env: Environment) {
		editingEnvironment = env;
		formName = env.name;
		formDescription = env.description || '';
		formPurpose = env.purpose;
		formColor = env.color;
		showCreateModal = true;
	}

	function closeModal() {
		showCreateModal = false;
		resetForm();
	}

	function handleSubmit() {
		if (!formName.trim()) return;

		if (editingEnvironment) {
			environmentsStore.update(editingEnvironment.id, {
				name: formName.trim(),
				description: formDescription.trim() || undefined,
				purpose: formPurpose,
				color: formColor
			});
		} else {
			environmentsStore.create({
				name: formName.trim(),
				description: formDescription.trim() || undefined,
				purpose: formPurpose,
				color: formColor,
				variables: [],
				spaceIds: []
			});
		}

		closeModal();
	}

	function handleDelete(id: string) {
		if (confirm('Are you sure you want to delete this environment?')) {
			environmentsStore.delete(id);
		}
	}

	function handleEdit(id: string) {
		const env = environments.find(e => e.id === id);
		if (env) {
			goto(`${base}/environments/${id}`);
		}
	}

	async function loadSpaces() {
		try {
			let tenantUrl: string | null = null;
			const unsubscribe = authStore.subscribe(state => {
				tenantUrl = state.tenantUrl;
			});
			unsubscribe();

			if (!tenantUrl) return;

			await configureQlikAuthOnce(tenantUrl);
			const qlikApi = await loadQlikAPI();
			const { spaces: spacesApi } = qlikApi;

			if (spacesApi) {
				const response = await spacesApi.getSpaces({ limit: 100 });
				if (response.status === 200) {
					spaces = (response.data?.data || []).map((s: any) => ({
						id: s.id,
						name: s.name
					}));
				}
			}
		} catch (err) {
			console.warn('Failed to load spaces:', err);
		}
	}

	onMount(() => {
		const unsubEnv = environmentsStore.subscribe(envs => {
			environments = envs;
		});

		loadSpaces().finally(() => {
			isLoading = false;
		});

		return () => {
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
				<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Environments</h1>
				<p class="mt-2 text-gray-600 dark:text-gray-400">
					Manage your deployment environments and their configurations
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
				New Environment
			</button>
		</div>

		<!-- Environments Grid -->
		{#if isLoading}
			<div class="flex items-center justify-center h-64">
				<div class="text-center">
					<div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-4"></div>
					<p class="text-sm text-gray-600 dark:text-gray-400">Loading environments...</p>
				</div>
			</div>
		{:else if environments.length === 0}
			<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
				<svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
				</svg>
				<h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No environments</h3>
				<p class="mt-2 text-gray-500 dark:text-gray-400">Get started by creating your first environment.</p>
				<button
					type="button"
					onclick={openCreateModal}
					class="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					Create Environment
				</button>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each environments as environment (environment.id)}
					<EnvironmentCard
						{environment}
						{spacesMap}
						onEdit={handleEdit}
						onDelete={handleDelete}
						onClick={handleEdit}
					/>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Create/Edit Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 overflow-y-auto">
		<div class="flex min-h-full items-center justify-center p-4">
			<!-- Backdrop -->
			<div 
				class="fixed inset-0 bg-black/50 z-40 transition-opacity"
				onclick={closeModal}
			></div>
			
			<!-- Modal -->
			<div class="relative z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full p-6">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">
					{editingEnvironment ? 'Edit Environment' : 'Create Environment'}
				</h2>
				
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-5">
					<!-- Name -->
					<div>
						<label for="env-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Name <span class="text-red-500">*</span>
						</label>
						<input
							id="env-name"
							type="text"
							bind:value={formName}
							placeholder="e.g., Development, Staging, Production"
							class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
						/>
					</div>

					<!-- Description -->
					<div>
						<label for="env-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Description
						</label>
						<textarea
							id="env-description"
							bind:value={formDescription}
							placeholder="Describe the purpose of this environment..."
							rows="2"
							class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
						></textarea>
					</div>

					<!-- Purpose -->
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Purpose
						</label>
						<div class="grid grid-cols-2 gap-3">
							<button
								type="button"
								onclick={() => formPurpose = 'authoring'}
								class="flex items-center gap-3 p-3 rounded-lg border-2 transition-colors
									{formPurpose === 'authoring' 
										? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
										: 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}"
							>
								<div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
									<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
								</div>
								<div class="text-left">
									<div class="font-medium text-gray-900 dark:text-white">Authoring</div>
									<div class="text-xs text-gray-500 dark:text-gray-400">For development</div>
								</div>
							</button>
							
							<button
								type="button"
								onclick={() => formPurpose = 'production'}
								class="flex items-center gap-3 p-3 rounded-lg border-2 transition-colors
									{formPurpose === 'production' 
										? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
										: 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}"
							>
								<div class="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
									<svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
									</svg>
								</div>
								<div class="text-left">
									<div class="font-medium text-gray-900 dark:text-white">Production</div>
									<div class="text-xs text-gray-500 dark:text-gray-400">Live environment</div>
								</div>
							</button>
						</div>
					</div>

					<!-- Color -->
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Color
						</label>
						<div class="flex gap-2">
							{#each colors as color}
								<button
									type="button"
									onclick={() => formColor = color}
									class="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110
										{formColor === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}"
									style="background-color: {color}"
									aria-label="Select color"
								></button>
							{/each}
						</div>
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
							disabled={!formName.trim()}
							class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
						>
							{editingEnvironment ? 'Save Changes' : 'Create Environment'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

