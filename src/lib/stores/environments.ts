/**
 * Environments store for managing QCS environments
 */
import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { Environment, EnvironmentVariable, SpaceEnvironmentMapping } from '$lib/types';
import { generateId } from '$lib/types';

const STORAGE_KEY = 'qcs-env-environments';

// Mock data for demonstration
const MOCK_ENVIRONMENTS: Environment[] = [
	{
		id: 'env-dev',
		name: 'Development',
		description: 'Development environment for building and testing new features',
		purpose: 'authoring',
		color: '#3b82f6', // Blue
		variables: [
			{ key: 'API_ENDPOINT', value: 'https://dev-api.example.com', isSecret: false, description: 'API endpoint URL' },
			{ key: 'DEBUG_MODE', value: 'true', isSecret: false, description: 'Enable debug logging' },
			{ key: 'DB_CONNECTION', value: '********', isSecret: true, description: 'Database connection string' }
		],
		spaceIds: [], // Will be populated when spaces are assigned
		createdAt: '2024-01-15T10:00:00Z',
		updatedAt: '2024-01-20T14:30:00Z'
	},
	{
		id: 'env-stage',
		name: 'Staging',
		description: 'Pre-production environment for UAT and final testing',
		purpose: 'production', // Production type - no authoring happens here
		color: '#f59e0b', // Amber
		variables: [
			{ key: 'API_ENDPOINT', value: 'https://stage-api.example.com', isSecret: false, description: 'API endpoint URL' },
			{ key: 'DEBUG_MODE', value: 'false', isSecret: false, description: 'Enable debug logging' },
			{ key: 'DB_CONNECTION', value: '********', isSecret: true, description: 'Database connection string' }
		],
		spaceIds: [],
		createdAt: '2024-01-15T10:00:00Z',
		updatedAt: '2024-01-20T14:30:00Z'
	},
	{
		id: 'env-prod',
		name: 'Production',
		description: 'Live production environment for end users',
		purpose: 'production',
		color: '#22c55e', // Green
		variables: [
			{ key: 'API_ENDPOINT', value: 'https://api.example.com', isSecret: false, description: 'API endpoint URL' },
			{ key: 'DEBUG_MODE', value: 'false', isSecret: false, description: 'Enable debug logging' },
			{ key: 'DB_CONNECTION', value: '********', isSecret: true, description: 'Database connection string' }
		],
		spaceIds: [],
		createdAt: '2024-01-15T10:00:00Z',
		updatedAt: '2024-01-20T14:30:00Z'
	}
];

function createEnvironmentsStore() {
	// Load from localStorage or use mock data
	let initialData: Environment[] = MOCK_ENVIRONMENTS;
	
	if (browser) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				initialData = JSON.parse(stored);
			}
		} catch (e) {
			console.warn('Failed to load environments from localStorage:', e);
		}
	}
	
	const { subscribe, set, update } = writable<Environment[]>(initialData);
	
	// Persist to localStorage on changes
	if (browser) {
		subscribe(environments => {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(environments));
			} catch (e) {
				console.warn('Failed to save environments to localStorage:', e);
			}
		});
	}
	
	return {
		subscribe,
		
		// Get a single environment by ID
		getById: (id: string): Environment | undefined => {
			return get({ subscribe }).find(env => env.id === id);
		},
		
		// Create a new environment
		create: (data: Omit<Environment, 'id' | 'createdAt' | 'updatedAt'>): Environment => {
			const now = new Date().toISOString();
			const newEnv: Environment = {
				...data,
				id: generateId(),
				createdAt: now,
				updatedAt: now
			};
			
			update(envs => [...envs, newEnv]);
			return newEnv;
		},
		
		// Update an environment
		update: (id: string, data: Partial<Omit<Environment, 'id' | 'createdAt'>>): void => {
			update(envs => envs.map(env => {
				if (env.id === id) {
					return { ...env, ...data, updatedAt: new Date().toISOString() };
				}
				return env;
			}));
		},
		
		// Delete an environment
		delete: (id: string): void => {
			update(envs => envs.filter(env => env.id !== id));
		},
		
		// Add a variable to an environment
		addVariable: (environmentId: string, variable: EnvironmentVariable): void => {
			update(envs => envs.map(env => {
				if (env.id === environmentId) {
					return {
						...env,
						variables: [...env.variables, variable],
						updatedAt: new Date().toISOString()
					};
				}
				return env;
			}));
		},
		
		// Update a variable in an environment
		updateVariable: (environmentId: string, key: string, variable: Partial<EnvironmentVariable>): void => {
			update(envs => envs.map(env => {
				if (env.id === environmentId) {
					return {
						...env,
						variables: env.variables.map(v => v.key === key ? { ...v, ...variable } : v),
						updatedAt: new Date().toISOString()
					};
				}
				return env;
			}));
		},
		
		// Remove a variable from an environment
		removeVariable: (environmentId: string, key: string): void => {
			update(envs => envs.map(env => {
				if (env.id === environmentId) {
					return {
						...env,
						variables: env.variables.filter(v => v.key !== key),
						updatedAt: new Date().toISOString()
					};
				}
				return env;
			}));
		},
		
		// Assign a space to an environment
		assignSpace: (environmentId: string, spaceId: string): void => {
			update(envs => envs.map(env => {
				// Remove space from any existing environment
				const updatedEnv = {
					...env,
					spaceIds: env.spaceIds.filter(id => id !== spaceId),
					updatedAt: new Date().toISOString()
				};
				
				// Add to target environment
				if (env.id === environmentId) {
					return {
						...updatedEnv,
						spaceIds: [...updatedEnv.spaceIds, spaceId]
					};
				}
				return updatedEnv;
			}));
		},
		
		// Unassign a space from an environment
		unassignSpace: (environmentId: string, spaceId: string): void => {
			update(envs => envs.map(env => {
				if (env.id === environmentId) {
					return {
						...env,
						spaceIds: env.spaceIds.filter(id => id !== spaceId),
						updatedAt: new Date().toISOString()
					};
				}
				return env;
			}));
		},
		
		// Get environments by workflow
		getByWorkflow: (workflowId: string): Environment[] => {
			return get({ subscribe })
				.filter(env => env.workflowId === workflowId)
				.sort((a, b) => (a.workflowOrder ?? 0) - (b.workflowOrder ?? 0));
		},
		
		// Reset to mock data
		reset: (): void => {
			set(MOCK_ENVIRONMENTS);
		}
	};
}

export const environmentsStore = createEnvironmentsStore();

// Derived store for space-to-environment mappings
export const spaceEnvironmentMappings = derived(
	environmentsStore,
	$environments => {
		const mappings: SpaceEnvironmentMapping[] = [];
		for (const env of $environments) {
			for (const spaceId of env.spaceIds) {
				mappings.push({
					spaceId,
					spaceName: '', // Will be populated when we have space data
					environmentId: env.id,
					environmentName: env.name
				});
			}
		}
		return mappings;
	}
);

// Derived store for environments grouped by purpose
export const environmentsByPurpose = derived(
	environmentsStore,
	$environments => ({
		authoring: $environments.filter(env => env.purpose === 'authoring'),
		production: $environments.filter(env => env.purpose === 'production')
	})
);

