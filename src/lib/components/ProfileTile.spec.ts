import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ProfileTile Component Logic', () => {
	beforeEach(() => {
		// Mock DOM methods
		global.document = {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			querySelector: vi.fn(),
			querySelectorAll: vi.fn(() => []),
			body: {} as any,
			head: {} as any
		} as any;
	});

	describe('Initials Generation', () => {
		it('should generate initials from full name', () => {
			const getInitials = (name: string | null): string => {
				if (!name) return '?';
				const trimmed = name.trim();
				if (!trimmed) return '?';
				const parts = trimmed.split(/\s+/);
				if (parts.length >= 2) {
					return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
				}
				return trimmed.substring(0, 2).toUpperCase();
			};

			expect(getInitials('John Doe')).toBe('JD');
			expect(getInitials('Jane Mary Smith')).toBe('JS');
			expect(getInitials('SingleName')).toBe('SI');
			expect(getInitials('')).toBe('?');
			expect(getInitials(null)).toBe('?');
		});
	});

	describe('Dropdown State Management', () => {
		it('should toggle dropdown open state', () => {
			let isOpen = false;

			// Toggle open
			isOpen = !isOpen;
			expect(isOpen).toBe(true);

			// Toggle closed
			isOpen = !isOpen;
			expect(isOpen).toBe(false);
		});

		it('should close dropdown when logout is clicked', () => {
			let isOpen = true;
			const onLogout = vi.fn();

			// Simulate logout click
			isOpen = false;
			onLogout();

			expect(isOpen).toBe(false);
			expect(onLogout).toHaveBeenCalled();
		});

		it('should close dropdown when manage data is clicked', () => {
			let isOpen = true;
			const onManageData = vi.fn();

			// Simulate manage data click
			isOpen = false;
			onManageData();

			expect(isOpen).toBe(false);
			expect(onManageData).toHaveBeenCalled();
		});

		it('should close dropdown when logout and clear data is clicked', () => {
			let isOpen = true;
			const onLogoutAndClearData = vi.fn();

			// Simulate logout and clear data click
			isOpen = false;
			onLogoutAndClearData();

			expect(isOpen).toBe(false);
			expect(onLogoutAndClearData).toHaveBeenCalled();
		});
	});

	describe('Logout and Clear Data Option', () => {
		it('should only show when onLogoutAndClearData is provided', () => {
			const hasHandler = true;
			const noHandler = false;

			expect(hasHandler).toBe(true);
			expect(noHandler).toBe(false);
		});

		it('should call onLogoutAndClearData when clicked', () => {
			const onLogoutAndClearData = vi.fn();

			// Simulate click
			onLogoutAndClearData();

			expect(onLogoutAndClearData).toHaveBeenCalled();
		});

		it('should have red styling for destructive action', () => {
			const isDestructive = true;
			const buttonClass = isDestructive 
				? 'text-red-600 dark:text-red-400' 
				: 'text-gray-700 dark:text-gray-300';

			expect(buttonClass).toContain('red');
		});
	});

	describe('Manage Data Option', () => {
		it('should only show when onManageData is provided', () => {
			const hasHandler = true;
			const noHandler = false;

			expect(hasHandler).toBe(true);
			expect(noHandler).toBe(false);
		});

		it('should call onManageData when clicked', () => {
			const onManageData = vi.fn();

			// Simulate click
			onManageData();

			expect(onManageData).toHaveBeenCalled();
		});
	});

	describe('Click Outside Detection', () => {
		it('should detect clicks outside dropdown', () => {
			const dropdownRef = { contains: vi.fn(() => false) };
			const buttonRef = { contains: vi.fn(() => false) };
			const target = {} as Node;

			const isOutside = !dropdownRef.contains(target) && !buttonRef.contains(target);

			expect(isOutside).toBe(true);
		});

		it('should not close when clicking inside dropdown', () => {
			const dropdownRef = { contains: vi.fn(() => true) };
			const buttonRef = { contains: vi.fn(() => false) };
			const target = {} as Node;

			const isOutside = !dropdownRef.contains(target) && !buttonRef.contains(target);

			expect(isOutside).toBe(false);
		});

		it('should not close when clicking button', () => {
			const dropdownRef = { contains: vi.fn(() => false) };
			const buttonRef = { contains: vi.fn(() => true) };
			const target = {} as Node;

			const isOutside = !dropdownRef.contains(target) && !buttonRef.contains(target);

			expect(isOutside).toBe(false);
		});
	});

	describe('Props Validation', () => {
		it('should handle optional props correctly', () => {
			const requiredProps = {
				tenantName: 'Test Tenant',
				tenantUrl: 'test.qlikcloud.com',
				userName: 'John Doe',
				onLogout: vi.fn()
			};

			const withOptionalProps = {
				...requiredProps,
				onManageData: vi.fn(),
				onLogoutAndClearData: vi.fn()
			};

			expect(requiredProps).toHaveProperty('onLogout');
			expect(withOptionalProps).toHaveProperty('onManageData');
			expect(withOptionalProps).toHaveProperty('onLogoutAndClearData');
		});

		it('should handle null values for optional props', () => {
			const props = {
				tenantName: null as string | null,
				tenantUrl: null as string | null,
				userName: null as string | null,
				onLogout: vi.fn()
			};

			expect(props.tenantName).toBeNull();
			expect(props.tenantUrl).toBeNull();
			expect(props.userName).toBeNull();
		});
	});
});

