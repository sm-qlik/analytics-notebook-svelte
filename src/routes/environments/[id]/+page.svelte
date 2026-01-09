<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { environmentsStore } from '$lib/stores/environments';
	import { workflowsStore } from '$lib/stores/workflows';
	import { authStore } from '$lib/stores/auth';
	import { loadQlikAPI, configureQlikAuthOnce } from '$lib/utils/qlik-auth';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import type { Environment, EnvironmentVariable } from '$lib/types';
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

	let environment = $state<Environment | null>(null);
	let workflows = $state<any[]>([]);
	let spaces = $state<{ id: string; name: string }[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);

	// Variable editing
	let showAddVariable = $state(false);
	let editingVariableKey = $state<string | null>(null);
	let newVarKey = $state('');
	let newVarValue = $state('');
	let newVarIsSecret = $state(false);
	let newVarDescription = $state('');

	// Space assignment
	let showSpaceSelector = $state(false);
	let selectedSpaceIds = $state<Set<string>>(new Set());

	const envId = $derived($page.params.id);

	function resetVariableForm() {
		newVarKey = '';
		newVarValue = '';
		newVarIsSecret = false;
		newVarDescription = '';
		showAddVariable = false;
		editingVariableKey = null;
	}

	function handleAddVariable() {
		if (!environment || !newVarKey.trim()) return;

		environmentsStore.addVariable(environment.id, {
			key: newVarKey.trim(),
			value: newVarValue,
			isSecret: newVarIsSecret,
			description: newVarDescription.trim() || undefined
		});

		resetVariableForm();
	}

	function handleEditVariable(variable: EnvironmentVariable) {
		editingVariableKey = variable.key;
		newVarKey = variable.key;
		newVarValue = variable.isSecret ? '' : variable.value;
		newVarIsSecret = variable.isSecret;
		newVarDescription = variable.description || '';
		showAddVariable = true;
	}

	function handleUpdateVariable() {
		if (!environment || !editingVariableKey || !newVarKey.trim()) return;

		// If key changed, remove old and add new
		if (editingVariableKey !== newVarKey.trim()) {
			environmentsStore.removeVariable(environment.id, editingVariableKey);
			environmentsStore.addVariable(environment.id, {
				key: newVarKey.trim(),
				value: newVarValue,
				isSecret: newVarIsSecret,
				description: newVarDescription.trim() || undefined
			});
		} else {
			environmentsStore.updateVariable(environment.id, editingVariableKey, {
				value: newVarIsSecret && !newVarValue ? environment.variables.find(v => v.key === editingVariableKey)?.value : newVarValue,
				isSecret: newVarIsSecret,
				description: newVarDescription.trim() || undefined
			});
		}

		resetVariableForm();
	}

	function handleDeleteVariable(key: string) {
		if (!environment) return;
		if (confirm(`Are you sure you want to delete the variable "${key}"?`)) {
			environmentsStore.removeVariable(environment.id, key);
		}
	}

	function toggleSpaceSelection(spaceId: string) {
		const newSet = new Set(selectedSpaceIds);
		if (newSet.has(spaceId)) {
			newSet.delete(spaceId);
		} else {
			newSet.add(spaceId);
		}
		selectedSpaceIds = newSet;
	}

	function saveSpaceAssignments() {
		if (!environment) return;

		// Remove spaces no longer selected
		for (const spaceId of environment.spaceIds) {
			if (!selectedSpaceIds.has(spaceId)) {
				environmentsStore.unassignSpace(environment.id, spaceId);
			}
		}

		// Add newly selected spaces
		for (const spaceId of selectedSpaceIds) {
			if (!environment.spaceIds.includes(spaceId)) {
				environmentsStore.assignSpace(environment.id, spaceId);
			}
		}

		showSpaceSelector = false;
	}

	function openSpaceSelector() {
		if (environment) {
			selectedSpaceIds = new Set(environment.spaceIds);
		}
		showSpaceSelector = true;
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
			environment = envs.find(e => e.id === envId) || null;
			if (environment) {
				selectedSpaceIds = new Set(environment.spaceIds);
			}
		});

		const unsubWf = workflowsStore.subscribe(wfs => {
			workflows = wfs;
		});

		loadSpaces().finally(() => {
			isLoading = false;
		});

		return () => {
			unsubEnv();
			unsubWf();
		};
	});

	function getSpaceName(spaceId: string): string {
		return spaces.find(s => s.id === spaceId)?.name || spaceId;
	}
</script>

<AppHeader onLogout={handleLogout} />

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<div class="max-w-5xl mx-auto px-4 py-8">
		<!-- Back Button -->
		<button
			type="button"
			onclick={() => goto(`${base}/environments`)}
			class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Environments
		</button>

		{#if isLoading}
			<div class="flex items-center justify-center h-64">
				<div class="text-center">
					<div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-4"></div>
					<p class="text-sm text-gray-600 dark:text-gray-400">Loading environment...</p>
				</div>
			</div>
		{:else if !environment}
			<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
				<svg class="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">Environment not found</h3>
				<p class="mt-2 text-gray-500 dark:text-gray-400">The environment you're looking for doesn't exist.</p>
				<button
					type="button"
					onclick={() => goto(`${base}/environments`)}
					class="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
				>
					Go to Environments
				</button>
			</div>
		{:else}
			<!-- Header -->
			<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
				<div class="h-3" style="background-color: {environment.color}"></div>
				<div class="p-6">
					<div class="flex items-start justify-between">
						<div>
							<div class="flex items-center gap-3">
								<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{environment.name}</h1>
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
									{environment.purpose === 'production' 
										? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
										: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}">
									{environment.purpose === 'production' ? 'Production' : 'Authoring'}
								</span>
							</div>
							{#if environment.description}
								<p class="mt-2 text-gray-600 dark:text-gray-400">{environment.description}</p>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Variables Section -->
			<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
				<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Environment Variables</h2>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Configure variables that resources in this environment can access</p>
					</div>
					<button
						type="button"
						onclick={() => { resetVariableForm(); showAddVariable = true; }}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Add Variable
					</button>
				</div>

				{#if environment.variables.length === 0 && !showAddVariable}
					<div class="p-8 text-center">
						<svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0" />
						</svg>
						<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">No variables configured</p>
					</div>
				{:else}
					<div class="divide-y divide-gray-200 dark:divide-gray-700">
						{#each environment.variables as variable (variable.key)}
							<div class="px-6 py-4 flex items-center justify-between">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<code class="text-sm font-mono font-medium text-gray-900 dark:text-white">{variable.key}</code>
										{#if variable.isSecret}
											<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
												<svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
												</svg>
												Secret
											</span>
										{/if}
									</div>
									{#if variable.description}
										<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{variable.description}</p>
									{/if}
									<p class="mt-1 text-sm font-mono text-gray-600 dark:text-gray-400">
										{variable.isSecret ? '••••••••' : variable.value}
									</p>
								</div>
								<div class="flex items-center gap-2 ml-4">
									<button
										type="button"
										onclick={() => handleEditVariable(variable)}
										class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
										</svg>
									</button>
									<button
										type="button"
										onclick={() => handleDeleteVariable(variable.key)}
										class="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Add/Edit Variable Form -->
				{#if showAddVariable}
					<div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
						<h3 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
							{editingVariableKey ? 'Edit Variable' : 'Add New Variable'}
						</h3>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="var-key" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
								<input
									id="var-key"
									type="text"
									bind:value={newVarKey}
									placeholder="VARIABLE_NAME"
									class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
								/>
							</div>
							<div>
								<label for="var-value" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
								<input
									id="var-value"
									type={newVarIsSecret ? 'password' : 'text'}
									bind:value={newVarValue}
									placeholder={newVarIsSecret && editingVariableKey ? '(unchanged)' : 'value'}
									class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
								/>
							</div>
							<div class="col-span-2">
								<label for="var-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
								<input
									id="var-description"
									type="text"
									bind:value={newVarDescription}
									placeholder="What is this variable used for?"
									class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								/>
							</div>
							<div class="col-span-2 flex items-center gap-2">
								<input
									id="var-secret"
									type="checkbox"
									bind:checked={newVarIsSecret}
									class="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
								/>
								<label for="var-secret" class="text-sm text-gray-700 dark:text-gray-300">
									This is a secret value (will be hidden)
								</label>
							</div>
						</div>
						<div class="mt-4 flex justify-end gap-2">
							<button
								type="button"
								onclick={resetVariableForm}
								class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
							>
								Cancel
							</button>
							<button
								type="button"
								onclick={editingVariableKey ? handleUpdateVariable : handleAddVariable}
								disabled={!newVarKey.trim()}
								class="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded-lg"
							>
								{editingVariableKey ? 'Update' : 'Add'} Variable
							</button>
						</div>
					</div>
				{/if}
			</div>

			<!-- Assigned Spaces Section -->
			<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
				<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Assigned Spaces</h2>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Spaces that belong to this environment</p>
					</div>
					<button
						type="button"
						onclick={openSpaceSelector}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
						</svg>
						Manage Spaces
					</button>
				</div>

				{#if environment.spaceIds.length === 0}
					<div class="p-8 text-center">
						<svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
						</svg>
						<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">No spaces assigned to this environment</p>
					</div>
				{:else}
					<div class="p-6">
						<div class="flex flex-wrap gap-2">
							{#each environment.spaceIds as spaceId}
								<div class="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
									<svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
									</svg>
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300">{getSpaceName(spaceId)}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Space Selector Modal -->
{#if showSpaceSelector}
	<div class="fixed inset-0 z-50 overflow-y-auto">
		<div class="flex min-h-full items-center justify-center p-4">
			<div class="fixed inset-0 bg-black/50 z-40" onclick={() => showSpaceSelector = false}></div>
			
			<div class="relative z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full p-6">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Assign Spaces</h2>
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
					Select the spaces that should be part of this environment
				</p>
				
				<div class="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
					{#each spaces as space}
						<label class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
							<input
								type="checkbox"
								checked={selectedSpaceIds.has(space.id)}
								onchange={() => toggleSpaceSelection(space.id)}
								class="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
							/>
							<div class="flex-1 min-w-0">
								<div class="font-medium text-gray-900 dark:text-white">{space.name}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400 font-mono">{space.id}</div>
							</div>
						</label>
					{/each}
					{#if spaces.length === 0}
						<div class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
							No spaces available
						</div>
					{/if}
				</div>
				
				<div class="mt-4 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => showSpaceSelector = false}
						class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={saveSpaceAssignments}
						class="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
					>
						Save Changes
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

