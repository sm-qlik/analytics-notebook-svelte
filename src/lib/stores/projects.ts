/**
 * Projects store for managing deployment projects
 */
import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { 
	Project, 
	ProjectResource, 
	Commit, 
	CommitResourceSnapshot, 
	PromotionRecord,
	ProjectVersionState,
	EnvironmentVersion,
	Dependency
} from '$lib/types';
import { generateId, generateCommitHash } from '$lib/types';

const PROJECTS_STORAGE_KEY = 'qcs-env-projects';
const COMMITS_STORAGE_KEY = 'qcs-env-commits';
const DEPENDENCIES_STORAGE_KEY = 'qcs-env-dependencies';

// Mock dependencies demonstrating relationships between resources
const MOCK_DEPENDENCIES: Dependency[] = [
	{
		id: 'dep-1',
		sourceResourceId: 'auto-001',
		targetResourceId: 'app-001',
		dependencyType: 'references',
		sourceResourceName: 'Daily Refresh Automation',
		targetResourceName: 'Finance Dashboard',
		sourceResourceType: 'automation',
		targetResourceType: 'app',
		meta: {
			connectionType: 'API call'
		}
	},
	{
		id: 'dep-2',
		sourceResourceId: 'app-001',
		targetResourceId: 'auto-001',
		dependencyType: 'triggered-by',
		sourceResourceName: 'Finance Dashboard',
		targetResourceName: 'Daily Refresh Automation',
		sourceResourceType: 'app',
		targetResourceType: 'automation',
		meta: {
			objectId: 'btn-refresh',
			objectName: 'Refresh Data Button'
		}
	},
	{
		id: 'dep-3',
		sourceResourceId: 'app-001',
		targetResourceId: 'dataset-001',
		dependencyType: 'uses-data-from',
		sourceResourceName: 'Finance Dashboard',
		targetResourceName: 'Financial Data',
		sourceResourceType: 'app',
		targetResourceType: 'dataset',
		meta: {
			connectionType: 'Data connection'
		}
	},
	{
		id: 'dep-4',
		sourceResourceId: 'app-002',
		targetResourceId: 'dataset-002',
		dependencyType: 'uses-data-from',
		sourceResourceName: 'Sales Analytics',
		targetResourceName: 'Sales Data',
		sourceResourceType: 'app',
		targetResourceType: 'dataset'
	},
	{
		id: 'dep-5',
		sourceResourceId: 'auto-002',
		targetResourceId: 'app-002',
		dependencyType: 'references',
		sourceResourceName: 'Sales Report Generator',
		targetResourceName: 'Sales Analytics',
		sourceResourceType: 'automation',
		targetResourceType: 'app'
	}
];

// Mock projects for demonstration
const MOCK_PROJECTS: Project[] = [
	{
		id: 'proj-finance',
		name: 'Finance Reporting Suite',
		description: 'Complete finance reporting solution including dashboards, data pipelines, and automated reports',
		workflowId: 'workflow-main',
		resources: [
			{
				resourceId: 'app-001',
				resourceType: 'app',
				name: 'Finance Dashboard',
				environmentResourceIds: {
					'env-dev': 'app-001-dev',
					'env-stage': 'app-001-stage',
					'env-prod': 'app-001-prod'
				}
			},
			{
				resourceId: 'auto-001',
				resourceType: 'automation',
				name: 'Daily Refresh Automation',
				environmentResourceIds: {
					'env-dev': 'auto-001-dev',
					'env-stage': 'auto-001-stage',
					'env-prod': 'auto-001-prod'
				}
			},
			{
				resourceId: 'dataset-001',
				resourceType: 'dataset',
				name: 'Financial Data',
				environmentResourceIds: {
					'env-dev': 'dataset-001-dev',
					'env-stage': 'dataset-001-stage',
					'env-prod': 'dataset-001-prod'
				}
			}
		],
		createdAt: '2024-01-15T10:00:00Z',
		updatedAt: '2024-01-20T14:30:00Z'
	},
	{
		id: 'proj-sales',
		name: 'Sales Analytics Platform',
		description: 'Sales performance tracking and reporting platform',
		workflowId: 'workflow-main',
		resources: [
			{
				resourceId: 'app-002',
				resourceType: 'app',
				name: 'Sales Analytics',
				environmentResourceIds: {
					'env-dev': 'app-002-dev',
					'env-stage': 'app-002-stage'
				}
			},
			{
				resourceId: 'auto-002',
				resourceType: 'automation',
				name: 'Sales Report Generator',
				environmentResourceIds: {
					'env-dev': 'auto-002-dev',
					'env-stage': 'auto-002-stage'
				}
			},
			{
				resourceId: 'dataset-002',
				resourceType: 'dataset',
				name: 'Sales Data',
				environmentResourceIds: {
					'env-dev': 'dataset-002-dev',
					'env-stage': 'dataset-002-stage'
				}
			}
		],
		createdAt: '2024-02-01T10:00:00Z',
		updatedAt: '2024-02-10T14:30:00Z'
	}
];

// Mock commits for demonstration
const MOCK_COMMITS: Commit[] = [
	{
		id: 'commit-1',
		hash: 'a1b2c3d',
		projectId: 'proj-finance',
		summary: 'Initial setup of Finance Dashboard',
		description: 'Created the main finance dashboard with KPI visualizations and configured data connections.',
		resources: [
			{ resourceId: 'app-001', resourceType: 'app', name: 'Finance Dashboard', checksum: 'abc123' },
			{ resourceId: 'dataset-001', resourceType: 'dataset', name: 'Financial Data', checksum: 'def456' }
		],
		status: 'promoted',
		currentEnvironmentId: 'env-prod',
		promotionHistory: [
			{ fromEnvironmentId: 'env-dev', toEnvironmentId: 'env-stage', promotedAt: '2024-01-16T10:00:00Z', promotedBy: 'John Developer' },
			{ fromEnvironmentId: 'env-stage', toEnvironmentId: 'env-prod', promotedAt: '2024-01-18T10:00:00Z', promotedBy: 'Jane Manager' }
		],
		createdBy: 'John Developer',
		createdAt: '2024-01-15T10:00:00Z'
	},
	{
		id: 'commit-2',
		hash: 'e5f6g7h',
		projectId: 'proj-finance',
		summary: 'Added automation for daily refresh',
		description: 'Implemented automated data refresh that runs every morning at 6 AM.\n\n- Added error handling\n- Configured email notifications on failure',
		resources: [
			{ resourceId: 'app-001', resourceType: 'app', name: 'Finance Dashboard', checksum: 'abc124' },
			{ resourceId: 'auto-001', resourceType: 'automation', name: 'Daily Refresh Automation', checksum: 'ghi789' },
			{ resourceId: 'dataset-001', resourceType: 'dataset', name: 'Financial Data', checksum: 'def456' }
		],
		status: 'promoted',
		currentEnvironmentId: 'env-stage',
		promotionHistory: [
			{ fromEnvironmentId: 'env-dev', toEnvironmentId: 'env-stage', promotedAt: '2024-01-20T10:00:00Z', promotedBy: 'John Developer' }
		],
		createdBy: 'John Developer',
		createdAt: '2024-01-19T15:30:00Z'
	},
	{
		id: 'commit-3',
		hash: 'i8j9k0l',
		projectId: 'proj-finance',
		summary: 'Fixed calculation error in Q4 metrics',
		description: 'Corrected the formula for calculating Q4 revenue growth percentage.',
		resources: [
			{ resourceId: 'app-001', resourceType: 'app', name: 'Finance Dashboard', checksum: 'abc125' },
			{ resourceId: 'auto-001', resourceType: 'automation', name: 'Daily Refresh Automation', checksum: 'ghi789' },
			{ resourceId: 'dataset-001', resourceType: 'dataset', name: 'Financial Data', checksum: 'def456' }
		],
		status: 'committed',
		currentEnvironmentId: 'env-dev',
		promotionHistory: [],
		createdBy: 'Sarah Analyst',
		createdAt: '2024-01-25T09:15:00Z'
	},
	{
		id: 'commit-4',
		hash: 'm1n2o3p',
		projectId: 'proj-sales',
		summary: 'Initial Sales Analytics dashboard',
		description: 'Created sales performance dashboard with regional breakdowns.',
		resources: [
			{ resourceId: 'app-002', resourceType: 'app', name: 'Sales Analytics', checksum: 'xyz123' },
			{ resourceId: 'dataset-002', resourceType: 'dataset', name: 'Sales Data', checksum: 'uvw456' }
		],
		status: 'promoted',
		currentEnvironmentId: 'env-stage',
		promotionHistory: [
			{ fromEnvironmentId: 'env-dev', toEnvironmentId: 'env-stage', promotedAt: '2024-02-05T10:00:00Z', promotedBy: 'Mike Sales' }
		],
		createdBy: 'Mike Sales',
		createdAt: '2024-02-01T10:00:00Z'
	}
];

// ============================================
// Projects Store
// ============================================

function createProjectsStore() {
	let initialData: Project[] = MOCK_PROJECTS;
	
	if (browser) {
		try {
			const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
			if (stored) {
				initialData = JSON.parse(stored);
			}
		} catch (e) {
			console.warn('Failed to load projects from localStorage:', e);
		}
	}
	
	const { subscribe, set, update } = writable<Project[]>(initialData);
	
	if (browser) {
		subscribe(projects => {
			try {
				localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
			} catch (e) {
				console.warn('Failed to save projects to localStorage:', e);
			}
		});
	}
	
	return {
		subscribe,
		
		getById: (id: string): Project | undefined => {
			return get({ subscribe }).find(p => p.id === id);
		},
		
		create: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project => {
			const now = new Date().toISOString();
			const newProject: Project = {
				...data,
				id: generateId(),
				createdAt: now,
				updatedAt: now
			};
			
			update(projects => [...projects, newProject]);
			return newProject;
		},
		
		update: (id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>): void => {
			update(projects => projects.map(p => {
				if (p.id === id) {
					return { ...p, ...data, updatedAt: new Date().toISOString() };
				}
				return p;
			}));
		},
		
		delete: (id: string): void => {
			update(projects => projects.filter(p => p.id !== id));
		},
		
		addResource: (projectId: string, resource: ProjectResource): void => {
			update(projects => projects.map(p => {
				if (p.id === projectId) {
					// Check if resource already exists
					if (p.resources.some(r => r.resourceId === resource.resourceId)) {
						return p;
					}
					return {
						...p,
						resources: [...p.resources, resource],
						updatedAt: new Date().toISOString()
					};
				}
				return p;
			}));
		},
		
		removeResource: (projectId: string, resourceId: string): void => {
			update(projects => projects.map(p => {
				if (p.id === projectId) {
					return {
						...p,
						resources: p.resources.filter(r => r.resourceId !== resourceId),
						updatedAt: new Date().toISOString()
					};
				}
				return p;
			}));
		},
		
		updateResourceMapping: (projectId: string, resourceId: string, environmentId: string, mappedResourceId: string): void => {
			update(projects => projects.map(p => {
				if (p.id === projectId) {
					return {
						...p,
						resources: p.resources.map(r => {
							if (r.resourceId === resourceId) {
								return {
									...r,
									environmentResourceIds: {
										...r.environmentResourceIds,
										[environmentId]: mappedResourceId
									}
								};
							}
							return r;
						}),
						updatedAt: new Date().toISOString()
					};
				}
				return p;
			}));
		},
		
		reset: (): void => {
			set(MOCK_PROJECTS);
		}
	};
}

export const projectsStore = createProjectsStore();

// ============================================
// Commits Store
// ============================================

function createCommitsStore() {
	let initialData: Commit[] = MOCK_COMMITS;
	
	if (browser) {
		try {
			const stored = localStorage.getItem(COMMITS_STORAGE_KEY);
			if (stored) {
				initialData = JSON.parse(stored);
			}
		} catch (e) {
			console.warn('Failed to load commits from localStorage:', e);
		}
	}
	
	const { subscribe, set, update } = writable<Commit[]>(initialData);
	
	if (browser) {
		subscribe(commits => {
			try {
				localStorage.setItem(COMMITS_STORAGE_KEY, JSON.stringify(commits));
			} catch (e) {
				console.warn('Failed to save commits to localStorage:', e);
			}
		});
	}
	
	return {
		subscribe,
		
		getById: (id: string): Commit | undefined => {
			return get({ subscribe }).find(c => c.id === id);
		},
		
		getByHash: (hash: string): Commit | undefined => {
			return get({ subscribe }).find(c => c.hash === hash);
		},
		
		getByProject: (projectId: string): Commit[] => {
			return get({ subscribe })
				.filter(c => c.projectId === projectId)
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		},
		
		getLatestByProject: (projectId: string): Commit | undefined => {
			const projectCommits = get({ subscribe })
				.filter(c => c.projectId === projectId)
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			return projectCommits[0];
		},
		
		getByEnvironment: (projectId: string, environmentId: string): Commit[] => {
			return get({ subscribe })
				.filter(c => c.projectId === projectId && c.currentEnvironmentId === environmentId)
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		},
		
		create: (data: Omit<Commit, 'id' | 'hash' | 'createdAt' | 'status' | 'promotionHistory'>): Commit => {
			const newCommit: Commit = {
				...data,
				id: generateId(),
				hash: generateCommitHash(),
				status: 'committed',
				promotionHistory: [],
				createdAt: new Date().toISOString()
			};
			
			update(commits => [...commits, newCommit]);
			return newCommit;
		},
		
		promote: (commitId: string, toEnvironmentId: string, promotedBy: string, notes?: string): void => {
			update(commits => commits.map(c => {
				if (c.id === commitId) {
					const promotionRecord: PromotionRecord = {
						fromEnvironmentId: c.currentEnvironmentId,
						toEnvironmentId,
						promotedAt: new Date().toISOString(),
						promotedBy,
						notes
					};
					
					return {
						...c,
						status: 'promoted' as const,
						currentEnvironmentId: toEnvironmentId,
						promotionHistory: [...c.promotionHistory, promotionRecord]
					};
				}
				return c;
			}));
		},
		
		reset: (): void => {
			set(MOCK_COMMITS);
		}
	};
}

export const commitsStore = createCommitsStore();

// ============================================
// Dependencies Store
// ============================================

function createDependenciesStore() {
	let initialData: Dependency[] = MOCK_DEPENDENCIES;
	
	if (browser) {
		try {
			const stored = localStorage.getItem(DEPENDENCIES_STORAGE_KEY);
			if (stored) {
				initialData = JSON.parse(stored);
			}
		} catch (e) {
			console.warn('Failed to load dependencies from localStorage:', e);
		}
	}
	
	const { subscribe, set, update } = writable<Dependency[]>(initialData);
	
	if (browser) {
		subscribe(deps => {
			try {
				localStorage.setItem(DEPENDENCIES_STORAGE_KEY, JSON.stringify(deps));
			} catch (e) {
				console.warn('Failed to save dependencies to localStorage:', e);
			}
		});
	}
	
	return {
		subscribe,
		
		// Get all dependencies for a resource (both incoming and outgoing)
		getForResource: (resourceId: string): { dependencies: Dependency[], dependents: Dependency[] } => {
			const all = get({ subscribe });
			return {
				dependencies: all.filter(d => d.sourceResourceId === resourceId),
				dependents: all.filter(d => d.targetResourceId === resourceId)
			};
		},
		
		// Get all dependencies for a set of resources
		getForResources: (resourceIds: string[]): Dependency[] => {
			const idSet = new Set(resourceIds);
			return get({ subscribe }).filter(d => 
				idSet.has(d.sourceResourceId) || idSet.has(d.targetResourceId)
			);
		},
		
		// Get only internal dependencies (both source and target in the set)
		getInternalDependencies: (resourceIds: string[]): Dependency[] => {
			const idSet = new Set(resourceIds);
			return get({ subscribe }).filter(d => 
				idSet.has(d.sourceResourceId) && idSet.has(d.targetResourceId)
			);
		},
		
		// Add a dependency
		add: (dependency: Omit<Dependency, 'id'>): void => {
			const newDep: Dependency = {
				...dependency,
				id: generateId()
			};
			update(deps => [...deps, newDep]);
		},
		
		// Remove a dependency
		remove: (id: string): void => {
			update(deps => deps.filter(d => d.id !== id));
		},
		
		reset: (): void => {
			set(MOCK_DEPENDENCIES);
		}
	};
}

export const dependenciesStore = createDependenciesStore();

// ============================================
// Derived Stores
// ============================================

// Get version state for all projects
export const projectVersionStates = derived(
	[projectsStore, commitsStore],
	([$projects, $commits]) => {
		const states: Record<string, ProjectVersionState> = {};
		
		for (const project of $projects) {
			const projectCommits = $commits.filter(c => c.projectId === project.id);
			const environmentVersions: Record<string, EnvironmentVersion> = {};
			
			// Group commits by current environment and get the latest for each
			const envGroups = new Map<string, Commit[]>();
			for (const commit of projectCommits) {
				if (!envGroups.has(commit.currentEnvironmentId)) {
					envGroups.set(commit.currentEnvironmentId, []);
				}
				envGroups.get(commit.currentEnvironmentId)!.push(commit);
			}
			
			// For each environment, get the most recently promoted commit
			for (const [envId, commits] of envGroups) {
				const sorted = commits.sort((a, b) => {
					// Sort by the most recent promotion to this environment
					const aTime = a.promotionHistory.length > 0 
						? new Date(a.promotionHistory[a.promotionHistory.length - 1].promotedAt).getTime()
						: new Date(a.createdAt).getTime();
					const bTime = b.promotionHistory.length > 0
						? new Date(b.promotionHistory[b.promotionHistory.length - 1].promotedAt).getTime()
						: new Date(b.createdAt).getTime();
					return bTime - aTime;
				});
				
				if (sorted.length > 0) {
					const latestCommit = sorted[0];
					const lastPromotion = latestCommit.promotionHistory[latestCommit.promotionHistory.length - 1];
					
					environmentVersions[envId] = {
						environmentId: envId,
						commitId: latestCommit.id,
						commitHash: latestCommit.hash,
						deployedAt: lastPromotion?.promotedAt || latestCommit.createdAt,
						deployedBy: lastPromotion?.promotedBy || latestCommit.createdBy
					};
				}
			}
			
			states[project.id] = {
				projectId: project.id,
				environmentVersions
			};
		}
		
		return states;
	}
);

