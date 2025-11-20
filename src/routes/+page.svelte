<script>
  import Logo from './Logo.svelte';
  import Search from '$lib/components/Search.svelte';
</script>


<header class="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between items-center h-16">
			<!-- Logo and Navigation -->
			<div class="flex items-center">
				<div class="flex-shrink-0 relative">
					<div class="flex items-center">
						<Logo />
						<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Analytics Notebook</h1>
					</div>
					<div style="display: contents">
						
					</div>
				</div>
			</div>
		</div>
	</div>
</header>

<!-- Main Content -->
<main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
	<!-- Search Component -->
	<Search />
	
	<!-- Template Container -->
	<div id="templateContainer">
		<!-- Templates will be loaded here -->
	</div>
</main>

<!-- Footer -->
<footer class="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
		<div class="flex justify-between items-center">
			<div class="text-sm text-gray-500 dark:text-gray-400">
				<p>Analytics Notebook</p>
			</div>
			<div class="flex items-center space-x-4">
			</div>
		</div>
	</div>
</footer>