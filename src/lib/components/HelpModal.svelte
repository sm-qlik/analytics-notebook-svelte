<script lang="ts">
	interface Props {
		isOpen: boolean;
		initialSection?: string;
		onClose: () => void;
	}

	let { isOpen, initialSection, onClose }: Props = $props();

	let activeSection = $state<string>(initialSection || 'overview');

	$effect(() => {
		if (isOpen && initialSection) {
			activeSection = initialSection;
			// Scroll to section after a brief delay to ensure modal is rendered
			setTimeout(() => {
				const element = document.getElementById(initialSection);
				if (element) {
					element.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}, 100);
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
									class="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors {activeSection === 'overview' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
								>
									How It Works
								</button>
							</li>
							<li>
								<button
									onclick={() => scrollToSection('data-storage')}
									class="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors {activeSection === 'data-storage' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
								>
									Data Storage
								</button>
							</li>
							<li>
								<button
									onclick={() => scrollToSection('clearing-data')}
									class="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors {activeSection === 'clearing-data' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
								>
									Clearing Data
								</button>
							</li>
						</ul>
					</nav>

					<!-- Main Content -->
					<div class="flex-1 p-6">
						<!-- Overview Section -->
						<section id="overview" class="mb-8">
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">How Analytics Notebook Works</h3>
							<div class="prose prose-sm dark:prose-invert max-w-none">
								<p class="text-gray-700 dark:text-gray-300 mb-4">
									Analytics Notebook is a search and discovery tool for Qlik Cloud Analytics applications. It helps you quickly find charts, visualizations, and data objects across all your Analytics apps.
								</p>
								
								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Key Features</h4>
								<ul class="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mb-4">
									<li><strong>Search:</strong> Search across all apps, sheets, and objects in your Qlik Cloud tenant</li>
									<li><strong>Filtering:</strong> Filter results by space, app, sheet, or object type</li>
									<li><strong>Quick Access:</strong> Click any result to open it directly in Qlik Cloud</li>
									<li><strong>Deprecated Chart Finder:</strong> Identify charts using deprecated visualization types</li>
								</ul>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Getting Started</h4>
								<ol class="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 mb-4">
									<li>Enter your Qlik Cloud tenant URL (e.g., <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">your-tenant.us.qlikcloud.com</code>)</li>
									<li>Sign in with your Qlik Cloud credentials</li>
									<li>Wait for the app to index your apps (this happens automatically on first use)</li>
									<li>Start searching and exploring your Qlik content</li>
								</ol>
							</div>
						</section>

						<!-- Data Storage Section -->
						<section id="data-storage" class="mb-8">
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">What Data Is Stored Locally</h3>
							<div class="prose prose-sm dark:prose-invert max-w-none">
								<p class="text-gray-700 dark:text-gray-300 mb-4">
									To provide fast search and browsing, Analytics Notebook stores data locally in your browser using <strong>IndexedDB</strong>, a modern browser storage API designed for large amounts of structured data.
								</p>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Stored Information</h4>
								<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
									<ul class="space-y-3 text-gray-700 dark:text-gray-300">
										<li class="flex items-start">
											<svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
											</svg>
											<div>
												<strong>App Structure Data:</strong> Full structure and metadata for each Qlik app you've accessed
											</div>
										</li>
										<li class="flex items-start">
											<svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
											</svg>
											<div>
												<strong>Search Index:</strong> A searchable index of all charts, objects, and their properties for fast searching
											</div>
										</li>
										<li class="flex items-start">
											<svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											<div>
												<strong>Sync Metadata:</strong> Information about when data was last synchronized with Qlik Cloud
											</div>
										</li>
									</ul>
								</div>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">How Data Is Organized</h4>
								<p class="text-gray-700 dark:text-gray-300 mb-4">
									Data is organized by tenant URL and user ID, allowing the app to support multiple Qlik Cloud tenants and users on the same device. Each tenant/user combination has its own isolated cache.
								</p>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Privacy & Security</h4>
								<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
									<ul class="space-y-2 text-gray-700 dark:text-gray-300">
										<li>✓ All data is stored <strong>locally in your browser</strong> - it never leaves your device</li>
										<li>✓ No data is sent to external servers except your Qlik Cloud tenant</li>
										<li>✓ Data is isolated per tenant and user</li>
										<li>✓ You have full control - you can clear data at any time</li>
									</ul>
								</div>
							</div>
						</section>

						<!-- Clearing Data Section -->
						<section id="clearing-data" class="mb-8">
							<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">How to Clear Your Data</h3>
							<div class="prose prose-sm dark:prose-invert max-w-none">
								<p class="text-gray-700 dark:text-gray-300 mb-4">
									You can clear your locally stored data at any time. Here are the different ways to do it:
								</p>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Option 1: Manage Data Modal</h4>
								<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
									<ol class="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
										<li>Click on your profile tile in the top right corner</li>
										<li>Select <strong>"Manage data"</strong> from the dropdown menu</li>
										<li>In the modal, you'll see all cached tenants and users</li>
										<li>Click the delete icon (🗑️) next to any tenant to remove its cached data</li>
									</ol>
								</div>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Option 2: Log Out and Clear Data</h4>
								<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
									<ol class="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
										<li>Click on your profile tile in the top right corner</li>
										<li>Select <strong>"Log out and clear local data"</strong> from the dropdown menu</li>
										<li>This will clear all cached data for your current tenant and then log you out</li>
									</ol>
								</div>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Option 3: From Login Page</h4>
								<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
									<ol class="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
										<li>On the login page, click <strong>"Manage Data"</strong> in the top right corner</li>
										<li>This opens the same data management modal, allowing you to clear data without logging in</li>
									</ol>
								</div>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">What Happens When You Clear Data?</h4>
								<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
									<p class="text-gray-700 dark:text-gray-300 mb-2">
										When you clear cached data:
									</p>
									<ul class="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
										<li>All app structure data is removed</li>
										<li>The search index is cleared</li>
										<li>Sync metadata is deleted</li>
										<li>The next time you access that tenant, the app will re-index all apps (this may take a few minutes)</li>
									</ul>
								</div>

								<h4 class="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Browser-Level Clearing</h4>
								<p class="text-gray-700 dark:text-gray-300 mb-4">
									You can also clear all IndexedDB data through your browser's developer tools or settings:
								</p>
								<ul class="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mb-4">
									<li><strong>Chrome/Edge:</strong> Settings → Privacy and security → Site settings → Storage → Clear data</li>
									<li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data → Clear Data</li>
									<li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data → Remove All</li>
								</ul>
							</div>
						</section>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

