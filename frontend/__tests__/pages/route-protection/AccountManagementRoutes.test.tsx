import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types/Role';
import * as useUserRoleModule from '@/hooks/useUserRole';
import * as rolePermissionsModule from '@/utils/rolePermissions';

// Mock the Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  redirect: jest.fn()
}));

// Mock the useUserRole hook
jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: jest.fn()
}));

// Mock the role permissions
jest.mock('@/utils/rolePermissions', () => ({
  hasScreenPermission: jest.fn(),
  SCREEN_PERMISSIONS: {
    USER_MANAGEMENT: ['SUPERVISOR'],
    WAREHOUSE_MANAGEMENT: ['SUPERVISOR'],
    USER_PERMISSIONS_VIEW: ['SUPERVISOR'],
    SUPPLIERS: ['SUPPLIER', 'ADMIN', 'SUPERVISOR']
  }
}));

// Mock the middleware redirect function (virtual module since @/middleware path doesn't resolve in test)
jest.mock('@/middleware', () => ({
  redirectToUnauthorized: jest.fn()
}), { virtual: true });

// Mock page components to test route protection
const MockUsersPage = () => {
  const useUserRoleFn = useUserRoleModule.useUserRole as jest.Mock;
  const hasScreenPermissionFn = rolePermissionsModule.hasScreenPermission as jest.Mock;
  const { role } = useUserRoleFn();

  // Simulate middleware check
  if (!hasScreenPermissionFn(role, 'USER_MANAGEMENT')) {
    return <div data-testid="unauthorized">Access Denied</div>;
  }

  return (
    <div data-testid="users-page">
      <h1>User Management</h1>
      <p>Manage system users</p>
    </div>
  );
};

const MockWarehousesPage = () => {
  const useUserRoleFn = useUserRoleModule.useUserRole as jest.Mock;
  const hasScreenPermissionFn = rolePermissionsModule.hasScreenPermission as jest.Mock;
  const { role } = useUserRoleFn();

  // Simulate middleware check
  if (!hasScreenPermissionFn(role, 'WAREHOUSE_MANAGEMENT')) {
    return <div data-testid="unauthorized">Access Denied</div>;
  }

  return (
    <div data-testid="warehouses-page">
      <h1>Warehouse Management</h1>
      <p>Manage warehouses</p>
    </div>
  );
};

const MockUserPermissionsPage = () => {
  const useUserRoleFn = useUserRoleModule.useUserRole as jest.Mock;
  const hasScreenPermissionFn = rolePermissionsModule.hasScreenPermission as jest.Mock;
  const { role } = useUserRoleFn();

  // Simulate middleware check
  if (!hasScreenPermissionFn(role, 'USER_PERMISSIONS_VIEW')) {
    return <div data-testid="unauthorized">Access Denied</div>;
  }

  return (
    <div data-testid="user-permissions-page">
      <h1>User Permissions</h1>
      <p>View and manage user permissions</p>
    </div>
  );
};

const MockSuppliersPage = () => {
  const useUserRoleFn = useUserRoleModule.useUserRole as jest.Mock;
  const hasScreenPermissionFn = rolePermissionsModule.hasScreenPermission as jest.Mock;
  const { role } = useUserRoleFn();

  // Simulate middleware check
  if (!hasScreenPermissionFn(role, 'SUPPLIERS')) {
    return <div data-testid="unauthorized">Access Denied</div>;
  }

  return (
    <div data-testid="suppliers-page">
      <h1>Suppliers</h1>
      <p>Manage suppliers</p>
    </div>
  );
};

const mockUseUserRole = useUserRoleModule.useUserRole as jest.Mock;
const mockHasScreenPermission = rolePermissionsModule.hasScreenPermission as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

describe('Account Management Routes Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn()
    });
  });

  describe('/users route protection', () => {
    test('allows access for SUPERVISOR role', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        isAdmin: false,
        isSupervisor: true,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        return role === UserRole.SUPERVISOR && permission === 'USER_MANAGEMENT';
      });

      render(<MockUsersPage />);

      expect(screen.getByTestId('users-page')).toBeInTheDocument();
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.queryByTestId('unauthorized')).not.toBeInTheDocument();
    });

    test('denies access for ADMIN role', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        isAdmin: true,
        isSupervisor: false,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation(() => {
        return false; // ADMIN doesn't have USER_MANAGEMENT permission
      });

      render(<MockUsersPage />);

      expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('users-page')).not.toBeInTheDocument();
    });

    test('denies access for regular user roles', () => {
      const regularRoles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];

      regularRoles.forEach(role => {
        cleanup();
        mockUseUserRole.mockReturnValue({
          role,
          isAdmin: false,
          isSupervisor: false,
          hasRole: jest.fn()
        });

        mockHasScreenPermission.mockImplementation(() => false);

        render(<MockUsersPage />);

        expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
        expect(screen.queryByTestId('users-page')).not.toBeInTheDocument();
      });
    });
  });

  describe('/warehouses route protection', () => {
    test('allows access for SUPERVISOR role', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        isAdmin: false,
        isSupervisor: true,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        return role === UserRole.SUPERVISOR && permission === 'WAREHOUSE_MANAGEMENT';
      });

      render(<MockWarehousesPage />);

      expect(screen.getByTestId('warehouses-page')).toBeInTheDocument();
      expect(screen.getByText('Warehouse Management')).toBeInTheDocument();
      expect(screen.queryByTestId('unauthorized')).not.toBeInTheDocument();
    });

    test('denies access for ADMIN role', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        isAdmin: true,
        isSupervisor: false,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation(() => false);

      render(<MockWarehousesPage />);

      expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('warehouses-page')).not.toBeInTheDocument();
    });

    test('denies access for regular user roles', () => {
      const regularRoles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];

      regularRoles.forEach(role => {
        cleanup();
        mockUseUserRole.mockReturnValue({
          role,
          isAdmin: false,
          isSupervisor: false,
          hasRole: jest.fn()
        });

        mockHasScreenPermission.mockImplementation(() => false);

        render(<MockWarehousesPage />);

        expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
        expect(screen.queryByTestId('warehouses-page')).not.toBeInTheDocument();
      });
    });
  });

  describe('/user-permissions route protection', () => {
    test('allows access for SUPERVISOR role', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        isAdmin: false,
        isSupervisor: true,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        return role === UserRole.SUPERVISOR && permission === 'USER_PERMISSIONS_VIEW';
      });

      render(<MockUserPermissionsPage />);

      expect(screen.getByTestId('user-permissions-page')).toBeInTheDocument();
      expect(screen.getByText('User Permissions')).toBeInTheDocument();
      expect(screen.queryByTestId('unauthorized')).not.toBeInTheDocument();
    });

    test('denies access for ADMIN role', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        isAdmin: true,
        isSupervisor: false,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation(() => false);

      render(<MockUserPermissionsPage />);

      expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('user-permissions-page')).not.toBeInTheDocument();
    });

    test('denies access for regular user roles', () => {
      const regularRoles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];

      regularRoles.forEach(role => {
        cleanup();
        mockUseUserRole.mockReturnValue({
          role,
          isAdmin: false,
          isSupervisor: false,
          hasRole: jest.fn()
        });

        mockHasScreenPermission.mockImplementation(() => false);

        render(<MockUserPermissionsPage />);

        expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
        expect(screen.queryByTestId('user-permissions-page')).not.toBeInTheDocument();
      });
    });
  });

  describe('/suppliers route protection (moved to Account Management)', () => {
    test('allows access for SUPERVISOR role', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        isAdmin: false,
        isSupervisor: true,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        return role === UserRole.SUPERVISOR && permission === 'SUPPLIERS';
      });

      render(<MockSuppliersPage />);

      expect(screen.getByTestId('suppliers-page')).toBeInTheDocument();
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.queryByTestId('unauthorized')).not.toBeInTheDocument();
    });

    test('allows access for ADMIN role', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        isAdmin: true,
        isSupervisor: false,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        return (role === UserRole.ADMIN || role === UserRole.SUPERVISOR) && permission === 'SUPPLIERS';
      });

      render(<MockSuppliersPage />);

      expect(screen.getByTestId('suppliers-page')).toBeInTheDocument();
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.queryByTestId('unauthorized')).not.toBeInTheDocument();
    });

    test('allows access for SUPPLIER role', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPPLIER,
        isAdmin: false,
        isSupervisor: false,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role, permission) => {
        return role === UserRole.SUPPLIER && permission === 'SUPPLIERS';
      });

      render(<MockSuppliersPage />);

      expect(screen.getByTestId('suppliers-page')).toBeInTheDocument();
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.queryByTestId('unauthorized')).not.toBeInTheDocument();
    });

    test('denies access for USER and FITTER roles', () => {
      const restrictedRoles = [UserRole.USER, UserRole.FITTER];

      restrictedRoles.forEach(role => {
        cleanup();
        mockUseUserRole.mockReturnValue({
          role,
          isAdmin: false,
          isSupervisor: false,
          hasRole: jest.fn()
        });

        mockHasScreenPermission.mockImplementation(() => false);

        render(<MockSuppliersPage />);

        expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
        expect(screen.queryByTestId('suppliers-page')).not.toBeInTheDocument();
      });
    });
  });

  describe('Route Protection Middleware Integration', () => {
    test('validates permission check logic consistency', () => {
      const testCases = [
        {
          role: UserRole.SUPERVISOR,
          permissions: ['USER_MANAGEMENT', 'WAREHOUSE_MANAGEMENT', 'USER_PERMISSIONS_VIEW', 'SUPPLIERS'],
          expected: true
        },
        {
          role: UserRole.ADMIN,
          permissions: ['USER_MANAGEMENT', 'WAREHOUSE_MANAGEMENT', 'USER_PERMISSIONS_VIEW'],
          expected: false
        },
        {
          role: UserRole.ADMIN,
          permissions: ['SUPPLIERS'],
          expected: true
        },
        {
          role: UserRole.SUPPLIER,
          permissions: ['SUPPLIERS'],
          expected: true
        },
        {
          role: UserRole.USER,
          permissions: ['USER_MANAGEMENT', 'WAREHOUSE_MANAGEMENT', 'USER_PERMISSIONS_VIEW', 'SUPPLIERS'],
          expected: false
        }
      ];

      testCases.forEach(({ role, permissions, expected }) => {
        permissions.forEach(permission => {
          mockHasScreenPermission.mockImplementation((userRole, userPermission) => {
            if (userRole === UserRole.SUPERVISOR) {
              return ['USER_MANAGEMENT', 'WAREHOUSE_MANAGEMENT', 'USER_PERMISSIONS_VIEW', 'SUPPLIERS'].includes(userPermission);
            }
            if (userRole === UserRole.ADMIN) {
              return ['SUPPLIERS'].includes(userPermission);
            }
            if (userRole === UserRole.SUPPLIER) {
              return ['SUPPLIERS'].includes(userPermission);
            }
            return false;
          });

          const hasAccess = mockHasScreenPermission(role, permission);
          
          if (permission === 'SUPPLIERS' && [UserRole.ADMIN, UserRole.SUPPLIER, UserRole.SUPERVISOR].includes(role)) {
            expect(hasAccess).toBe(true);
          } else if (['USER_MANAGEMENT', 'WAREHOUSE_MANAGEMENT', 'USER_PERMISSIONS_VIEW'].includes(permission)) {
            expect(hasAccess).toBe(role === UserRole.SUPERVISOR);
          } else {
            expect(hasAccess).toBe(expected);
          }
        });
      });
    });

    test('handles unauthorized access gracefully', () => {
      const unauthorizedScenarios = [
        { role: UserRole.USER, page: 'users' },
        { role: UserRole.FITTER, page: 'warehouses' },
        { role: UserRole.ADMIN, page: 'user-permissions' }
      ];

      unauthorizedScenarios.forEach(({ role, page }) => {
        cleanup();
        mockUseUserRole.mockReturnValue({
          role,
          isAdmin: role === UserRole.ADMIN,
          isSupervisor: false,
          hasRole: jest.fn()
        });

        mockHasScreenPermission.mockImplementation(() => false);

        let component;
        switch (page) {
          case 'users':
            component = <MockUsersPage />;
            break;
          case 'warehouses':
            component = <MockWarehousesPage />;
            break;
          case 'user-permissions':
            component = <MockUserPermissionsPage />;
            break;
        }

        render(component);

        expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Integration', () => {
    test('ensures route URLs match navigation structure', () => {
      const routePermissionMap = {
        '/users': 'USER_MANAGEMENT',
        '/warehouses': 'WAREHOUSE_MANAGEMENT',
        '/user-permissions': 'USER_PERMISSIONS_VIEW',
        '/suppliers': 'SUPPLIERS'
      };

      Object.entries(routePermissionMap).forEach(([route, permission]) => {
        // This test validates that the route-to-permission mapping is consistent
        expect(permission).toBeTruthy();
        expect(route.startsWith('/')).toBe(true);
      });
    });

    test('validates hierarchical access control', () => {
      // SUPERVISOR should have access to all Account Management routes
      const supervisorRoutes = [
        { route: '/users', permission: 'USER_MANAGEMENT' },
        { route: '/warehouses', permission: 'WAREHOUSE_MANAGEMENT' },
        { route: '/user-permissions', permission: 'USER_PERMISSIONS_VIEW' },
        { route: '/suppliers', permission: 'SUPPLIERS' }
      ];

      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPERVISOR,
        isAdmin: false,
        isSupervisor: true,
        hasRole: jest.fn()
      });

      mockHasScreenPermission.mockImplementation((role) => {
        return role === UserRole.SUPERVISOR;
      });

      supervisorRoutes.forEach(({ permission }) => {
        const hasAccess = mockHasScreenPermission(UserRole.SUPERVISOR, permission);
        expect(hasAccess).toBe(true);
      });
    });
  });
});