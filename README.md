# QCS Environments

A Svelte web application for managing and organizing Qlik Cloud analytics environments. Connect to your Qlik Cloud tenant to view, organize, and manage your applications, automations, and other resources across multiple environments.

## Features

### Core Features
* **Qlik Cloud OAuth Authentication** — Securely connect to Qlik Cloud tenants via OAuth2
* **Resource Catalog** — Browse all your Qlik resources in a modern tile-based interface (apps, automations, datasets, data products, and more)
* **Multi-Space Support** — Filter resources by space (Personal, Shared, Managed)
* **Search & Sort** — Find resources quickly by name, sort by last modified or alphabetically
* **Dark Mode** — Supports light and dark themes
* **Responsive** — Works on desktop and mobile devices
* **Secure** — No data leaves your browser

### Environment Management
* **Environments** — Define deployment environments (Development, Staging, Production)
* **Environment Variables** — Configure environment-specific variables that resources can access
* **Environment Purpose** — Mark environments as "authoring" or "production"
* **Space Assignment** — Assign Qlik Cloud spaces to environments (one space → one environment, one environment → many spaces)

### Workflow Management
* **Workflows** — Define promotion paths between environments (e.g., Dev → Stage → Prod)
* **Stage Configuration** — Configure approval requirements for each stage
* **Enforce Promotion Order** — Resources must be promoted through each stage in order

### Project Management
* **Projects** — Group related resources together for coordinated deployment
* **Resource Selection** — Select multiple apps, automations, datasets, and other resources
* **Dependency Visualization** — View relationships between resources in a project
* **Git-like Versioning** — Track changes with commits, summaries, and descriptions
* **Commit History** — View the full history of changes to a project
* **Version Tracking** — Track which version is deployed to each environment

### Promotion Flow
* **Promote Between Environments** — Move project versions from one environment to the next
* **Promotion Notes** — Add notes when promoting to document why the change was made
* **Promotion History** — View the full promotion history for each commit

## Tech Stack

* Svelte 5 with SvelteKit
* TypeScript
* Tailwind CSS 4
* @qlik/api for Qlik Cloud connectivity (loaded from CDN)
* Vitest for testing

## Supported Qlik Cloud Regions

The following Qlik Cloud regions are supported out of the box:

| Region | Domain |
| ------ | ------ |
| US | us.qlikcloud.com |
| EU | eu.qlikcloud.com |
| Germany | de.qlikcloud.com |
| Sweden | se.qlikcloud.com |
| Singapore | sg.qlikcloud.com |
| Asia Pacific | ap.qlikcloud.com |
| Japan | jp.qlikcloud.com |
| India | in.qlikcloud.com |
| UAE | ae.qlikcloud.com |
| Brazil | br.qlikcloud.com |
| France | fr.qlikcloud.com |
| Israel | il.qlikcloud.com |
| UK | uk.qlikcloud.com |

To add support for additional regions, update the `DOMAIN_CLIENT_MAPPING` in `src/lib/utils/qlik-auth.ts`.

## Getting Started

### Prerequisites

* Node.js 22+
* A Qlik Cloud tenant

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd qcs-environments-poc

# Install dependencies
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Building for Production

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Usage

1. **Enter your Qlik Cloud tenant URL** — e.g., `your-tenant.us.qlikcloud.com` or `your-tenant.eu.qlikcloud.com`
2. **Authenticate** — You'll be redirected to Qlik Cloud for OAuth authentication
3. **Browse Catalog** — View all your resources in the catalog
4. **Set Up Environments** — Go to Environments to create Development, Staging, and Production environments
5. **Define Workflows** — Go to Workflows to define the promotion path between environments
6. **Create Projects** — Go to Projects to group resources and track versions
7. **Commit Changes** — Create commits to snapshot the current state of a project
8. **Promote Versions** — Promote commits between environments following your workflow

## Available Scripts

| Command             | Description                             |
| ------------------- | --------------------------------------- |
| npm run dev         | Start development server                |
| npm run build       | Build for production                    |
| npm run preview     | Preview production build                |
| npm run check       | Run Svelte type checking                |
| npm run check:watch | Run type checking in watch mode         |
| npm run format      | Format code with Prettier               |
| npm run lint        | Check code formatting                   |
| npm test            | Run unit tests with Vitest              |

## Project Structure

```
src/
├── lib/
│   ├── assets/               # Static assets (favicon, logos)
│   │   ├── favicon.ico
│   │   └── logo.svg
│   ├── components/           # Svelte UI components
│   │   ├── AppHeader.svelte      # Shared app header with navigation
│   │   ├── CommitForm.svelte     # Form for creating commits
│   │   ├── CommitHistory.svelte  # Timeline view of commits
│   │   ├── DependencyGraph.svelte # Visualization of resource dependencies
│   │   ├── EnvironmentCard.svelte # Environment card component
│   │   ├── HelpModal.svelte      # Help & information modal
│   │   ├── Login.svelte          # Authentication component
│   │   ├── ManageDataModal.svelte # Cached data management
│   │   ├── ProfileTile.svelte    # User profile dropdown
│   │   ├── ProjectCard.svelte    # Project card component
│   │   ├── ResourceCatalog.svelte # Main catalog grid view
│   │   ├── ResourceTile.svelte   # Individual resource tile
│   │   └── WorkflowVisualization.svelte # Workflow stage visualization
│   ├── stores/               # Svelte stores for state management
│   │   ├── app-cache.ts          # IndexedDB cache for app data
│   │   ├── auth.ts               # Authentication state
│   │   ├── environments.ts       # Environment management
│   │   ├── projects.ts           # Projects, commits, and dependencies
│   │   └── workflows.ts          # Workflow management
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts              # Core types for environments, workflows, projects
│   ├── utils/                # Utility functions
│   │   ├── qlik-auth.ts          # Qlik Cloud OAuth utilities
│   │   └── url-utils.ts          # URL parsing helpers
│   └── index.ts
├── routes/                   # SvelteKit routes
│   ├── +layout.js
│   ├── +layout.svelte
│   ├── +page.svelte              # Main catalog page
│   ├── Logo.svelte
│   ├── environments/             # Environment management
│   │   ├── +layout.js
│   │   ├── +page.svelte          # Environments list
│   │   └── [id]/
│   │       └── +page.svelte      # Environment detail (variables, spaces)
│   ├── oauth-callback/
│   │   └── +page.svelte          # OAuth callback handler
│   ├── projects/                 # Project management
│   │   ├── +layout.js
│   │   ├── +page.svelte          # Projects list
│   │   └── [id]/
│   │       └── +page.svelte      # Project detail (resources, commits)
│   └── workflows/                # Workflow management
│       ├── +layout.js
│       └── +page.svelte          # Workflows list and editor
├── app.css                   # Global styles (Tailwind)
├── app.d.ts                  # TypeScript declarations
└── app.html                  # HTML template
```

## Concepts

### Environments

Environments represent deployment stages like Development, Staging, and Production. Each environment:
- Has a **purpose** (authoring or production)
- Contains **variables** that resources can use
- Is associated with one or more **Qlik Cloud spaces**
- Belongs to a **workflow** that defines its promotion order

### Workflows

Workflows define the path that resources must take when being promoted between environments. For example:
- **Standard Promotion**: Development → Staging → Production
- **Hotfix**: Development → Production (bypasses staging)

Each stage in a workflow can require approval before promotion.

### Projects

Projects group related resources together for coordinated deployment. A project:
- Contains multiple resources (apps, automations, datasets, etc.)
- Tracks dependencies between resources
- Has a commit history tracking all changes
- Shows which version is deployed to each environment

### Commits

Commits are snapshots of a project's resources at a point in time, similar to Git commits. Each commit:
- Has a unique hash (e.g., `a1b2c3d`)
- Includes a summary and optional description
- Lists all resources included
- Can be promoted between environments

### Dependencies

Dependencies track relationships between resources, such as:
- An automation that references an app
- An app that uses data from a dataset
- A button in an app that triggers an automation

These dependencies are visualized in the project view and are maintained when promoting between environments.

## Future Plans

* **Git Integration** — Connect projects to GitHub repositories
* **Automated Testing** — Run tests before allowing promotion
* **Approval Workflows** — Integrate with external approval systems
* **Rollback Support** — Roll back to previous versions
* **Environment Comparison** — Compare resource versions across environments
* **Dependency Auto-Detection** — Automatically detect dependencies from resource metadata
