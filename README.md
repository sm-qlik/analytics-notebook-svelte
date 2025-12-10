# Analytics Notebook

A Svelte web application for searching and exploring Qlik Cloud analytics content. Connect to your Qlik Cloud tenant to search across dimensions, measures, and expressions in all your applications.

## Features

- **Qlik Cloud OAuth Authentication** — Securely connect to Qlik Cloud tenants via OAuth2
- **Fuzzy Search** — Search through master dimensions, master measures, sheet dimensions, and sheet measures
- **Multi-App Support** — Browse and search across multiple Qlik applications simultaneously
- **Filtering** — Filter results by space, app, sheet, or object type
- **Excel Export** — Export search results to XLSX format
- **Dark Mode** — Supports light and dark themes
- **Responsive** — Works on desktop and mobile devices
- **Secure** - No data leaves your browser

## Tech Stack

- [Svelte 5](https://svelte.dev/) with [SvelteKit](https://kit.svelte.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Fuse.js](https://fusejs.io/) for fuzzy search
- [SheetJS (xlsx)](https://sheetjs.com/) for Excel export
- [@qlik/api](https://qlik.dev/toolkits/qlik-api/) for Qlik Cloud connectivity
- [Vitest](https://vitest.dev/) for testing

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+ 
- A Qlik Cloud tenant (US or EU region, unless you add additional OAuth clients)

### Installation

```bash
# Clone the repository
git clone https://github.com/sm-qlik/analytics-notebook-svelte.git
cd analytics-notebook-svelte

# Install dependencies
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

### Deployment

The app is configured for static deployment (e.g., GitHub Pages).

Deploy to GitHub Pages:

```bash
npm run publish
```

This runs `npm run build` followed by `npm run deploy`, which uses `gh-pages` to publish the `build` directory.

## Usage

1. **Enter your Qlik Cloud tenant URL** — e.g., `your-tenant.us.qlikcloud.com` or `your-tenant.eu.qlikcloud.com`
2. **Authenticate** — You'll be redirected to Qlik Cloud for OAuth authentication
3. **Search** — Once authenticated, apps will load automatically. Use the search bar to find dimensions and measures
4. **Filter** — Use the sidebar to filter by space, app, sheet, or object type
5. **Export** — Click the export button to download results as an Excel file

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run check` | Run Svelte type checking |
| `npm run check:watch` | Run type checking in watch mode |
| `npm run format` | Format code with Prettier |
| `npm run lint` | Check code formatting |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run publish` | Build and deploy to GitHub Pages |
| `npm test` | Run test with Vitest and keep running tests on changes |

## Project Structure

```
src/
├── lib/
│   ├── assets/           # Static assets (favicon, logos, images)
│   ├── components/       # Svelte UI components (search, filters, displays, indicators)
│   ├── stores/           # Svelte stores for state management (authentication)
│   ├── utils/            # Utility functions (Qlik auth, engine API, table helpers)
│   └── index.ts          # Library exports
├── routes/               # SvelteKit routes (pages, layouts, OAuth callback)
└── app.*                 # App configuration files (CSS, TypeScript types, HTML template)
```
