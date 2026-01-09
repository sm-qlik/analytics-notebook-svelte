/**
 * Core types for QCS Environments
 */

// ============================================
// Resource Types
// ============================================

// All resource types from Qlik Cloud API
// Note: API returns types with subtypes in brackets like "app[script,directQuery,]" or "dataset[qix-df]"
// We normalize these to base types for display
export type ResourceType = 
	| 'sharingservicetask'
	| 'app'
	| 'qvapp'           // QlikView app (converted)
	| 'qlikview'        // QlikView document
	| 'dataset'
	| 'script'
	| 'dataflow'        // Shown as app[dataflow-prep] in API
	| 'tablerecipe'     // Shown as app[single-table-prep] in API
	| 'note'
	| 'genericlink'
	| 'automation'
	| 'automl-deployment'
	| 'automl-experiment'
	| 'glossary'
	| 'assistant'
	| 'knowledgebase'
	| 'dataproduct';

export interface Resource {
	id: string;
	resourceId: string;
	name: string;
	description?: string;
	resourceType: ResourceType;
	spaceId?: string;
	ownerId?: string;
	createdAt: string;
	updatedAt: string;
	thumbnailId?: string;
	// Additional metadata
	meta?: Record<string, any>;
}

export interface ResourceWithDependencies extends Resource {
	dependencies: Dependency[];
	dependents: Dependency[];
}

// ============================================
// Dependency Types
// ============================================

export type DependencyType = 
	| 'references'      // Resource A references Resource B (e.g., automation calls an app)
	| 'uses-data-from'  // Resource A uses data from Resource B
	| 'triggered-by'    // Resource A is triggered by Resource B
	| 'embedded-in'     // Resource A is embedded in Resource B (e.g., chart in mashup)
	| 'extends';        // Resource A extends Resource B

export interface Dependency {
	id: string;
	sourceResourceId: string;
	targetResourceId: string;
	dependencyType: DependencyType;
	// For display purposes
	sourceResourceName?: string;
	targetResourceName?: string;
	sourceResourceType?: ResourceType;
	targetResourceType?: ResourceType;
	// Optional metadata about the dependency
	meta?: {
		objectId?: string;       // e.g., button ID in app that triggers automation
		objectName?: string;     // e.g., button name
		connectionType?: string; // e.g., "data connection", "API call"
	};
}

// ============================================
// Environment Types
// ============================================

export type EnvironmentPurpose = 'authoring' | 'production';

export interface EnvironmentVariable {
	key: string;
	value: string;
	isSecret: boolean;
	description?: string;
}

export interface Environment {
	id: string;
	name: string;
	description?: string;
	purpose: EnvironmentPurpose;
	color: string; // For visual identification (e.g., "#22c55e" for green)
	variables: EnvironmentVariable[];
	spaceIds: string[]; // Spaces assigned to this environment
	workflowId?: string; // The workflow this environment belongs to
	workflowOrder?: number; // Position in the workflow (0 = first, 1 = second, etc.)
	createdAt: string;
	updatedAt: string;
}

export interface SpaceEnvironmentMapping {
	spaceId: string;
	spaceName: string;
	environmentId: string;
	environmentName: string;
}

// ============================================
// Workflow Types
// ============================================

export interface WorkflowStage {
	environmentId: string;
	order: number;
	// Rules for promotion to next stage
	requiresApproval?: boolean;
	approverRoles?: string[];
	requiresAllTestsPassing?: boolean;
}

export interface Workflow {
	id: string;
	name: string;
	description?: string;
	stages: WorkflowStage[];
	createdAt: string;
	updatedAt: string;
}

// ============================================
// Project Types
// ============================================

export interface ProjectResource {
	resourceId: string;
	resourceType: ResourceType;
	name: string;
	// Mapping of IDs across environments (environmentId -> resourceId in that env)
	environmentResourceIds: Record<string, string>;
}

export interface Project {
	id: string;
	name: string;
	description?: string;
	workflowId: string;
	// Spaces assigned to this project - must be from environments in the workflow
	spaceIds: string[];
	resources: ProjectResource[];
	// Optional: Git repository association (for future)
	gitRepository?: {
		url: string;
		branch: string;
		isConnected: boolean;
	};
	createdAt: string;
	updatedAt: string;
}

// ============================================
// Commit Types
// ============================================

export type CommitStatus = 'draft' | 'committed' | 'promoted';

export interface CommitResourceSnapshot {
	resourceId: string;
	resourceType: ResourceType;
	name: string;
	version?: string; // If the resource has versioning
	checksum?: string; // Hash of resource content for change detection
}

export interface Commit {
	id: string;
	hash: string; // Short hash like git (e.g., "a1b2c3d")
	projectId: string;
	summary: string;
	description?: string;
	resources: CommitResourceSnapshot[];
	status: CommitStatus;
	// Which environment this commit is currently in
	currentEnvironmentId: string;
	// History of promotions
	promotionHistory: PromotionRecord[];
	createdBy: string;
	createdAt: string;
}

export interface PromotionRecord {
	fromEnvironmentId: string;
	toEnvironmentId: string;
	promotedAt: string;
	promotedBy: string;
	notes?: string;
}

// ============================================
// Version Tracking Types
// ============================================

export interface EnvironmentVersion {
	environmentId: string;
	commitId: string;
	commitHash: string;
	deployedAt: string;
	deployedBy: string;
}

export interface ProjectVersionState {
	projectId: string;
	// Current version in each environment
	environmentVersions: Record<string, EnvironmentVersion>;
}

// ============================================
// UI/Display Types
// ============================================

export interface ResourceTypeInfo {
	type: ResourceType;
	label: string;
	pluralLabel: string;
	icon: string; // SVG path or icon name
	color: string; // Tailwind color class
}

export const RESOURCE_TYPE_INFO: Record<ResourceType, ResourceTypeInfo> = {
	'sharingservicetask': {
		type: 'sharingservicetask',
		label: 'Sharing Task',
		pluralLabel: 'Sharing Tasks',
		icon: 'share',
		color: 'gray'
	},
	'app': {
		type: 'app',
		label: 'Application',
		pluralLabel: 'Applications',
		icon: 'chart-bar',
		color: 'green'
	},
	'qvapp': {
		type: 'qvapp',
		label: 'QlikView App',
		pluralLabel: 'QlikView Apps',
		icon: 'chart-bar',
		color: 'emerald'
	},
	'qlikview': {
		type: 'qlikview',
		label: 'QlikView',
		pluralLabel: 'QlikView Docs',
		icon: 'document-chart-bar',
		color: 'emerald'
	},
	'dataset': {
		type: 'dataset',
		label: 'Dataset',
		pluralLabel: 'Datasets',
		icon: 'table',
		color: 'teal'
	},
	'script': {
		type: 'script',
		label: 'Script',
		pluralLabel: 'Scripts',
		icon: 'code',
		color: 'slate'
	},
	'dataflow': {
		type: 'dataflow',
		label: 'Dataflow',
		pluralLabel: 'Dataflows',
		icon: 'arrow-path',
		color: 'cyan'
	},
	'tablerecipe': {
		type: 'tablerecipe',
		label: 'Table Recipe',
		pluralLabel: 'Table Recipes',
		icon: 'clipboard-list',
		color: 'lime'
	},
	'note': {
		type: 'note',
		label: 'Note',
		pluralLabel: 'Notes',
		icon: 'document-text',
		color: 'yellow'
	},
	'genericlink': {
		type: 'genericlink',
		label: 'Link',
		pluralLabel: 'Links',
		icon: 'link',
		color: 'gray'
	},
	'automation': {
		type: 'automation',
		label: 'Automation',
		pluralLabel: 'Automations',
		icon: 'cog',
		color: 'blue'
	},
	'automl-deployment': {
		type: 'automl-deployment',
		label: 'ML Deployment',
		pluralLabel: 'ML Deployments',
		icon: 'rocket-launch',
		color: 'rose'
	},
	'automl-experiment': {
		type: 'automl-experiment',
		label: 'ML Experiment',
		pluralLabel: 'ML Experiments',
		icon: 'beaker',
		color: 'fuchsia'
	},
	'glossary': {
		type: 'glossary',
		label: 'Glossary',
		pluralLabel: 'Glossaries',
		icon: 'book-open',
		color: 'indigo'
	},
	'assistant': {
		type: 'assistant',
		label: 'Assistant',
		pluralLabel: 'Assistants',
		icon: 'chat-bubble-left-right',
		color: 'violet'
	},
	'knowledgebase': {
		type: 'knowledgebase',
		label: 'Knowledge Base',
		pluralLabel: 'Knowledge Bases',
		icon: 'light-bulb',
		color: 'amber'
	},
	'dataproduct': {
		type: 'dataproduct',
		label: 'Data Product',
		pluralLabel: 'Data Products',
		icon: 'cube',
		color: 'purple'
	}
};

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a short hash for a commit (similar to git short hash)
 */
export function generateCommitHash(): string {
	const chars = '0123456789abcdef';
	let hash = '';
	for (let i = 0; i < 7; i++) {
		hash += chars[Math.floor(Math.random() * chars.length)];
	}
	return hash;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Normalize resource type by handling subtypes in brackets
 * e.g., "app[dataflow-prep]" -> "dataflow", "app[single-table-prep]" -> "tablerecipe"
 */
export function normalizeResourceType(type: string): ResourceType {
	// Handle special app subtypes
	if (type.includes('[dataflow-prep]')) return 'dataflow';
	if (type.includes('[single-table-prep]')) return 'tablerecipe';
	
	// Extract base type (remove brackets and contents)
	const baseType = type.replace(/\[.*\]/, '');
	
	// Check if it's a known type
	if (baseType in RESOURCE_TYPE_INFO) {
		return baseType as ResourceType;
	}
	
	return baseType as ResourceType;
}

/**
 * Get resource type info with fallback
 * Handles resource types with subtypes like "app[script,directQuery,]"
 */
export function getResourceTypeInfo(type: string): ResourceTypeInfo {
	// First try to normalize the type
	const normalizedType = normalizeResourceType(type);
	
	// Check if normalized type exists
	if (normalizedType in RESOURCE_TYPE_INFO) {
		return RESOURCE_TYPE_INFO[normalizedType];
	}
	
	// Try the original type without brackets
	const baseType = type.replace(/\[.*\]/, '');
	if (baseType in RESOURCE_TYPE_INFO) {
		return RESOURCE_TYPE_INFO[baseType as ResourceType];
	}
	
	// Fallback for unknown types
	return {
		type: baseType as ResourceType,
		label: baseType.charAt(0).toUpperCase() + baseType.slice(1),
		pluralLabel: `${baseType}s`,
		icon: 'document',
		color: 'gray'
	};
}

