import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserRole } from '@/types/Role';
import { getAllRoles, getMockUserByRole, getMockToken } from '../utils/roleTestHelpers';
import * as useUserRoleModule from '@/hooks/useUserRole';
import * as authContextModule from '@/context/AuthContext';
import * as rolePermissionsModule from '@/utils/rolePermissions';

// Mock all the components we'll be testing
jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: jest.fn()
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
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
    ORDER_CREATE: 'ORDER_CREATE',
    ORDER_EDIT: 'ORDER_EDIT',
    ORDER_DELETE: 'ORDER_DELETE',
    CUSTOMER_CREATE: 'CUSTOMER_CREATE',
    CUSTOMER_EDIT: 'CUSTOMER_EDIT'
  }
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/dashboard'
}));

const mockUseAuth = authContextModule.useAuth as jest.Mock;
const mockUseUserRole = useUserRoleModule.useUserRole as jest.Mock;
const mockHasScreenPermission = rolePermissionsModule.hasScreenPermission as jest.Mock;

// Mock Application Component that represents the full app with role-based features
const MockApplication = ({ role }: { role: UserRole | null }) => {
  mockUseAuth.mockReturnValue({
    user: role ? getMockUserByRole(role).user : null,
    token: role ? getMockToken(role) : null,
    isAuthenticated: !!role,
    login: jest.fn(),
    logout: jest.fn(),
    isLoaded: true
  });

  mockUseUserRole.mockReturnValue({
    role,
    isAdmin: role === UserRole.ADMIN || role === UserRole.SUPERVISOR,
    isSupervisor: role === UserRole.SUPERVISOR,
    isFitter: role === UserRole.FITTER,
    isSupplier: role === UserRole.SUPPLIER,
    isUser: role === UserRole.USER,
    hasRole: jest.fn((checkRole) => {
      if (!role) return false;
      if (Array.isArray(checkRole)) return checkRole.includes(role);
      return role === checkRole;
    }),
    hasAnyRole: jest.fn((roles) => roles.includes(role))
  });

  // Setup realistic permission checking
  mockHasScreenPermission.mockImplementation((userRole, permission) => {
    if (!userRole) return false;
    
    const permissionMap = {
      'DASHBOARD': [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR],
      'ORDERS': [UserRole.USER, UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
      'CUSTOMERS': [UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
      'FITTERS': [UserRole.ADMIN, UserRole.SUPERVISOR],
      'REPORTS': [UserRole.ADMIN, UserRole.SUPERVISOR],
      'SUPPLIERS': [UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR],
      'ORDER_CREATE': [UserRole.USER, UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
      'ORDER_EDIT': [UserRole.ADMIN, UserRole.SUPERVISOR],
      'ORDER_DELETE': [UserRole.ADMIN, UserRole.SUPERVISOR],
      'CUSTOMER_CREATE': [UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
      'CUSTOMER_EDIT': [UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
      'ACCOUNT_MANAGEMENT': [UserRole.ADMIN, UserRole.SUPERVISOR],
      'USER_MANAGEMENT': [UserRole.SUPERVISOR],
      'WAREHOUSE_MANAGEMENT': [UserRole.SUPERVISOR],
      'USER_PERMISSIONS_VIEW': [UserRole.SUPERVISOR]
    };

    const allowedRoles: UserRole[] = (permissionMap as Record<string, UserRole[]>)[permission] || [];

    // Handle supervisor inheritance
    if (userRole === UserRole.SUPERVISOR) {
      return allowedRoles.includes(UserRole.SUPERVISOR) || allowedRoles.includes(UserRole.ADMIN);
    }

    return allowedRoles.includes(userRole);
  });

  return (
    <div data-testid="application">
      {/* Login Status */}
      <div data-testid="auth-status">
        {role ? `Authenticated as ${role}` : 'Not authenticated'}
      </div>

      {/* Navigation Menu */}
      <nav data-testid="navigation">
        {mockHasScreenPermission(role, 'DASHBOARD') && (
          <button data-testid="nav-dashboard">Dashboard</button>
        )}
        {mockHasScreenPermission(role, 'ORDERS') && (
          <button data-testid="nav-orders">Orders</button>
        )}
        {mockHasScreenPermission(role, 'CUSTOMERS') && (
          <button data-testid="nav-customers">Customers</button>
        )}
        {mockHasScreenPermission(role, 'FITTERS') && (
          <button data-testid="nav-fitters">Fitters</button>
        )}
        {mockHasScreenPermission(role, 'REPORTS') && (
          <button data-testid="nav-reports">Reports</button>
        )}
        {/* Suppliers moved to Account Management section, no longer in main nav */}
      </nav>

      {/* Dashboard Content */}
      {mockHasScreenPermission(role, 'DASHBOARD') && (
        <div data-testid="dashboard-content">
          <h1>Dashboard</h1>
          <p>Welcome, {role ? getMockUserByRole(role).user.firstName : 'User'}!</p>
        </div>
      )}

      {/* Orders Section */}
      {mockHasScreenPermission(role, 'ORDERS') && (
        <div data-testid="orders-section">
          <h2>Orders</h2>
          {mockHasScreenPermission(role, 'ORDER_CREATE') && (
            <button data-testid="create-order-btn">Create Order</button>
          )}
          {mockHasScreenPermission(role, 'ORDER_EDIT') && (
            <button data-testid="edit-order-btn">Edit Order</button>
          )}
          {mockHasScreenPermission(role, 'ORDER_DELETE') && (
            <button data-testid="delete-order-btn">Delete Order</button>
          )}
        </div>
      )}

      {/* Customers Section */}
      {mockHasScreenPermission(role, 'CUSTOMERS') && (
        <div data-testid="customers-section">
          <h2>Customers</h2>
          {mockHasScreenPermission(role, 'CUSTOMER_CREATE') && (
            <button data-testid="create-customer-btn">Create Customer</button>
          )}
          {mockHasScreenPermission(role, 'CUSTOMER_EDIT') && (
            <button data-testid="edit-customer-btn">Edit Customer</button>
          )}
        </div>
      )}

      {/* Admin Sections */}
      {mockHasScreenPermission(role, 'FITTERS') && (
        <div data-testid="fitters-section">
          <h2>Fitters Management</h2>
          <p>Manage fitter accounts</p>
        </div>
      )}

      {mockHasScreenPermission(role, 'REPORTS') && (
        <div data-testid="reports-section">
          <h2>Reports</h2>
          <p>Business analytics and reports</p>
        </div>
      )}

      {/* Account Management Section (includes suppliers) */}
      {(mockHasScreenPermission(role, 'ACCOUNT_MANAGEMENT') || mockHasScreenPermission(role, 'SUPPLIERS')) && (
        <div data-testid="account-management-section">
          <h2>Account Management</h2>
          {mockHasScreenPermission(role, 'SUPPLIERS') && (
            <div data-testid="suppliers-section">
              <h3>Suppliers</h3>
              <p>Supplier management</p>
            </div>
          )}
          {mockHasScreenPermission(role, 'USER_MANAGEMENT') && (
            <div data-testid="users-section">
              <h3>User Management</h3>
              <p>Manage system users</p>
            </div>
          )}
          {mockHasScreenPermission(role, 'WAREHOUSE_MANAGEMENT') && (
            <div data-testid="warehouses-section">
              <h3>Warehouse Management</h3>
              <p>Manage warehouses</p>
            </div>
          )}
        </div>
      )}

      {/* Access Denied Message */}
      {!role && (
        <div data-testid="access-denied">
          Please log in to access the application.
        </div>
      )}
    </div>
  );
};

describe('User Journey Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Initial Access', () => {
    test('unauthenticated user sees login prompt', () => {
      render(<MockApplication role={null} />);

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not authenticated');
      expect(screen.getByTestId('access-denied')).toHaveTextContent('Please log in to access the application.');
      
      // Should not see any navigation or content
      expect(screen.queryByTestId('navigation')).toBeInTheDocument(); // Nav exists but empty
      expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
    });

    getAllRoles().forEach(role => {
      test(`${role} user can authenticate and access appropriate features`, () => {
        render(<MockApplication role={role} />);

        const mockUser = getMockUserByRole(role);
        
        expect(screen.getByTestId('auth-status')).toHaveTextContent(`Authenticated as ${role}`);
        expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument();
        
        // All authenticated users should see dashboard
        expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
        expect(screen.getByText(`Welcome, ${mockUser.user.firstName}!`)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Access by Role', () => {
    test('USER role navigation journey', () => {
      render(<MockApplication role={UserRole.USER} />);

      // Should see basic navigation
      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('nav-orders')).toBeInTheDocument();
      
      // Should not see restricted navigation
      expect(screen.queryByTestId('nav-customers')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-fitters')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-reports')).not.toBeInTheDocument();
      // Suppliers no longer in main nav

      // Should see orders section with limited actions
      expect(screen.getByTestId('orders-section')).toBeInTheDocument();
      expect(screen.getByTestId('create-order-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-order-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-order-btn')).not.toBeInTheDocument();
    });

    test('FITTER role navigation journey', () => {
      render(<MockApplication role={UserRole.FITTER} />);

      // Should see fitter navigation
      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('nav-orders')).toBeInTheDocument();
      expect(screen.getByTestId('nav-customers')).toBeInTheDocument();
      
      // Should not see admin navigation
      expect(screen.queryByTestId('nav-fitters')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-reports')).not.toBeInTheDocument();
      // Suppliers no longer in main nav

      // Should see customers section with create/edit
      expect(screen.getByTestId('customers-section')).toBeInTheDocument();
      expect(screen.getByTestId('create-customer-btn')).toBeInTheDocument();
      expect(screen.getByTestId('edit-customer-btn')).toBeInTheDocument();

      // Should see orders section with create only
      expect(screen.getByTestId('orders-section')).toBeInTheDocument();
      expect(screen.getByTestId('create-order-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-order-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-order-btn')).not.toBeInTheDocument();
    });

    test('SUPPLIER role navigation journey', () => {
      render(<MockApplication role={UserRole.SUPPLIER} />);

      // Should see minimal navigation
      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
      
      // Should not see other navigation (suppliers moved to Account Management)
      expect(screen.queryByTestId('nav-orders')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-customers')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-fitters')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-reports')).not.toBeInTheDocument();

      // Should see account management section with suppliers
      expect(screen.getByTestId('account-management-section')).toBeInTheDocument();
      expect(screen.getByTestId('suppliers-section')).toBeInTheDocument();
      expect(screen.queryByTestId('orders-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('customers-section')).not.toBeInTheDocument();
    });

    test('ADMIN role navigation journey', () => {
      render(<MockApplication role={UserRole.ADMIN} />);

      // Should see main navigation (suppliers moved to Account Management)
      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('nav-orders')).toBeInTheDocument();
      expect(screen.getByTestId('nav-customers')).toBeInTheDocument();
      expect(screen.getByTestId('nav-fitters')).toBeInTheDocument();
      expect(screen.getByTestId('nav-reports')).toBeInTheDocument();

      // Should see all sections including Account Management
      expect(screen.getByTestId('orders-section')).toBeInTheDocument();
      expect(screen.getByTestId('customers-section')).toBeInTheDocument();
      expect(screen.getByTestId('fitters-section')).toBeInTheDocument();
      expect(screen.getByTestId('reports-section')).toBeInTheDocument();
      expect(screen.getByTestId('account-management-section')).toBeInTheDocument();
      expect(screen.getByTestId('suppliers-section')).toBeInTheDocument();

      // Should see all order actions
      expect(screen.getByTestId('create-order-btn')).toBeInTheDocument();
      expect(screen.getByTestId('edit-order-btn')).toBeInTheDocument();
      expect(screen.getByTestId('delete-order-btn')).toBeInTheDocument();

      // Should see all customer actions
      expect(screen.getByTestId('create-customer-btn')).toBeInTheDocument();
      expect(screen.getByTestId('edit-customer-btn')).toBeInTheDocument();
    });

    test('SUPERVISOR role navigation journey (inherits admin permissions)', () => {
      render(<MockApplication role={UserRole.SUPERVISOR} />);

      // Should see all navigation (same as admin, suppliers moved to Account Management)
      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('nav-orders')).toBeInTheDocument();
      expect(screen.getByTestId('nav-customers')).toBeInTheDocument();
      expect(screen.getByTestId('nav-fitters')).toBeInTheDocument();
      expect(screen.getByTestId('nav-reports')).toBeInTheDocument();

      // Should see all sections including Account Management with exclusive features
      expect(screen.getByTestId('orders-section')).toBeInTheDocument();
      expect(screen.getByTestId('customers-section')).toBeInTheDocument();
      expect(screen.getByTestId('fitters-section')).toBeInTheDocument();
      expect(screen.getByTestId('reports-section')).toBeInTheDocument();
      expect(screen.getByTestId('account-management-section')).toBeInTheDocument();
      expect(screen.getByTestId('suppliers-section')).toBeInTheDocument();
      expect(screen.getByTestId('users-section')).toBeInTheDocument();
      expect(screen.getByTestId('warehouses-section')).toBeInTheDocument();

      // Should see all actions (same as admin)
      expect(screen.getByTestId('create-order-btn')).toBeInTheDocument();
      expect(screen.getByTestId('edit-order-btn')).toBeInTheDocument();
      expect(screen.getByTestId('delete-order-btn')).toBeInTheDocument();
      expect(screen.getByTestId('create-customer-btn')).toBeInTheDocument();
      expect(screen.getByTestId('edit-customer-btn')).toBeInTheDocument();
    });
  });

  describe('Feature Access Workflows', () => {
    test('USER workflow: Can create orders but not manage them', () => {
      render(<MockApplication role={UserRole.USER} />);

      // Navigate to orders
      const ordersNav = screen.getByTestId('nav-orders');
      fireEvent.click(ordersNav);

      // Should see orders section
      expect(screen.getByTestId('orders-section')).toBeInTheDocument();
      
      // Can create orders
      expect(screen.getByTestId('create-order-btn')).toBeInTheDocument();
      
      // Cannot edit or delete orders
      expect(screen.queryByTestId('edit-order-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-order-btn')).not.toBeInTheDocument();

      // Should not have access to customers
      expect(screen.queryByTestId('customers-section')).not.toBeInTheDocument();
    });

    test('FITTER workflow: Can manage customers and create orders', () => {
      render(<MockApplication role={UserRole.FITTER} />);

      // Should have access to customers
      const customersNav = screen.getByTestId('nav-customers');
      fireEvent.click(customersNav);

      expect(screen.getByTestId('customers-section')).toBeInTheDocument();
      expect(screen.getByTestId('create-customer-btn')).toBeInTheDocument();
      expect(screen.getByTestId('edit-customer-btn')).toBeInTheDocument();

      // Should have limited order access
      expect(screen.getByTestId('orders-section')).toBeInTheDocument();
      expect(screen.getByTestId('create-order-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-order-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-order-btn')).not.toBeInTheDocument();
    });

    test('ADMIN workflow: Full system access', () => {
      render(<MockApplication role={UserRole.ADMIN} />);

      // Can access all main navigation (suppliers moved to Account Management)
      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('nav-orders')).toBeInTheDocument();
      expect(screen.getByTestId('nav-customers')).toBeInTheDocument();
      expect(screen.getByTestId('nav-fitters')).toBeInTheDocument();
      expect(screen.getByTestId('nav-reports')).toBeInTheDocument();

      // Full order management
      expect(screen.getByTestId('create-order-btn')).toBeInTheDocument();
      expect(screen.getByTestId('edit-order-btn')).toBeInTheDocument();
      expect(screen.getByTestId('delete-order-btn')).toBeInTheDocument();

      // Full customer management
      expect(screen.getByTestId('create-customer-btn')).toBeInTheDocument();
      expect(screen.getByTestId('edit-customer-btn')).toBeInTheDocument();

      // Suppliers accessible through Account Management section
      expect(screen.getByTestId('account-management-section')).toBeInTheDocument();
      expect(screen.getByTestId('suppliers-section')).toBeInTheDocument();

      // Administrative sections
      expect(screen.getByTestId('fitters-section')).toBeInTheDocument();
      expect(screen.getByTestId('reports-section')).toBeInTheDocument();
    });
  });

  describe('Role Escalation and Permission Hierarchy', () => {
    test('SUPERVISOR inherits all ADMIN permissions plus exclusive features', () => {
      const { rerender } = render(<MockApplication role={UserRole.ADMIN} />);

      // Capture admin interface
      const adminNavItems = screen.getAllByRole('button').map(btn => btn.textContent);
      const adminSections = screen.getAllByTestId(/section$/).map(section => section.dataset.testid);

      // Switch to supervisor
      rerender(<MockApplication role={UserRole.SUPERVISOR} />);

      // Should have same navigation items
      const supervisorNavItems = screen.getAllByRole('button').map(btn => btn.textContent);
      expect(supervisorNavItems).toEqual(adminNavItems);

      // Should have all admin sections plus exclusive supervisor sections
      const supervisorSections = screen.getAllByTestId(/section$/).map(section => section.dataset.testid);

      // SUPERVISOR should have all ADMIN sections
      adminSections.forEach(section => {
        expect(supervisorSections).toContain(section);
      });

      // SUPERVISOR should have exclusive sections
      expect(supervisorSections).toContain('users-section');
      expect(supervisorSections).toContain('warehouses-section');
    });

    test('Permission denials are consistent across roles', () => {
      const testCases = [
        {
          role: UserRole.USER,
          deniedFeatures: ['nav-customers', 'nav-fitters', 'nav-reports', 'edit-order-btn', 'delete-order-btn']
        },
        {
          role: UserRole.FITTER,
          deniedFeatures: ['nav-fitters', 'nav-reports', 'edit-order-btn', 'delete-order-btn']
        },
        {
          role: UserRole.SUPPLIER,
          deniedFeatures: ['nav-orders', 'nav-customers', 'nav-fitters', 'nav-reports', 'orders-section', 'customers-section', 'users-section', 'warehouses-section']
        }
      ];

      testCases.forEach(({ role, deniedFeatures }) => {
        const { unmount } = render(<MockApplication role={role} />);

        deniedFeatures.forEach(feature => {
          expect(screen.queryByTestId(feature)).not.toBeInTheDocument();
        });

        // Clean up to avoid duplicate test IDs in next iteration
        unmount();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles role changes gracefully', () => {
      const { rerender } = render(<MockApplication role={UserRole.USER} />);

      // Initially as USER
      expect(screen.getByTestId('nav-orders')).toBeInTheDocument();
      expect(screen.queryByTestId('nav-customers')).not.toBeInTheDocument();

      // Change to FITTER
      rerender(<MockApplication role={UserRole.FITTER} />);

      // Should now see customers
      expect(screen.getByTestId('nav-orders')).toBeInTheDocument();
      expect(screen.getByTestId('nav-customers')).toBeInTheDocument();

      // Change to SUPPLIER
      rerender(<MockApplication role={UserRole.SUPPLIER} />);

      // Should see different navigation (suppliers now in Account Management)
      expect(screen.queryByTestId('nav-orders')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-customers')).not.toBeInTheDocument();
      expect(screen.getByTestId('account-management-section')).toBeInTheDocument();
      expect(screen.getByTestId('suppliers-section')).toBeInTheDocument();
    });

    test('handles logout gracefully', () => {
      const { rerender } = render(<MockApplication role={UserRole.ADMIN} />);

      // Initially authenticated with full access
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated as ROLE_ADMIN');
      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();

      // Logout
      rerender(<MockApplication role={null} />);

      // Should show unauthenticated state
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not authenticated');
      expect(screen.getByTestId('access-denied')).toBeInTheDocument();
      expect(screen.queryByTestId('nav-dashboard')).not.toBeInTheDocument();
    });
  });
});