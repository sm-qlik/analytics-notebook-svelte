/**
 * Qlik Cloud OAuth Authentication Utilities
 * Based on the analytics-notebook OAuth implementation
 */

// Domain to Client ID mapping for Qlik Cloud regions
export const DOMAIN_CLIENT_MAPPING: Record<string, string> = {
	// Prod & test
	'eu.qlikcloud.com': '96200981eed552c0af73e18d85ab6b09',
	'us.qlik-stage.com': '1575c7dd959e43dc4b31bea208371b91',
	'eu.qlik-stage.com': '099e42704f4dc6b8d31c23f9c7444a1a',
	// Prod only
	'de.qlikcloud.com': '019b125fdf4cd13a07ec95d911f7547d',
	'sg.qlikcloud.com': '019b1262e0ee9508b5c721f590a0a88f',
	'ap.qlikcloud.com': '019b12663d78118b1ff459d28b7ea324',
	'jp.qlikcloud.com': '019b12677dfbd3fae5e8d135acc437b4',
	'in.qlikcloud.com': '019b1268afd43c066103a70948ba41ee',
	'ae.qlikcloud.com': '019b126a645f3c7a846a0dc1d20d21f8',
	'br.qlikcloud.com': '019b126bae10f876e423f4c24bca8cf5',
	'fr.qlikcloud.com': '019b126ee8ee65f94900d9a007f8f898',
	'il.qlikcloud.com': '019b12640bc556c91fbb82c904e0a529',
	'uk.qlikcloud.com': '019b1261abba98ba92ba818594c65500',
	'us.qlikcloud.com': '1803ea5e323590d73883f4416c111e53',
};

export interface TenantInfo {
	tenantUrl: string;
	clientId: string;
	domain: string;
}

export interface AuthConfig {
	host: string;
	clientId: string;
	redirectUri: string;
	scope: string;
	accessTokenStorage: 'local' | 'session' | 'memory';
}

/**
 * Parse tenant URL and extract domain/client ID
 */
export function parseTenantUrl(tenantUrl: string): TenantInfo {
	if (!tenantUrl || typeof tenantUrl !== 'string') {
		throw new Error('Tenant URL is required and must be a string');
	}

	const trimmed = tenantUrl.trim();
	
	// Remove protocol if present
	const urlWithoutProtocol = trimmed.replace(/^https?:\/\//, '');
	
	// Extract full hostname
	const domainMatch = urlWithoutProtocol.match(/^([^\/]+)/);
	if (!domainMatch) {
		throw new Error('Invalid tenant URL format');
	}
	
	const fullHostname = domainMatch[1];
	
	// Extract base domain from hostname (e.g., "services.eu.qlikcloud.com" -> "eu.qlikcloud.com")
	// or "your-tenant.eu.qlikcloud.com" -> "eu.qlikcloud.com"
	let baseDomain: string | null = null;
	
	// Try to match against known base domains
	for (const baseDomainKey of Object.keys(DOMAIN_CLIENT_MAPPING)) {
		if (fullHostname.endsWith('.' + baseDomainKey) || fullHostname === baseDomainKey) {
			baseDomain = baseDomainKey;
			break;
		}
	}
	
	// If no match found, try to extract the last two parts (e.g., "eu.qlikcloud.com")
	if (!baseDomain) {
		const parts = fullHostname.split('.');
		if (parts.length >= 2) {
			const lastTwoParts = parts.slice(-2).join('.');
			if (DOMAIN_CLIENT_MAPPING[lastTwoParts]) {
				baseDomain = lastTwoParts;
			}
		}
	}
	
	if (!baseDomain) {
		throw new Error(`Unsupported Qlik Cloud region: ${fullHostname}. Supported regions: ${Object.keys(DOMAIN_CLIENT_MAPPING).join(', ')}`);
	}
	
	// Get client ID from mapping
	const clientId = DOMAIN_CLIENT_MAPPING[baseDomain];
	if (!clientId) {
		throw new Error(`Unsupported Qlik Cloud region: ${baseDomain}. Supported regions: ${Object.keys(DOMAIN_CLIENT_MAPPING).join(', ')}`);
	}
	
	// Construct full tenant URL (preserve the original hostname)
	const tenantUrlFormatted = `https://${urlWithoutProtocol}`;
	
	return {
		tenantUrl: tenantUrlFormatted,
		clientId,
		domain: baseDomain
	};
}

/**
 * Get OAuth redirect URI (from env or default)
 */
export function getOAuthRedirectUri(): string {
	if (typeof window !== 'undefined') {
		// Check for environment variable injected at build time
		const envRedirectUri = (window as any).ENV?.OAUTH_REDIRECT_URI;
		if (envRedirectUri) {
			return envRedirectUri;
		}

		// Detect base path from current URL
		// For GitHub Pages, the base path is /analytics-notebook-svelte
		let basePath = '';
		const pathname = window.location.pathname;
		
		// Check if pathname starts with the base path
		if (pathname.startsWith('/analytics-notebook-svelte')) {
			basePath = '/analytics-notebook-svelte';
		}
		
		// Construct redirect URI with base path
		return `${window.location.origin}${basePath}/oauth-callback`;
	}
	
	return '/oauth-callback';
}

/**
 * Get OAuth scopes (from env or default)
 */
export function getOAuthScopes(): string {
	if (typeof window !== 'undefined') {
		const envScopes = (window as any).ENV?.OAUTH_SCOPES;
		if (envScopes) {
			return envScopes;
		}
	}
	return 'user_default';
}

/**
 * Create auth configuration for Qlik API
 */
export function createAuthConfig(tenantInfo: TenantInfo): AuthConfig {
	return {
		host: tenantInfo.tenantUrl,
		clientId: tenantInfo.clientId,
		redirectUri: getOAuthRedirectUri(),
		scope: getOAuthScopes(),
		accessTokenStorage: 'local'
	};
}

/**
 * Load Qlik API dynamically
 */
export async function loadQlikAPI() {
	if (typeof window === 'undefined') {
		throw new Error('Qlik API can only be loaded in browser environment');
	}

	// Check if already loaded
	if ((window as any).qlikApi) {
		return (window as any).qlikApi;
	}

	// Load from CDN
	const apiModule = await import('https://cdn.jsdelivr.net/npm/@qlik/api/index.js');
	
	// Store for reuse
	(window as any).qlikApi = apiModule;
	
	return apiModule;
}

// Global auth configuration state to prevent multiple setDefaultHostConfig calls
let configuredTenantUrl: string | null = null;
let isConfiguring = false;

/**
 * Configure Qlik API auth once per tenant
 * This prevents the "already registered" warning and ensures token reuse
 */
export async function configureQlikAuthOnce(tenantUrl: string): Promise<void> {
	// If already configured for this tenant, skip
	if (configuredTenantUrl === tenantUrl) {
		return;
	}

	// Prevent concurrent configuration attempts
	if (isConfiguring) {
		// Wait a bit and check again
		await new Promise(resolve => setTimeout(resolve, 100));
		if (configuredTenantUrl === tenantUrl) {
			return;
		}
	}

	isConfiguring = true;

	try {
		const qlikApi = await loadQlikAPI();
		const tenantInfo = parseTenantUrl(tenantUrl);
		const authConfig = createAuthConfig(tenantInfo);
		const { auth } = qlikApi;
		
		// Only set if not already configured for this tenant
		if (configuredTenantUrl !== tenantUrl) {
			auth.setDefaultHostConfig(authConfig);
			configuredTenantUrl = tenantUrl;
		}
	} finally {
		isConfiguring = false;
	}
}

/**
 * Reset auth configuration (e.g., on logout or tenant change)
 */
export function resetAuthConfiguration(): void {
	configuredTenantUrl = null;
	isConfiguring = false;
}

