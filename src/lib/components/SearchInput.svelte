<script lang="ts">
	interface Props {
		value: string;
		isSearching: boolean;
		onInput: (value: string) => void;
		onClear?: () => void;
		placeholder?: string;
	}

let { value, isSearching, onInput, onClear, placeholder = 'Search loaded app metadata...' }: Props = $props();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		onInput(target.value);
	}
</script>

<div class="flex-shrink-0 mb-6">
	<div class="relative">
		<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
			<svg
				class="h-5 w-5 text-gray-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
		</div>
		<input
			type="text"
			value={value}
			oninput={handleInput}
			{placeholder}
			class="block w-full pl-10 pr-11 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		/>
		{#if isSearching}
			<div class="absolute inset-y-0 right-0 pr-7 flex items-center">
				<svg
					class="animate-spin h-5 w-5 text-gray-400"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					/>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
			</div>
		{/if}
		{#if value && value.length > 0}
			<button
				type="button"
				onclick={() => onClear ? onClear() : onInput('')}
				class="absolute inset-y-0 right-0 pr-2 flex items-center p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 group"
				title="Clear search"
				aria-label="Clear search"
			>
				<svg
					class="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>
</div>

