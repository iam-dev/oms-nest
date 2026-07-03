import React from 'react';
import { render, screen } from '@testing-library/react';
import { RoleProtectedComponent } from '@/components/shared/RoleProtectedComponent';
import { UserRole } from '@/types/Role';
import { getAllRoles } from '../../utils/roleTestHelpers';
import * as useUserRoleModule from '@/hooks/useUserRole';
import * as rolePermissionsModule from '@/utils/rolePermissions';

// Mock the useUserRole hook
jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: jest.fn()
}));

// Mock the hasScreenPermission function
jest.mock('@/utils/rolePermissions', () => ({
  hasScreenPermission: jest.fn(),
  SCREEN_PERMISSIONS: {
    DASHBOARD: 'DASHBOARD',
    ORDERS: 'ORDERS',
    CUSTOMERS: 'CUSTOMERS',
    FITTERS: 'FITTERS',
    REPORTS: 'REPORTS',
    ORDER_CREATE: 'ORDER_CREATE',
    ORDER_EDIT: 'ORDER_EDIT'
  }
}));

const mockUseUserRole = useUserRoleModule.useUserRole as jest.Mock;
const mockHasScreenPermission = rolePermissionsModule.hasScreenPermission as jest.Mock;

describe('RoleProtectedComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders children when no restrictions specified', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn()
      });

      render(
        <RoleProtectedComponent>
          <div>Test Content</div>
        </RoleProtectedComponent>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    test('renders children when user has access', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: jest.fn()
      });
      mockHasScreenPermission.mockReturnValue(true);

      render(
        <RoleProtectedComponent requiredPermission="ORDERS">
          <div>Orders Content</div>
        </RoleProtectedComponent>
      );

      expect(screen.getByText('Orders Content')).toBeInTheDocument();
    });

    test('does not render children when user lacks access', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn()
      });
      mockHasScreenPermission.mockReturnValue(false);

      render(
        <RoleProtectedComponent requiredPermission="FITTERS">
          <div>Fitters Content</div>
        </RoleProtectedComponent>
      );

      expect(screen.queryByText('Fitters Content')).not.toBeInTheDocument();
    });
  });

  describe('Permission-based Protection', () => {
    test('calls hasScreenPermission with correct parameters', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: jest.fn()
      });
      mockHasScreenPermission.mockReturnValue(true);

      render(
        <RoleProtectedComponent requiredPermission="CUSTOMERS">
          <div>Customer Content</div>
        </RoleProtectedComponent>
      );

      expect(mockHasScreenPermission).toHaveBeenCalledWith(UserRole.ADMIN, 'CUSTOMERS');
    });

    getAllRoles().forEach(role => {
      test(`handles ${role} role with permission checks`, () => {
        const mockHasRole = jest.fn();
        mockUseUserRole.mockReturnValue({
          role,
          hasRole: mockHasRole
        });

        // Mock different permission results for different roles
        mockHasScreenPermission.mockImplementation((userRole, permission) => {
          if (permission === 'DASHBOARD') return true; // All roles have dashboard access
          if (permission === 'ORDERS') {
            return [UserRole.USER, UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR].includes(userRole);
          }
          if (permission === 'FITTERS') {
            return [UserRole.ADMIN, UserRole.SUPERVISOR].includes(userRole);
          }
          return false;
        });

        // Test dashboard access (should work for all roles)
        const { rerender } = render(
          <RoleProtectedComponent requiredPermission="DASHBOARD">
            <div>Dashboard Content</div>
          </RoleProtectedComponent>
        );
        expect(screen.getByText('Dashboard Content')).toBeInTheDocument();

        // Test orders access
        rerender(
          <RoleProtectedComponent requiredPermission="ORDERS">
            <div>Orders Content</div>
          </RoleProtectedComponent>
        );
        
        const shouldHaveOrdersAccess = [UserRole.USER, UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR].includes(role);
        if (shouldHaveOrdersAccess) {
          expect(screen.getByText('Orders Content')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('Orders Content')).not.toBeInTheDocument();
        }

        // Test fitters access (admin only)
        rerender(
          <RoleProtectedComponent requiredPermission="FITTERS">
            <div>Fitters Content</div>
          </RoleProtectedComponent>
        );
        
        const shouldHaveFittersAccess = [UserRole.ADMIN, UserRole.SUPERVISOR].includes(role);
        if (shouldHaveFittersAccess) {
          expect(screen.getByText('Fitters Content')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('Fitters Content')).not.toBeInTheDocument();
        }
      });
    });
  });

  describe('Role-based Protection', () => {
    test('checks single required role', () => {
      const mockHasRole = jest.fn().mockReturnValue(true);
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: mockHasRole
      });

      render(
        <RoleProtectedComponent requiredRole={UserRole.ADMIN}>
          <div>Admin Content</div>
        </RoleProtectedComponent>
      );

      expect(mockHasRole).toHaveBeenCalledWith(UserRole.ADMIN);
      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });

    test('checks multiple required roles', () => {
      const mockHasRole = jest.fn().mockReturnValue(true);
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: mockHasRole
      });

      const requiredRoles = [UserRole.ADMIN, UserRole.SUPERVISOR];
      render(
        <RoleProtectedComponent requiredRole={requiredRoles}>
          <div>Admin/Supervisor Content</div>
        </RoleProtectedComponent>
      );

      expect(mockHasRole).toHaveBeenCalledWith(requiredRoles);
      expect(screen.getByText('Admin/Supervisor Content')).toBeInTheDocument();
    });

    test('denies access when role check fails', () => {
      const mockHasRole = jest.fn().mockReturnValue(false);
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: mockHasRole
      });

      render(
        <RoleProtectedComponent requiredRole={UserRole.ADMIN}>
          <div>Admin Content</div>
        </RoleProtectedComponent>
      );

      expect(mockHasRole).toHaveBeenCalledWith(UserRole.ADMIN);
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });
  });

  describe('Custom Check Function', () => {
    test('uses custom check when provided', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn()
      });

      const customCheck = jest.fn().mockReturnValue(true);
      
      render(
        <RoleProtectedComponent customCheck={customCheck}>
          <div>Custom Content</div>
        </RoleProtectedComponent>
      );

      expect(customCheck).toHaveBeenCalledWith(UserRole.USER);
      expect(screen.getByText('Custom Content')).toBeInTheDocument();
    });

    test('custom check takes precedence over other checks', () => {
      const mockHasRole = jest.fn();
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: mockHasRole
      });

      const customCheck = jest.fn().mockReturnValue(false);
      
      render(
        <RoleProtectedComponent 
          requiredPermission="DASHBOARD" 
          requiredRole={UserRole.USER}
          customCheck={customCheck}
        >
          <div>Custom Content</div>
        </RoleProtectedComponent>
      );

      expect(customCheck).toHaveBeenCalledWith(UserRole.USER);
      expect(mockHasRole).not.toHaveBeenCalled();
      expect(mockHasScreenPermission).not.toHaveBeenCalled();
      expect(screen.queryByText('Custom Content')).not.toBeInTheDocument();
    });

    test('custom check receives null role', () => {
      mockUseUserRole.mockReturnValue({
        role: null,
        hasRole: jest.fn()
      });

      const customCheck = jest.fn().mockReturnValue(false);
      
      render(
        <RoleProtectedComponent customCheck={customCheck}>
          <div>Custom Content</div>
        </RoleProtectedComponent>
      );

      expect(customCheck).toHaveBeenCalledWith(null);
      expect(screen.queryByText('Custom Content')).not.toBeInTheDocument();
    });
  });

  describe('Fallback Content', () => {
    test('shows fallback when access is denied', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn().mockReturnValue(false)
      });

      render(
        <RoleProtectedComponent 
          requiredRole={UserRole.ADMIN}
          fallback={<div>Access Denied</div>}
        >
          <div>Admin Content</div>
        </RoleProtectedComponent>
      );

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    test('does not show fallback when access is granted', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: jest.fn().mockReturnValue(true)
      });

      render(
        <RoleProtectedComponent 
          requiredRole={UserRole.ADMIN}
          fallback={<div>Access Denied</div>}
        >
          <div>Admin Content</div>
        </RoleProtectedComponent>
      );

      expect(screen.getByText('Admin Content')).toBeInTheDocument();
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });

    test('shows complex fallback content', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn().mockReturnValue(false)
      });

      render(
        <RoleProtectedComponent 
          requiredRole={UserRole.ADMIN}
          fallback={
            <div>
              <h3>Insufficient Permissions</h3>
              <p>You need admin privileges to view this content.</p>
            </div>
          }
        >
          <div>Admin Content</div>
        </RoleProtectedComponent>
      );

      expect(screen.getByText('Insufficient Permissions')).toBeInTheDocument();
      expect(screen.getByText('You need admin privileges to view this content.')).toBeInTheDocument();
    });
  });

  describe('Hide When Denied', () => {
    test('hides completely when hideWhenDenied is true', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn().mockReturnValue(false)
      });

      render(
        <RoleProtectedComponent 
          requiredRole={UserRole.ADMIN}
          fallback={<div>Access Denied</div>}
          hideWhenDenied={true}
        >
          <div>Admin Content</div>
        </RoleProtectedComponent>
      );

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });

    test('shows fallback when hideWhenDenied is false', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn().mockReturnValue(false)
      });

      render(
        <RoleProtectedComponent 
          requiredRole={UserRole.ADMIN}
          fallback={<div>Access Denied</div>}
          hideWhenDenied={false}
        >
          <div>Admin Content</div>
        </RoleProtectedComponent>
      );

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    test('Order action buttons based on role', () => {
      const testScenarios = [
        {
          role: UserRole.USER,
          shouldShowCreate: true,
          shouldShowEdit: false,
          shouldShowDelete: false
        },
        {
          role: UserRole.ADMIN,
          shouldShowCreate: true,
          shouldShowEdit: true,
          shouldShowDelete: true
        },
        {
          role: UserRole.SUPPLIER,
          shouldShowCreate: false,
          shouldShowEdit: false,
          shouldShowDelete: false
        }
      ];

      testScenarios.forEach(({ role, shouldShowCreate, shouldShowEdit, shouldShowDelete }) => {
        mockUseUserRole.mockReturnValue({
          role,
          hasRole: jest.fn()
        });

        mockHasScreenPermission.mockImplementation((userRole, permission) => {
          if (permission === 'ORDER_CREATE') {
            return [UserRole.USER, UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR].includes(userRole);
          }
          if (permission === 'ORDER_EDIT' || permission === 'ORDER_DELETE') {
            return [UserRole.ADMIN, UserRole.SUPERVISOR].includes(userRole);
          }
          return false;
        });

        const { unmount } = render(
          <div>
            <RoleProtectedComponent requiredPermission="ORDER_CREATE">
              <button>Create Order</button>
            </RoleProtectedComponent>
            <RoleProtectedComponent requiredPermission="ORDER_EDIT">
              <button>Edit Order</button>
            </RoleProtectedComponent>
            <RoleProtectedComponent requiredPermission="ORDER_DELETE">
              <button>Delete Order</button>
            </RoleProtectedComponent>
          </div>
        );

        if (shouldShowCreate) {
          expect(screen.getAllByText('Create Order').length).toBeGreaterThan(0);
        } else {
          expect(screen.queryByText('Create Order')).toBeNull();
        }

        if (shouldShowEdit) {
          expect(screen.getByText('Edit Order')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('Edit Order')).not.toBeInTheDocument();
        }

        if (shouldShowDelete) {
          expect(screen.getByText('Delete Order')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('Delete Order')).not.toBeInTheDocument();
        }

        unmount();
      });
    });

    test('Navigation menu filtering', () => {
      const navigationScenarios = [
        {
          role: UserRole.USER,
          expectedItems: ['Dashboard', 'Orders']
        },
        {
          role: UserRole.FITTER,
          expectedItems: ['Dashboard', 'Orders', 'Customers']
        },
        {
          role: UserRole.ADMIN,
          expectedItems: ['Dashboard', 'Orders', 'Customers', 'Fitters', 'Reports']
        },
        {
          role: UserRole.SUPPLIER,
          expectedItems: ['Dashboard']
        }
      ];

      navigationScenarios.forEach(({ role, expectedItems }) => {
        mockUseUserRole.mockReturnValue({
          role,
          hasRole: jest.fn()
        });

        mockHasScreenPermission.mockImplementation((userRole, permission) => {
          const rolePermissions: Record<string, string[]> = {
            [UserRole.USER]: ['DASHBOARD', 'ORDERS'],
            [UserRole.FITTER]: ['DASHBOARD', 'ORDERS', 'CUSTOMERS'],
            [UserRole.ADMIN]: ['DASHBOARD', 'ORDERS', 'CUSTOMERS', 'FITTERS', 'REPORTS'],
            [UserRole.SUPPLIER]: ['DASHBOARD'],
            [UserRole.SUPERVISOR]: ['DASHBOARD', 'ORDERS', 'CUSTOMERS', 'FITTERS', 'REPORTS']
          };

          return rolePermissions[userRole]?.includes(permission) || false;
        });

        const { unmount } = render(
          <nav>
            <RoleProtectedComponent requiredPermission="DASHBOARD">
              <a href="/dashboard">Dashboard</a>
            </RoleProtectedComponent>
            <RoleProtectedComponent requiredPermission="ORDERS">
              <a href="/orders">Orders</a>
            </RoleProtectedComponent>
            <RoleProtectedComponent requiredPermission="CUSTOMERS">
              <a href="/customers">Customers</a>
            </RoleProtectedComponent>
            <RoleProtectedComponent requiredPermission="FITTERS">
              <a href="/fitters">Fitters</a>
            </RoleProtectedComponent>
            <RoleProtectedComponent requiredPermission="REPORTS">
              <a href="/reports">Reports</a>
            </RoleProtectedComponent>
          </nav>
        );

        const allItems = ['Dashboard', 'Orders', 'Customers', 'Fitters', 'Reports'];

        allItems.forEach(item => {
          if (expectedItems.includes(item)) {
            expect(screen.getAllByText(item).length).toBeGreaterThan(0);
          } else {
            expect(screen.queryByText(item)).toBeNull();
          }
        });

        unmount();
      });
    });
  });
});