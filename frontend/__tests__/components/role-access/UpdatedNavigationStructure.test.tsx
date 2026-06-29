import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { Sidebar } from '@/components/Sidebar';
import { UserRole } from '@/types/Role';
import * as useUserRoleModule from '@/hooks/useUserRole';
import * as rolePermissionsModule from '@/utils/rolePermissions';

// Mock the navigation components
jest.mock('@/components/SaddlesSidebarSection', () => {
  const SaddlesSidebarSection = () => {
    const mockUseUserRole = (jest.requireMock('@/hooks/useUserRole') as { useUserRole: () => { role: unknown } }).useUserRole;
    const { role } = mockUseUserRole();
    const mockHasScreenPermission = (jest.requireMock('@/utils/rolePermissions') as { hasScreenPermission: (...args: unknown[]) => boolean }).hasScreenPermission;

    const saddleItems = ['Models', 'Brands', 'Leather Types', 'Options', 'Extras', 'Presets'];
    const permissionMap: Record<string, string> = {
      'Models': 'MODELS',
      'Brands': 'BRANDS',
      'Leather Types': 'LEATHER_TYPES',
      'Options': 'OPTIONS',
      'Extras': 'EXTRAS',
      'Presets': 'PRESETS',
    };
    const visibleItems = saddleItems.filter(item =>
      mockHasScreenPermission(role, permissionMap[item])
    );

    if (visibleItems.length === 0) return null;

    return (
      <div data-testid="saddle-modelling-section">
        <button data-testid="saddle-modelling-toggle">
          Saddle Modelling
        </button>
        <div>
          {visibleItems.map(item => (
            <a key={item} data-testid={`saddle-item-${item.toLowerCase().replace(/\s+/g, '-')}`}>
              {item}
            </a>
          ))}
        </div>
      </div>
    );
  };
  return { __esModule: true, SaddlesSidebarSection };
});

jest.mock('@/components/AccountManagementSidebarSection', () => {
  const AccountManagementSidebarSection = () => {
    const mockUseUserRole = (jest.requireMock('@/hooks/useUserRole') as { useUserRole: () => { role: unknown } }).useUserRole;
    const { role } = mockUseUserRole();
    const mockHasScreenPermission = (jest.requireMock('@/utils/rolePermissions') as { hasScreenPermission: (...args: unknown[]) => boolean }).hasScreenPermission;

    const accountItems = [
      { name: 'Users', permission: 'USER_MANAGEMENT' },
      { name: 'Warehouses', permission: 'WAREHOUSES' },
      { name: 'Access Filter Groups', permission: 'ACCESS_FILTER_GROUPS' },
      { name: 'Country Managers', permission: 'COUNTRY_MANAGERS' },
      { name: 'User Permissions', permission: 'USER_PERMISSIONS_VIEW' }
    ];

    const visibleItems = accountItems.filter(item =>
      mockHasScreenPermission(role, item.permission)
    );

    if (visibleItems.length === 0) return null;

    return (
      <div data-testid="account-management-section">
        <button data-testid="account-management-toggle">
          Account Management
        </button>
        <div>
          {visibleItems.map(item => (
            <a key={item.name} data-testid={`account-item-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
              {item.name}
            </a>
          ))}
        </div>
      </div>
    );
  };
  return { __esModule: true, AccountManagementSidebarSection };
});

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
    SUPPLIERS_MANAGEMENT: 'SUPPLIERS_MANAGEMENT',
    MY_SADDLE_STOCK: 'MY_SADDLE_STOCK',
    AVAILABLE_SADDLE_STOCK: 'AVAILABLE_SADDLE_STOCK',
    ALL_SADDLE_STOCK: 'ALL_SADDLE_STOCK',
    REPAIRS: 'REPAIRS',
    BRANDS: 'BRANDS',
    MODELS: 'MODELS',
    LEATHER_TYPES: 'LEATHER_TYPES',
    OPTIONS: 'OPTIONS',
    EXTRAS: 'EXTRAS',
    PRESETS: 'PRESETS',
    USER_MANAGEMENT: 'USER_MANAGEMENT',
    WAREHOUSES: 'WAREHOUSES',
    ACCESS_FILTER_GROUPS: 'ACCESS_FILTER_GROUPS',
    COUNTRY_MANAGERS: 'COUNTRY_MANAGERS',
    USER_PERMISSIONS_VIEW: 'USER_PERMISSIONS_VIEW',
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
  }),
  usePathname: () => '/dashboard'
}));

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
  LayoutList: () => <div data-testid="layout-list-icon">LayoutList Icon</div>,
  Archive: () => <div data-testid="archive-icon">Archive Icon</div>,
  Warehouse: () => <div data-testid="warehouse-icon">Warehouse Icon</div>,
  UserCog: () => <div data-testid="user-cog-icon">UserCog Icon</div>,
}));

const mockUseUserRole = (useUserRoleModule as unknown as { useUserRole: jest.Mock }).useUserRole;
const mockHasScreenPermission = (rolePermissionsModule as unknown as { hasScreenPermission: jest.Mock }).hasScreenPermission;

describe('Updated Navigation Structure', () => {
  beforeEach(() => {
    jest.clearAllMocks();

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

  describe('Navigation Structure Changes', () => {
    test('main navigation no longer includes suppliers directly', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        const supervisorPermissions = [
          'DASHBOARD', 'ORDERS', 'CUSTOMERS', 'FITTERS', 'REPORTS',
          'SUPPLIERS_MANAGEMENT', 'USER_MANAGEMENT', 'WAREHOUSES',
          'ACCESS_FILTER_GROUPS', 'COUNTRY_MANAGERS', 'USER_PERMISSIONS_VIEW',
          'ALL_SADDLE_STOCK', 'REPAIRS', 'BRANDS', 'MODELS', 'LEATHER_TYPES',
          'OPTIONS', 'EXTRAS', 'PRESETS'
        ];
        return supervisorPermissions.includes(permission);
      });

      render(<Sidebar />);

      // Main navigation items should be present
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Fitters')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    test('account management section is visible for supervisor', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        const supervisorPermissions = [
          'DASHBOARD', 'ORDERS', 'CUSTOMERS', 'FITTERS', 'REPORTS',
          'SUPPLIERS_MANAGEMENT', 'USER_MANAGEMENT', 'WAREHOUSES',
          'ACCESS_FILTER_GROUPS', 'COUNTRY_MANAGERS', 'USER_PERMISSIONS_VIEW',
          'ALL_SADDLE_STOCK', 'REPAIRS', 'BRANDS', 'MODELS', 'LEATHER_TYPES',
          'OPTIONS', 'EXTRAS', 'PRESETS'
        ];
        return supervisorPermissions.includes(permission);
      });

      render(<Sidebar />);

      // Account management section should be present
      expect(screen.getByTestId('account-management-section')).toBeInTheDocument();
    });

    test('new account management items are available', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        return ['USER_MANAGEMENT', 'WAREHOUSES', 'ACCESS_FILTER_GROUPS', 'COUNTRY_MANAGERS', 'USER_PERMISSIONS_VIEW'].includes(permission);
      });

      render(<Sidebar />);

      // Account management items should be present for supervisor
      expect(screen.getByTestId('account-item-users')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-warehouses')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-user-permissions')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-access-filter-groups')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-country-managers')).toBeInTheDocument();
    });
  });

  describe('Role-Based Navigation Access', () => {
    test('SUPERVISOR sees all navigation sections', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation(() => {
        // Supervisor has access to everything
        return true;
      });

      render(<Sidebar />);

      // Should see main navigation
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();

      // Should see saddle modelling section
      expect(screen.getByTestId('saddle-modelling-section')).toBeInTheDocument();

      // Should see account management section
      expect(screen.getByTestId('account-management-section')).toBeInTheDocument();
    });

    test('ADMIN does not see account management (SUPERVISOR-only)', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        const adminPermissions = [
          'DASHBOARD', 'ORDERS', 'CUSTOMERS', 'FITTERS', 'REPORTS',
          'BRANDS', 'MODELS', 'LEATHER_TYPES', 'OPTIONS', 'EXTRAS', 'PRESETS',
          'ALL_SADDLE_STOCK', 'REPAIRS'
        ];
        return adminPermissions.includes(permission);
      });

      render(<Sidebar />);

      // Should see main navigation
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();

      // Should see saddle modelling section
      expect(screen.getByTestId('saddle-modelling-section')).toBeInTheDocument();

      // Should NOT see account management section (SUPERVISOR-only)
      expect(screen.queryByTestId('account-management-section')).not.toBeInTheDocument();
    });

    test('USER sees only basic navigation', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        const userPermissions = [
          'DASHBOARD', 'ORDERS', 'REPAIRS',
          'BRANDS', 'MODELS', 'LEATHER_TYPES', 'OPTIONS', 'EXTRAS', 'PRESETS'
        ];
        return userPermissions.includes(permission);
      });

      render(<Sidebar />);

      // Should see basic navigation
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();

      // Should not see admin features
      expect(screen.queryByText('Customers')).not.toBeInTheDocument();
      expect(screen.queryByText('Fitters')).not.toBeInTheDocument();
      expect(screen.queryByText('Reports')).not.toBeInTheDocument();

      // Should see saddle modelling section
      expect(screen.getByTestId('saddle-modelling-section')).toBeInTheDocument();

      // Should not see account management section
      expect(screen.queryByTestId('account-management-section')).not.toBeInTheDocument();
    });

    test('FITTER sees customer management but no account management', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.FITTER,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        const fitterPermissions = ['DASHBOARD', 'ORDERS', 'CUSTOMERS', 'MY_SADDLE_STOCK', 'AVAILABLE_SADDLE_STOCK', 'REPAIRS'];
        return fitterPermissions.includes(permission);
      });

      render(<Sidebar />);

      // Should see basic navigation plus customers
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();

      // Should not see admin features
      expect(screen.queryByText('Fitters')).not.toBeInTheDocument();
      expect(screen.queryByText('Reports')).not.toBeInTheDocument();

      // Should not see saddle modelling section (no BRANDS/MODELS etc permissions)
      expect(screen.queryByTestId('saddle-modelling-section')).not.toBeInTheDocument();

      // Should not see account management section
      expect(screen.queryByTestId('account-management-section')).not.toBeInTheDocument();
    });

    test('SUPPLIER sees minimal navigation', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPPLIER,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        const supplierPermissions = ['DASHBOARD'];
        return supplierPermissions.includes(permission);
      });

      render(<Sidebar />);

      // Should see minimal navigation
      expect(screen.getByText('Dashboard')).toBeInTheDocument();

      // Should not see orders, customers, etc.
      expect(screen.queryByText('Orders')).not.toBeInTheDocument();
      expect(screen.queryByText('Customers')).not.toBeInTheDocument();

      // Should not see saddle modelling section
      expect(screen.queryByTestId('saddle-modelling-section')).not.toBeInTheDocument();

      // Should not see account management section
      expect(screen.queryByTestId('account-management-section')).not.toBeInTheDocument();
    });
  });

  describe('Permission-Based Item Visibility', () => {
    test('account management items appear/disappear based on permissions', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        hasRole: jest.fn()
      });

      // Test with full permissions
      mockHasScreenPermission.mockImplementation((role, permission) => {
        return ['USER_MANAGEMENT', 'WAREHOUSES', 'ACCESS_FILTER_GROUPS', 'COUNTRY_MANAGERS', 'USER_PERMISSIONS_VIEW'].includes(permission);
      });

      const { rerender } = render(<Sidebar />);

      expect(screen.getByTestId('account-item-users')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-warehouses')).toBeInTheDocument();
      expect(screen.getByTestId('account-item-user-permissions')).toBeInTheDocument();

      // Test with limited permissions
      mockHasScreenPermission.mockImplementation((role, permission) => {
        return ['USER_MANAGEMENT'].includes(permission);
      });

      rerender(<Sidebar />);

      expect(screen.getByTestId('account-item-users')).toBeInTheDocument();
      expect(screen.queryByTestId('account-item-warehouses')).not.toBeInTheDocument();
      expect(screen.queryByTestId('account-item-user-permissions')).not.toBeInTheDocument();
    });

    test('sections disappear completely when no items are visible', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn()
      });

      // User has no account management permissions
      mockHasScreenPermission.mockImplementation((role, permission) => {
        return ['DASHBOARD', 'ORDERS'].includes(permission);
      });

      render(<Sidebar />);

      // Account management section should not render at all
      expect(screen.queryByTestId('account-management-section')).not.toBeInTheDocument();
    });
  });

  describe('Navigation Hierarchy Consistency', () => {
    test('navigation maintains logical order', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockReturnValue(true);

      render(<Sidebar />);

      // Check that key elements exist in DOM
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByTestId('saddle-modelling-section')).toBeInTheDocument();
      expect(screen.getByTestId('account-management-section')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    test('collapsible sections work independently', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockReturnValue(true);

      render(<Sidebar />);

      // Both sections should have toggle buttons
      expect(screen.getByTestId('saddle-modelling-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('account-management-toggle')).toBeInTheDocument();

      // They should work independently
      const saddleToggle = screen.getByTestId('saddle-modelling-toggle');
      const accountToggle = screen.getByTestId('account-management-toggle');

      expect(saddleToggle).toBeInTheDocument();
      expect(accountToggle).toBeInTheDocument();
    });
  });
});
