<script lang="ts">
	interface Props {
		isOpen: boolean;
		initialSection?: string;
		onClose: () => void;
	}

	// Delay before scrolling to ensure modal content is fully rendered
	const SCROLL_DELAY_MS = 100;

	let { isOpen, initialSection, onClose }: Props = $props();

	let activeSection = $state<string>('overview');

	$effect(() => {
		if (isOpen && initialSection) {
			activeSection = initialSection;
			// Scroll to section after a brief delay to ensure modal is rendered
			setTimeout(() => {
				const element = document.getElementById(initialSection);
				if (element) {
					element.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}, SCROLL_DELAY_MS);
		}
	});

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function scrollToSection(sectionId: string) {
		activeSection = sectionId;
		const element = document.getElementById(sectionId);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<div 
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
	>
		<!-- Modal -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 id="modal-title" class="text-lg font-semibold text-gray-900 dark:text-white">
					Help & Information
				</h2>
				<button
					onclick={onClose}
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
					aria-label="Close"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-auto">
				<div class="flex">
					<!-- Sidebar Navigation -->
					<nav class="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 flex-shrink-0">
						<ul class="space-y-1">
							<li>
								<button
									onclick={() => scrollToSection('overview')}
									class="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors {activeSection === 'overview' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
								>
									How It Works
								</button>
							</li>
							<li>
								<button
									onclick={() => scrollToSection('data-storage')}
									class="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors {activeSection === 'data-storage' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
								>
									Data & Privacy
								</button>
							</li>
						</ul>
					</nav>

					<!-- Main Content -->
					<div class="flex-1 p-6">
						<!-- Overview Section -->
						<section id="overview" class="mb-8">
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">How QCS Environments Works</h3>
							<div class="prose prose-sm dark:prose-invert max-w-none">
								<p class="text-gray-700 dark:text-gray-300 mb-4">
									QCS Environments is a tool for browsing and organizing your Qlik Cloud resources. It provides a visual catalog of all your apps, automations, datasets, and other resources across different spaces.
								</p>
								
								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Key Features</h4>
								<ul class="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mb-4">
									<li><strong>Resource Catalog:</strong> View all your Qlik resources in a tile-based interface</li>
									<li><strong>Space Filtering:</strong> Filter resources by Personal, Shared, or Managed spaces</li>
									<li><strong>Search:</strong> Quickly find resources by name</li>
									<li><strong>Quick Access:</strong> Click any resource tile to open it directly in Qlik Cloud</li>
								</ul>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Getting Started</h4>
								<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
									<p class="text-sm text-gray-700 dark:text-gray-300">
										<strong>Note:</strong> The first time this application is used on a tenant, a Tenant Administrator will need to authorize the application.
									</p>
								</div>
								<ol class="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 mb-4">
									<li>Enter your Qlik Cloud tenant URL (e.g., <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">your-tenant.us.qlikcloud.com</code>)</li>
									<li>Sign in with your Qlik Cloud credentials</li>
									<li>Browse your apps in the catalog</li>
									<li>Click any app to open it in Qlik Cloud</li>
								</ol>
							</div>
						</section>

						<!-- Data Storage Section -->
						<section id="data-storage" class="mb-8">
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Data & Privacy</h3>
							<div class="prose prose-sm dark:prose-invert max-w-none">
								<p class="text-gray-700 dark:text-gray-300 mb-4">
									QCS Environments is designed with privacy in mind. Here's what you should know:
								</p>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Privacy & Security</h4>
								<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
									<ul class="space-y-2 text-gray-700 dark:text-gray-300">
										<li>✓ <strong>No external servers</strong> - Data flows only between your browser and Qlik Cloud</li>
										<li>✓ <strong>Local storage</strong> - Session data is stored locally in your browser</li>
										<li>✓ <strong>OAuth authentication</strong> - Secure authentication via Qlik Cloud</li>
										<li>✓ <strong>Full control</strong> - Log out at any time to clear your session</li>
									</ul>
								</div>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">What Data Is Used</h4>
								<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
									<ul class="space-y-3 text-gray-700 dark:text-gray-300">
										<li class="flex items-start">
											<svg class="w-5 h-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
											</svg>
											<div>
												<strong>App List:</strong> Names, IDs, and space assignments of your apps
											</div>
										</li>
										<li class="flex items-start">
											<svg class="w-5 h-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
											</svg>
											<div>
												<strong>Spaces:</strong> Names and IDs of your Qlik Cloud spaces
											</div>
										</li>
										<li class="flex items-start">
											<svg class="w-5 h-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
											</svg>
											<div>
												<strong>User Info:</strong> Your Qlik Cloud user profile for display purposes
											</div>
										</li>
									</ul>
								</div>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Clearing Your Session</h4>
								<p class="text-gray-700 dark:text-gray-300 mb-4">
									To clear your session data, simply click <strong>"Log out"</strong> from the profile menu in the top right corner. This will clear your authentication tokens and session data.
								</p>
							</div>
						</section>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
