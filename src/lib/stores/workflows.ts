/**
 * Workflows store for managing promotion workflows
 */
import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { Workflow, WorkflowStage } from '$lib/types';
import { generateId } from '$lib/types';

const STORAGE_KEY = 'qcs-env-workflows';

// Mock data for demonstration
const MOCK_WORKFLOWS: Workflow[] = [
	{
		id: 'workflow-main',
		name: 'Standard Promotion',
		description: 'Standard workflow: Development → Staging → Production. All changes must be validated in staging before production deployment.',
		stages: [
			{
				environmentId: 'env-dev',
				order: 0,
				requiresApproval: false
			},
			{
				environmentId: 'env-stage',
				order: 1,
				requiresApproval: true,
				approverRoles: ['Developer', 'Lead Developer'],
				requiresAllTestsPassing: true
			},
			{
				environmentId: 'env-prod',
				order: 2,
				requiresApproval: true,
				approverRoles: ['Lead Developer', 'Manager'],
				requiresAllTestsPassing: true
			}
		],
		createdAt: '2024-01-15T10:00:00Z',
		updatedAt: '2024-01-20T14:30:00Z'
	},
	{
		id: 'workflow-hotfix',
		name: 'Hotfix',
		description: 'Emergency workflow for critical fixes: Development → Production (bypasses staging)',
		stages: [
			{
				environmentId: 'env-dev',
				order: 0,
				requiresApproval: false
			},
			{
				environmentId: 'env-prod',
				order: 1,
				requiresApproval: true,
				approverRoles: ['Manager'],
				requiresAllTestsPassing: false
			}
		],
		createdAt: '2024-01-15T10:00:00Z',
		updatedAt: '2024-01-20T14:30:00Z'
	}
];

function createWorkflowsStore() {
	// Load from localStorage or use mock data
	let initialData: Workflow[] = MOCK_WORKFLOWS;
	
	if (browser) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				initialData = JSON.parse(stored);
			}
		} catch (e) {
			console.warn('Failed to load workflows from localStorage:', e);
		}
	}
	
	const { subscribe, set, update } = writable<Workflow[]>(initialData);
	
	// Persist to localStorage on changes
	if (browser) {
		subscribe(workflows => {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
			} catch (e) {
				console.warn('Failed to save workflows to localStorage:', e);
			}
		});
	}
	
	return {
		subscribe,
		
		// Get a single workflow by ID
		getById: (id: string): Workflow | undefined => {
			return get({ subscribe }).find(wf => wf.id === id);
		},
		
		// Create a new workflow
		create: (data: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Workflow => {
			const now = new Date().toISOString();
			const newWorkflow: Workflow = {
				...data,
				id: generateId(),
				createdAt: now,
				updatedAt: now
			};
			
			update(workflows => [...workflows, newWorkflow]);
			return newWorkflow;
		},
		
		// Update a workflow
		update: (id: string, data: Partial<Omit<Workflow, 'id' | 'createdAt'>>): void => {
			update(workflows => workflows.map(wf => {
				if (wf.id === id) {
					return { ...wf, ...data, updatedAt: new Date().toISOString() };
				}
				return wf;
			}));
		},
		
		// Delete a workflow
		delete: (id: string): void => {
			update(workflows => workflows.filter(wf => wf.id !== id));
		},
		
		// Add a stage to a workflow
		addStage: (workflowId: string, stage: WorkflowStage): void => {
			update(workflows => workflows.map(wf => {
				if (wf.id === workflowId) {
					const stages = [...wf.stages, stage].sort((a, b) => a.order - b.order);
					return { ...wf, stages, updatedAt: new Date().toISOString() };
				}
				return wf;
			}));
		},
		
		// Update a stage in a workflow
		updateStage: (workflowId: string, environmentId: string, stageData: Partial<WorkflowStage>): void => {
			update(workflows => workflows.map(wf => {
				if (wf.id === workflowId) {
					const stages = wf.stages.map(stage => 
						stage.environmentId === environmentId ? { ...stage, ...stageData } : stage
					);
					return { ...wf, stages, updatedAt: new Date().toISOString() };
				}
				return wf;
			}));
		},
		
		// Remove a stage from a workflow
		removeStage: (workflowId: string, environmentId: string): void => {
			update(workflows => workflows.map(wf => {
				if (wf.id === workflowId) {
					const stages = wf.stages.filter(stage => stage.environmentId !== environmentId);
					// Re-order remaining stages
					stages.forEach((stage, index) => {
						stage.order = index;
					});
					return { ...wf, stages, updatedAt: new Date().toISOString() };
				}
				return wf;
			}));
		},
		
		// Reorder stages in a workflow
		reorderStages: (workflowId: string, newOrder: string[]): void => {
			update(workflows => workflows.map(wf => {
				if (wf.id === workflowId) {
					const stages = newOrder.map((envId, index) => {
						const existingStage = wf.stages.find(s => s.environmentId === envId);
						return existingStage ? { ...existingStage, order: index } : { environmentId: envId, order: index };
					});
					return { ...wf, stages, updatedAt: new Date().toISOString() };
				}
				return wf;
			}));
		},
		
		// Get the next environment in a workflow
		getNextEnvironment: (workflowId: string, currentEnvironmentId: string): string | null => {
			const workflow = get({ subscribe }).find(wf => wf.id === workflowId);
			if (!workflow) return null;
			
			const currentStage = workflow.stages.find(s => s.environmentId === currentEnvironmentId);
			if (!currentStage) return null;
			
			const nextStage = workflow.stages.find(s => s.order === currentStage.order + 1);
			return nextStage?.environmentId ?? null;
		},
		
		// Get the previous environment in a workflow
		getPreviousEnvironment: (workflowId: string, currentEnvironmentId: string): string | null => {
			const workflow = get({ subscribe }).find(wf => wf.id === workflowId);
			if (!workflow) return null;
			
			const currentStage = workflow.stages.find(s => s.environmentId === currentEnvironmentId);
			if (!currentStage || currentStage.order === 0) return null;
			
			const prevStage = workflow.stages.find(s => s.order === currentStage.order - 1);
			return prevStage?.environmentId ?? null;
		},
		
		// Check if promotion is allowed from one environment to another
		canPromote: (workflowId: string, fromEnvironmentId: string, toEnvironmentId: string): boolean => {
			const workflow = get({ subscribe }).find(wf => wf.id === workflowId);
			if (!workflow) return false;
			
			const fromStage = workflow.stages.find(s => s.environmentId === fromEnvironmentId);
			const toStage = workflow.stages.find(s => s.environmentId === toEnvironmentId);
			
			if (!fromStage || !toStage) return false;
			
			// Can only promote to the next stage
			return toStage.order === fromStage.order + 1;
		},
		
		// Reset to mock data
		reset: (): void => {
			set(MOCK_WORKFLOWS);
		}
	};
}

export const workflowsStore = createWorkflowsStore();

// Derived store for workflow names (for dropdowns)
export const workflowOptions = derived(
	workflowsStore,
	$workflows => $workflows.map(wf => ({ id: wf.id, name: wf.name }))
);

