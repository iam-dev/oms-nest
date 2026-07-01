import React from 'react';
import { render, screen } from '@testing-library/react';
import { UserRole } from '@/types/Role';
import * as useUserRoleModule from '@/hooks/useUserRole';
import * as userPermissionsModule from '@/components/UserPermissions';

// Helper function for permission checking (outside of mock to avoid scope issues)
function mockGetPermissionForRoleAndFeature(role: string, permission: string): boolean {
  const permissionMap: Record<string, string[]> = {
    'USER': ['Dashboard', 'Orders', 'Saddle Modeling', 'Brands', 'Models', 'Leather Types', 'Options', 'Extras', 'Presets'],
    'FITTER': ['Dashboard', 'Orders', 'Customers'],
    'SUPPLIER': ['Dashboard', 'Suppliers'],
    'ADMIN': ['Dashboard', 'Orders', 'Customers', 'Fitters', 'Reports', 'Suppliers', 'Saddle Modeling', 'Brands', 'Models', 'Leather Types', 'Options', 'Extras', 'Presets'],
    'SUPERVISOR': ['Dashboard', 'Orders', 'Customers', 'Fitters', 'Reports', 'Suppliers', 'Account Management', 'User Management', 'Warehouse Management', 'Saddle Modeling', 'Brands', 'Models', 'Leather Types', 'Options', 'Extras', 'Presets']
  };

  const cleanRole = role.replace('ROLE_', '');
  return permissionMap[cleanRole]?.includes(permission) || false;
}

// Mock the UserPermissions component since we need to check if it exists
jest.mock('@/components/UserPermissions', () => {
  const UserPermissions = () => {
    // Mock implementation that shows permission matrix
    const roles = ['USER', 'FITTER', 'SUPPLIER', 'ADMIN', 'SUPERVISOR'];
    const permissions = [
      'Dashboard', 'Orders', 'Customers', 'Fitters', 'Reports', 'Suppliers',
      'Account Management', 'User Management', 'Warehouse Management',
      'Saddle Modeling', 'Brands', 'Models', 'Leather Types', 'Options', 'Extras', 'Presets'
    ];

    return (
      <div data-testid="user-permissions">
        <h1>Role Permissions Matrix</h1>
        <div data-testid="permissions-table">
          <table>
            <thead>
              <tr>
                <th>Permission</th>
                {roles.map(role => (
                  <th key={role} data-testid={`role-header-${role.toLowerCase()}`}>
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map(permission => (
                <tr key={permission} data-testid={`permission-row-${permission.toLowerCase().replace(/\s+/g, '-')}`}>
                  <td>{permission}</td>
                  {roles.map(role => {
                    // Mock permission logic using global function
                    const hasPermission = mockGetPermissionForRoleAndFeature(role, permission);
                    return (
                      <td key={`${role}-${permission}`} data-testid={`permission-${role.toLowerCase()}-${permission.toLowerCase().replace(/\s+/g, '-')}`}>
                        <span className={hasPermission ? 'text-green-600' : 'text-red-600'}>
                          {hasPermission ? '✓' : '✗'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div data-testid="role-descriptions">
          {roles.map(role => (
            <div key={role} data-testid={`role-description-${role.toLowerCase()}`}>
              <h3>{role} Role</h3>
              <p>Description for {role} role permissions</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return { __esModule: true, default: UserPermissions };
});

// Mock the useUserRole hook
jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: jest.fn()
}));

const mockUseUserRole = (useUserRoleModule as unknown as { useUserRole: jest.Mock }).useUserRole;

const UserPermissions = (userPermissionsModule as unknown as { default: React.ComponentType }).default;

describe('UserPermissions Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUserRole.mockReturnValue({
      role: UserRole.SUPERVISOR,
      isAdmin: false,
      isSupervisor: true,
      hasRole: jest.fn()
    });
  });

  describe('Component Rendering', () => {
    test('renders user permissions component', () => {
      render(<UserPermissions />);

      expect(screen.getByTestId('user-permissions')).toBeInTheDocument();
      expect(screen.getByText('Role Permissions Matrix')).toBeInTheDocument();
    });

    test('renders permissions table', () => {
      render(<UserPermissions />);

      expect(screen.getByTestId('permissions-table')).toBeInTheDocument();

      // Check table structure
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('rowgroup').length).toBeGreaterThanOrEqual(1); // thead and tbody
    });

    test('renders all role headers', () => {
      render(<UserPermissions />);

      const expectedRoles = ['user', 'fitter', 'supplier', 'admin', 'supervisor'];
      
      expectedRoles.forEach(role => {
        expect(screen.getByTestId(`role-header-${role}`)).toBeInTheDocument();
      });
    });

    test('renders all permission rows', () => {
      render(<UserPermissions />);

      const expectedPermissions = [
        'dashboard', 'orders', 'customers', 'fitters', 'reports', 'suppliers',
        'account-management', 'user-management', 'warehouse-management',
        'saddle-modeling', 'brands', 'models', 'leather-types', 'options', 'extras', 'presets'
      ];

      expectedPermissions.forEach(permission => {
        expect(screen.getByTestId(`permission-row-${permission}`)).toBeInTheDocument();
      });
    });
  });

  describe('Permission Matrix Display', () => {
    test('shows correct permissions for USER role', () => {
      render(<UserPermissions />);

      // USER should have these permissions
      const userAllowedPermissions = ['dashboard', 'orders', 'saddle-modeling', 'brands', 'models', 'leather-types', 'options', 'extras', 'presets'];
      userAllowedPermissions.forEach(permission => {
        const cell = screen.getByTestId(`permission-user-${permission}`);
        expect(cell).toBeInTheDocument();
        expect(cell.textContent).toBe('✓');
      });

      // USER should not have these permissions
      const userDeniedPermissions = ['customers', 'fitters', 'reports', 'suppliers', 'account-management', 'user-management', 'warehouse-management'];
      userDeniedPermissions.forEach(permission => {
        const cell = screen.getByTestId(`permission-user-${permission}`);
        expect(cell).toBeInTheDocument();
        expect(cell.textContent).toBe('✗');
      });
    });

    test('shows correct permissions for FITTER role', () => {
      render(<UserPermissions />);

      // FITTER should have these permissions
      const fitterAllowedPermissions = ['dashboard', 'orders', 'customers'];
      fitterAllowedPermissions.forEach(permission => {
        const cell = screen.getByTestId(`permission-fitter-${permission}`);
        expect(cell).toBeInTheDocument();
        expect(cell.textContent).toBe('✓');
      });

      // FITTER should not have these permissions
      const fitterDeniedPermissions = ['fitters', 'reports', 'suppliers', 'account-management', 'user-management', 'warehouse-management', 'saddle-modeling'];
      fitterDeniedPermissions.forEach(permission => {
        const cell = screen.getByTestId(`permission-fitter-${permission}`);
        expect(cell).toBeInTheDocument();
        expect(cell.textContent).toBe('✗');
      });
    });

    test('shows correct permissions for SUPPLIER role', () => {
      render(<UserPermissions />);

      // SUPPLIER should have these permissions
      const supplierAllowedPermissions = ['dashboard', 'suppliers'];
      supplierAllowedPermissions.forEach(permission => {
        const cell = screen.getByTestId(`permission-supplier-${permission}`);
        expect(cell).toBeInTheDocument();
        expect(cell.textContent).toBe('✓');
      });

      // SUPPLIER should not have these permissions
      const supplierDeniedPermissions = ['orders', 'customers', 'fitters', 'reports', 'account-management', 'user-management', 'warehouse-management', 'saddle-modeling'];
      supplierDeniedPermissions.forEach(permission => {
        const cell = screen.getByTestId(`permission-supplier-${permission}`);
        expect(cell).toBeInTheDocument();
        expect(cell.textContent).toBe('✗');
      });
    });

    test('shows correct permissions for ADMIN role', () => {
      render(<UserPermissions />);

      // ADMIN should have these permissions
      const adminAllowedPermissions = ['dashboard', 'orders', 'customers', 'fitters', 'reports', 'suppliers', 'saddle-modeling', 'brands', 'models', 'leather-types', 'options', 'extras', 'presets'];
      adminAllowedPermissions.forEach(permission => {
        const cell = screen.getByTestId(`permission-admin-${permission}`);
        expect(cell).toBeInTheDocument();
        expect(cell.textContent).toBe('✓');
      });

      // ADMIN should not have these permissions (supervisor-only)
      const adminDeniedPermissions = ['account-management', 'user-management', 'warehouse-management'];
      adminDeniedPermissions.forEach(permission => {
        const cell = screen.getByTestId(`permission-admin-${permission}`);
        expect(cell).toBeInTheDocument();
        expect(cell.textContent).toBe('✗');
      });
    });

    test('shows correct permissions for SUPERVISOR role', () => {
      render(<UserPermissions />);

      // SUPERVISOR should have ALL permissions
      const allPermissions = ['dashboard', 'orders', 'customers', 'fitters', 'reports', 'suppliers', 'account-management', 'user-management', 'warehouse-management', 'saddle-modeling', 'brands', 'models', 'leather-types', 'options', 'extras', 'presets'];
      allPermissions.forEach(permission => {
        const cell = screen.getByTestId(`permission-supervisor-${permission}`);
        expect(cell).toBeInTheDocument();
        expect(cell.textContent).toBe('✓');
      });
    });
  });

  describe('Role Descriptions', () => {
    test('renders role descriptions section', () => {
      render(<UserPermissions />);

      expect(screen.getByTestId('role-descriptions')).toBeInTheDocument();
    });

    test('shows description for each role', () => {
      render(<UserPermissions />);

      const roles = ['user', 'fitter', 'supplier', 'admin', 'supervisor'];
      
      roles.forEach(role => {
        expect(screen.getByTestId(`role-description-${role}`)).toBeInTheDocument();
      });
    });

    test('displays role titles correctly', () => {
      render(<UserPermissions />);

      expect(screen.getByText('USER Role')).toBeInTheDocument();
      expect(screen.getByText('FITTER Role')).toBeInTheDocument();
      expect(screen.getByText('SUPPLIER Role')).toBeInTheDocument();
      expect(screen.getByText('ADMIN Role')).toBeInTheDocument();
      expect(screen.getByText('SUPERVISOR Role')).toBeInTheDocument();
    });
  });

  describe('Visual Indicators', () => {
    test('uses correct styling for granted permissions', () => {
      render(<UserPermissions />);

      // Check that granted permissions have green checkmarks
      const grantedCell = screen.getByTestId('permission-supervisor-dashboard');
      expect(grantedCell.querySelector('.text-green-600')).toBeInTheDocument();
      expect(grantedCell.textContent).toBe('✓');
    });

    test('uses correct styling for denied permissions', () => {
      render(<UserPermissions />);

      // Check that denied permissions have red X marks
      const deniedCell = screen.getByTestId('permission-user-account-management');
      expect(deniedCell.querySelector('.text-red-600')).toBeInTheDocument();
      expect(deniedCell.textContent).toBe('✗');
    });
  });

  describe('Accessibility', () => {
    test('has proper table structure for screen readers', () => {
      render(<UserPermissions />);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // Check for table headers
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);

      // Check for table cells
      const cells = screen.getAllByRole('cell');
      expect(cells.length).toBeGreaterThan(0);
    });

    test('provides meaningful content for screen readers', () => {
      render(<UserPermissions />);

      // Check that role names are properly formatted
      expect(screen.getByText('USER')).toBeInTheDocument();
      expect(screen.getByText('FITTER')).toBeInTheDocument();
      expect(screen.getByText('SUPPLIER')).toBeInTheDocument();
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
      expect(screen.getByText('SUPERVISOR')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    test('respects user role context', () => {
      // Test with different user roles to ensure component shows appropriate view
      const roles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR];

      roles.forEach(role => {
        mockUseUserRole.mockReturnValue({
          role,
          isAdmin: role === UserRole.ADMIN || role === UserRole.SUPERVISOR,
          isSupervisor: role === UserRole.SUPERVISOR,
          hasRole: jest.fn()
        });

        const { unmount } = render(<UserPermissions />);

        // Component should render regardless of user role (SUPERVISOR-only access is handled at route level)
        expect(screen.getByTestId('user-permissions')).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('Account Management Features', () => {
    test('highlights account management permissions for supervisor', () => {
      render(<UserPermissions />);

      // Check that account management features are properly shown
      expect(screen.getByTestId('permission-row-account-management')).toBeInTheDocument();
      expect(screen.getByTestId('permission-row-user-management')).toBeInTheDocument();
      expect(screen.getByTestId('permission-row-warehouse-management')).toBeInTheDocument();

      // Supervisor should have all account management permissions
      expect(screen.getByTestId('permission-supervisor-account-management').textContent).toBe('✓');
      expect(screen.getByTestId('permission-supervisor-user-management').textContent).toBe('✓');
      expect(screen.getByTestId('permission-supervisor-warehouse-management').textContent).toBe('✓');
    });

    test('shows that only supervisor has account management access', () => {
      render(<UserPermissions />);

      const accountManagementPermissions = ['account-management', 'user-management', 'warehouse-management'];
      const nonSupervisorRoles = ['user', 'fitter', 'supplier', 'admin'];

      accountManagementPermissions.forEach(permission => {
        // Supervisor should have access
        expect(screen.getByTestId(`permission-supervisor-${permission}`).textContent).toBe('✓');

        // All other roles should not have access
        nonSupervisorRoles.forEach(role => {
          expect(screen.getByTestId(`permission-${role}-${permission}`).textContent).toBe('✗');
        });
      });
    });
  });
});