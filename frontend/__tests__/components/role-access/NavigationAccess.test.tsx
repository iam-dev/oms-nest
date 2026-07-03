import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Sidebar } from '@/components/Sidebar';
import { SaddlesSidebarSection } from '@/components/SaddlesSidebarSection';
import { UserRole } from '@/types/Role';
import { getAllRoles, roleTestCases } from '../../utils/roleTestHelpers';
import * as useUserRoleModule from '@/hooks/useUserRole';
import * as rolePermissionsModule from '@/utils/rolePermissions';
import * as nextNavigationModule from 'next/navigation';

// Mock the hooks and utilities
jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: jest.fn()
}));

jest.mock('@/utils/rolePermissions', () => ({
  hasScreenPermission: jest.fn(),
  SCREEN_PERMISSIONS: {
    DASHBOARD: 'DASHBOARD',
    ORDERS: 'ORDERS',
    CUSTOMERS: 'CUSTOMERS',
    FITTERS: 'FITTERS',
    REPORTS: 'REPORTS',
    SUPPLIERS: 'SUPPLIERS',
    SUPPLIERS_MANAGEMENT: 'SUPPLIERS_MANAGEMENT',
    BRANDS: 'BRANDS',
    MODELS: 'MODELS',
    LEATHER_TYPES: 'LEATHER_TYPES',
    OPTIONS: 'OPTIONS',
    EXTRAS: 'EXTRAS',
    PRESETS: 'PRESETS',
    MY_SADDLE_STOCK: 'MY_SADDLE_STOCK',
    AVAILABLE_SADDLE_STOCK: 'AVAILABLE_SADDLE_STOCK',
    ALL_SADDLE_STOCK: 'ALL_SADDLE_STOCK',
    REPAIRS: 'REPAIRS',
    USER_MANAGEMENT: 'USER_MANAGEMENT',
    WAREHOUSES: 'WAREHOUSES',
    ACCESS_FILTER_GROUPS: 'ACCESS_FILTER_GROUPS',
    COUNTRY_MANAGERS: 'COUNTRY_MANAGERS',
    USER_PERMISSIONS_VIEW: 'USER_PERMISSIONS_VIEW'
  },
  NAVIGATION_ITEMS: [
    { name: 'Dashboard', href: '/dashboard', permission: 'DASHBOARD' },
    { name: 'Orders', href: '/orders', permission: 'ORDERS' },
    { name: 'Customers', href: '/customers', permission: 'CUSTOMERS' },
    { name: 'Fitters', href: '/fitters', permission: 'FITTERS' },
    { name: 'Reports', href: '/reports', permission: 'REPORTS' }
  ]
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: jest.fn().mockReturnValue('/dashboard')
}));

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  LayoutDashboard: () => <div data-testid="dashboard-icon">Dashboard Icon</div>,
  ShoppingCart: () => <div data-testid="orders-icon">Orders Icon</div>,
  Users: () => <div data-testid="users-icon">Users Icon</div>,
  BarChart3: () => <div data-testid="reports-icon">Reports Icon</div>,
  Search: () => <div data-testid="search-icon">Search Icon</div>,
  ChevronRight: () => <div data-testid="chevron-right">&rarr;</div>,
  ChevronLeft: () => <div data-testid="chevron-left">&larr;</div>,
  ChevronDown: () => <div data-testid="chevron-down">&darr;</div>,
  DivideIcon: () => <div data-testid="divide-icon">&divide;</div>,
  Boxes: () => <div data-testid="boxes-icon">Boxes Icon</div>,
  Wrench: () => <div data-testid="wrench-icon">Wrench Icon</div>,
  PackageCheck: () => <div data-testid="package-check-icon">PackageCheck Icon</div>,
  Factory: () => <div data-testid="factory-icon">Factory Icon</div>,
  Archive: () => <div data-testid="archive-icon">Archive Icon</div>,
  Warehouse: () => <div data-testid="warehouse-icon">Warehouse Icon</div>,
  UserCog: () => <div data-testid="user-cog-icon">UserCog Icon</div>,
  Settings: () => <div data-testid="settings-icon">Settings Icon</div>,
  Package: () => <div data-testid="package-icon">Package Icon</div>,
  Layers: () => <div data-testid="layers-icon">Layers Icon</div>,
  Puzzle: () => <div data-testid="puzzle-icon">Puzzle Icon</div>,
  Star: () => <div data-testid="star-icon">Star Icon</div>,
  Palette: () => <div data-testid="palette-icon">Palette Icon</div>,
}));

const mockUseUserRole = useUserRoleModule.useUserRole as jest.Mock;
const mockHasScreenPermission = rolePermissionsModule.hasScreenPermission as jest.Mock;

describe('Navigation Access Control', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup realistic permission implementation matching the actual SCREEN_PERMISSIONS
    mockHasScreenPermission.mockImplementation((role, permission) => {
      const permissionMap: Record<string, UserRole[]> = {
        'DASHBOARD': [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'ORDERS': [UserRole.USER, UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'CUSTOMERS': [UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'FITTERS': [UserRole.ADMIN, UserRole.SUPERVISOR],
        'REPORTS': [UserRole.ADMIN, UserRole.SUPERVISOR],
        'SUPPLIERS': [UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'SUPPLIERS_MANAGEMENT': [UserRole.SUPERVISOR],
        'BRANDS': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'MODELS': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'LEATHER_TYPES': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'OPTIONS': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'EXTRAS': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'PRESETS': [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'MY_SADDLE_STOCK': [UserRole.FITTER],
        'AVAILABLE_SADDLE_STOCK': [UserRole.FITTER],
        'ALL_SADDLE_STOCK': [UserRole.ADMIN, UserRole.SUPERVISOR],
        'REPAIRS': [UserRole.USER, UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
        'USER_MANAGEMENT': [UserRole.SUPERVISOR],
        'WAREHOUSES': [UserRole.SUPERVISOR],
        'ACCESS_FILTER_GROUPS': [UserRole.SUPERVISOR],
        'COUNTRY_MANAGERS': [UserRole.SUPERVISOR],
        'USER_PERMISSIONS_VIEW': [UserRole.SUPERVISOR],
      };

      const allowedRoles = permissionMap[permission as string] || [];

      // Handle supervisor inheritance
      if (role === UserRole.SUPERVISOR) {
        return allowedRoles.includes(UserRole.SUPERVISOR) || allowedRoles.includes(UserRole.ADMIN);
      }

      return allowedRoles.includes(role);
    });

    // Mock window resize events
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });

    window.addEventListener = jest.fn();
    window.removeEventListener = jest.fn();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Sidebar Navigation Filtering', () => {
    getAllRoles().forEach(role => {
      const testCase = roleTestCases.find(tc => tc.role === role);
      if (!testCase) return;

      test(`${testCase.roleName} sees only allowed navigation items`, () => {
        mockUseUserRole.mockReturnValue({
          role,
          hasRole: jest.fn()
        });

        render(<Sidebar />);

        // Define expected navigation items for each role based on actual Sidebar nav items
        // Note: "Saddle Modelling" comes from SaddlesSidebarSection (visible to USER, ADMIN, SUPERVISOR)
        // "Account Management" comes from AccountManagementSidebarSection (visible to SUPERVISOR only)
        const expectedNavItems: Record<string, string[]> = {
          [UserRole.USER]: ['Dashboard', 'Orders', 'Saddle Modelling', 'Repairs', 'Find Saddle'],
          [UserRole.FITTER]: ['Dashboard', 'Orders', 'Customers', 'Repairs', 'Find Saddle'],
          [UserRole.SUPPLIER]: ['Dashboard', 'Find Saddle'],
          [UserRole.ADMIN]: ['Dashboard', 'Orders', 'Saddle Modelling', 'Customers', 'Fitters', 'Reports', 'Repairs', 'Find Saddle'],
          [UserRole.SUPERVISOR]: ['Dashboard', 'Orders', 'Saddle Modelling', 'Factories', 'Customers', 'Fitters', 'Reports', 'Repairs', 'Find Saddle', 'Account Management']
        };

        const expectedItems = expectedNavItems[role] || [];
        const allPossibleItems = ['Dashboard', 'Orders', 'Customers', 'Fitters', 'Reports', 'Find Saddle'];

        expectedItems.forEach(item => {
          expect(screen.getByText(item)).toBeInTheDocument();
        });

        // Only check a subset of items for absence to avoid false positives
        allPossibleItems.forEach(item => {
          if (!expectedItems.includes(item)) {
            expect(screen.queryByText(item)).not.toBeInTheDocument();
          }
        });
      });
    });

    test('displays all navigation items for admin', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: jest.fn()
      });

      render(<Sidebar />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Fitters')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Find Saddle')).toBeInTheDocument();
      // Factories (SUPPLIERS_MANAGEMENT) is SUPERVISOR-only
      expect(screen.queryByText('Factories')).not.toBeInTheDocument();
    });

    test('shows minimal navigation for suppliers', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPPLIER,
        hasRole: jest.fn()
      });

      render(<Sidebar />);

      // Should show
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Find Saddle')).toBeInTheDocument();

      // Should not show
      expect(screen.queryByText('Orders')).not.toBeInTheDocument();
      expect(screen.queryByText('Customers')).not.toBeInTheDocument();
      expect(screen.queryByText('Fitters')).not.toBeInTheDocument();
      expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    });

    test('displays logo for all users', () => {
      getAllRoles().forEach(role => {
        mockUseUserRole.mockReturnValue({
          role,
          hasRole: jest.fn()
        });

        const { unmount } = render(<Sidebar />);

        const logo = screen.getByAltText('Custom Saddlery Logo');
        expect(logo).toBeInTheDocument();
        expect(logo.getAttribute('src')).toContain('logo.png');

        unmount();
      });
    });
  });

  describe('Saddle Modelling Section', () => {
    test('shows saddle modelling items for users with access', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn()
      });

      render(<SaddlesSidebarSection isCollapsed={false} />);

      // User should see saddle modelling toggle
      expect(screen.getByText('Saddle Modelling')).toBeInTheDocument();
    });

    test('hides saddle modelling section for users without access', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.FITTER,
        hasRole: jest.fn()
      });

      const { container } = render(<SaddlesSidebarSection isCollapsed={false} />);

      // Fitter should not see saddle modelling items (no BRANDS/MODELS/etc permissions)
      expect(container.querySelector('[data-testid="saddle-modelling-items"]')).not.toBeInTheDocument();
    });

    test('returns null when no items are visible', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPPLIER,
        hasRole: jest.fn()
      });

      const { container } = render(<SaddlesSidebarSection isCollapsed={false} />);

      // Should render nothing
      expect(container.firstChild).toBeNull();
    });

    test('toggles saddle modelling section visibility', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: jest.fn()
      });

      render(<SaddlesSidebarSection isCollapsed={false} />);

      // Initially should be collapsed (open defaults to false), items not visible
      expect(screen.queryByText('Models')).not.toBeInTheDocument();

      // Find and click the toggle button
      const toggleButton = screen.getByText('Saddle Modelling');
      fireEvent.click(toggleButton);

      // Now items should be visible
      expect(screen.getByText('Models')).toBeInTheDocument();
      expect(screen.getByText('Brands')).toBeInTheDocument();
    });

    test('auto-expands when current route matches saddle modelling item', () => {
      // Mock current pathname to be a saddle modelling route
      const mockUsePathname = nextNavigationModule.usePathname as jest.Mock;
      mockUsePathname.mockReturnValue('/models');

      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: jest.fn()
      });

      render(<SaddlesSidebarSection isCollapsed={false} />);

      // Should auto-expand and show items because we're on /models
      expect(screen.getByText('Models')).toBeInTheDocument();
      expect(screen.getByText('Brands')).toBeInTheDocument();
    });
  });

  describe('Permission Checking Integration', () => {
    test('calls hasScreenPermission for each navigation item', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: jest.fn()
      });

      render(<Sidebar />);

      // Should call hasScreenPermission for each navigation item in the Sidebar
      expect(mockHasScreenPermission).toHaveBeenCalledWith(UserRole.ADMIN, 'DASHBOARD');
      expect(mockHasScreenPermission).toHaveBeenCalledWith(UserRole.ADMIN, 'ORDERS');
      expect(mockHasScreenPermission).toHaveBeenCalledWith(UserRole.ADMIN, 'CUSTOMERS');
      expect(mockHasScreenPermission).toHaveBeenCalledWith(UserRole.ADMIN, 'FITTERS');
      expect(mockHasScreenPermission).toHaveBeenCalledWith(UserRole.ADMIN, 'SUPPLIERS_MANAGEMENT');
      expect(mockHasScreenPermission).toHaveBeenCalledWith(UserRole.ADMIN, 'REPORTS');
    });

    test('filters navigation items based on permission results', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn()
      });

      // Mock specific permission results for USER role
      mockHasScreenPermission.mockImplementation((role, permission) => {
        if (role === UserRole.USER) {
          return ['DASHBOARD', 'ORDERS'].includes(permission);
        }
        return false;
      });

      render(<Sidebar />);

      // Should show items with granted permissions
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();

      // Should not show items with denied permissions
      expect(screen.queryByText('Customers')).not.toBeInTheDocument();
      expect(screen.queryByText('Fitters')).not.toBeInTheDocument();
      expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    test('handles mobile view collapse', () => {
      // Mock mobile screen size - Sidebar collapses at < 1024px and hides labels
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800,
      });

      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: jest.fn()
      });

      render(<Sidebar />);

      // On mobile, sidebar should be collapsed and labels are hidden
      // But icons should still be present
      expect(screen.getByTestId('dashboard-icon')).toBeInTheDocument();
      expect(screen.getByTestId('orders-icon')).toBeInTheDocument();
    });

    test('handles desktop view expansion', () => {
      // Mock desktop screen size
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: jest.fn()
      });

      render(<Sidebar />);

      // On desktop, sidebar should show full navigation
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
    });
  });

  describe('Navigation Consistency', () => {
    test('navigation items match role permission configuration', () => {
      const roleNavigationMap: Record<string, { allowed: string[]; denied: string[] }> = {
        [UserRole.USER]: {
          allowed: ['Dashboard', 'Orders', 'Find Saddle'],
          denied: ['Customers', 'Fitters', 'Reports']
        },
        [UserRole.FITTER]: {
          allowed: ['Dashboard', 'Orders', 'Customers', 'Find Saddle'],
          denied: ['Fitters', 'Reports']
        },
        [UserRole.SUPPLIER]: {
          allowed: ['Dashboard', 'Find Saddle'],
          denied: ['Orders', 'Customers', 'Fitters', 'Reports']
        },
        [UserRole.ADMIN]: {
          allowed: ['Dashboard', 'Orders', 'Customers', 'Fitters', 'Reports', 'Find Saddle'],
          denied: ['Factories'] // Factories (SUPPLIERS_MANAGEMENT) is SUPERVISOR-only
        },
        [UserRole.SUPERVISOR]: {
          allowed: ['Dashboard', 'Orders', 'Customers', 'Fitters', 'Reports', 'Find Saddle', 'Factories'],
          denied: []
        }
      };

      Object.entries(roleNavigationMap).forEach(([role, expected]) => {
        mockUseUserRole.mockReturnValue({
          role: role as UserRole,
          hasRole: jest.fn()
        });

        const { unmount } = render(<Sidebar />);

        // Check allowed items are present
        expected.allowed.forEach(item => {
          expect(screen.getByText(item)).toBeInTheDocument();
        });

        // Check denied items are not present
        expected.denied.forEach(item => {
          expect(screen.queryByText(item)).not.toBeInTheDocument();
        });

        unmount();
      });
    });
  });
});
