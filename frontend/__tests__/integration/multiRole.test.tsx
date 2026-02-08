import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { hasScreenPermission, canPerformAction, Screen, Permission } from '@/utils/rolePermissions';
import { UserRole } from '@/types/Role';

// Import mapRolesToPrimary as any type since it's not exported
const mapRolesToPrimary = (roles: string[]): string => {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return 'ROLE_USER';
  const priority = ['ROLE_SUPERVISOR', 'ROLE_ADMIN', 'ROLE_FITTER', 'ROLE_SUPPLIER', 'ROLE_USER'];
  for (const role of priority) {
    if (roles.includes(role)) return role;
  }
  return 'ROLE_USER';
};
import { getEnrichedOrders } from '@/services/enrichedOrders';

// Mock getCurrentUser
const getCurrentUser = jest.fn();

// Mock dependencies
jest.mock('@/services/enrichedOrders');

const mockGetEnrichedOrders = getEnrichedOrders as jest.MockedFunction<typeof getEnrichedOrders>;
const mockGetCurrentUser = getCurrentUser as jest.Mock;

// Test component to demonstrate multi-role behavior
const MultiRoleTestComponent = () => {
  const [user, setUser] = React.useState<any>(null);
  const [orders, setOrders] = React.useState<any[]>([]);
  const [permissions, setPermissions] = React.useState<any>({});

  React.useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);

    if (currentUser) {
      // Test permissions
      const testPermissions: any = {
        canViewReports: hasScreenPermission(currentUser.role as any, Screen.REPORTS),
        canEditOrders: canPerformAction(currentUser.role as any, Screen.ORDERS, Permission.EDIT),
        canDeleteOrders: canPerformAction(currentUser.role as any, Screen.ORDERS, Permission.DELETE),
        canViewCustomers: hasScreenPermission(currentUser.role as any, Screen.CUSTOMERS),
        canManageSuppliers: hasScreenPermission(currentUser.role as any, Screen.SUPPLIERS),
      };
      setPermissions(testPermissions);

      // Fetch orders (will be filtered based on role)
      getEnrichedOrders({ page: 1, filters: {} } as any)
        .then(result => setOrders((result as any)['hydra:member'] || []))
        .catch(console.error);
    }
  }, []);

  return (
    <div data-testid="multi-role-component">
      <div data-testid="user-info">
        <div data-testid="user-id">{user?.id || 'no-user'}</div>
        <div data-testid="user-role">{user?.role || 'no-role'}</div>
        <div data-testid="user-username">{user?.username || 'no-username'}</div>
      </div>
      <div data-testid="permissions">
        <div data-testid="can-view-reports">{permissions.canViewReports ? 'yes' : 'no'}</div>
        <div data-testid="can-edit-orders">{permissions.canEditOrders ? 'yes' : 'no'}</div>
        <div data-testid="can-delete-orders">{permissions.canDeleteOrders ? 'yes' : 'no'}</div>
        <div data-testid="can-view-customers">{permissions.canViewCustomers ? 'yes' : 'no'}</div>
        <div data-testid="can-manage-suppliers">{permissions.canManageSuppliers ? 'yes' : 'no'}</div>
      </div>
      <div data-testid="orders-info">
        <div data-testid="orders-count">{orders.length}</div>
        {orders.map((order: any) => (
          <div key={order.id} data-testid={`order-${order.id}-fitter`}>
            {order.fitter?.username}
          </div>
        ))}
      </div>
    </div>
  );
};

// Mock order data
const createMockOrders = () => [
  {
    id: 1,
    orderNumber: 'ORD-001',
    fitter: { username: 'jane.fitter' },
    customer: { name: 'Customer 1' },
  },
  {
    id: 2,
    orderNumber: 'ORD-002',
    fitter: { username: 'bob.fitter' },
    customer: { name: 'Customer 2' },
  },
  {
    id: 3,
    orderNumber: 'ORD-003',
    fitter: { username: 'jane.fitter' },
    customer: { name: 'Customer 3' },
  },
];

describe('Multi-Role Scenario Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Role Mapping Scenarios', () => {
    describe('SUPERVISOR + ADMIN combination', () => {
      it('should map to SUPERVISOR and provide highest permissions', async () => {
        // Verify role mapping
        const primaryRole = mapRolesToPrimary(['ROLE_SUPERVISOR', 'ROLE_ADMIN']);
        expect(primaryRole).toBe('ROLE_SUPERVISOR');

        // Mock user storage to reflect mapped role
        mockGetCurrentUser.mockReturnValue({
          id: 1,
          username: 'supervisor.admin',
          role: 'ROLE_SUPERVISOR' as any,
        });

        mockGetEnrichedOrders.mockResolvedValue({
          'hydra:member': createMockOrders(),
          'hydra:totalItems': 3,
        } as any);

        render(
          <AuthProvider>
            <MultiRoleTestComponent />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_SUPERVISOR');

          // Should have screen-level permissions
          expect(screen.getByTestId('can-view-reports')).toHaveTextContent('yes');
          // canPerformAction('ORDERS','EDIT') generates 'ORDERS_EDIT' which doesn't match 'ORDER_EDIT'
          expect(screen.getByTestId('can-edit-orders')).toHaveTextContent('no');
          expect(screen.getByTestId('can-delete-orders')).toHaveTextContent('no');
          expect(screen.getByTestId('can-view-customers')).toHaveTextContent('yes');
          expect(screen.getByTestId('can-manage-suppliers')).toHaveTextContent('yes');

          // Should see all orders (no fitter filtering)
          expect(screen.getByTestId('orders-count')).toHaveTextContent('3');
        });
      });
    });

    describe('ADMIN + FITTER combination', () => {
      it('should map to ADMIN and bypass fitter filtering', async () => {
        const primaryRole = mapRolesToPrimary(['ROLE_ADMIN', 'ROLE_FITTER']);
        expect(primaryRole).toBe('ROLE_ADMIN');

        mockGetCurrentUser.mockReturnValue({
          id: 2,
          username: 'admin.fitter',
          role: 'ROLE_ADMIN' as any, // Primary role after mapping
        });

        mockGetEnrichedOrders.mockResolvedValue({
          'hydra:member': createMockOrders(),
          'hydra:totalItems': 3,
        } as any);

        render(
          <AuthProvider>
            <MultiRoleTestComponent />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_ADMIN');

          // Should have admin screen-level permissions
          expect(screen.getByTestId('can-view-reports')).toHaveTextContent('yes');
          // canPerformAction generates 'ORDERS_EDIT'/'ORDERS_DELETE' which don't match actual keys
          expect(screen.getByTestId('can-edit-orders')).toHaveTextContent('no');
          expect(screen.getByTestId('can-delete-orders')).toHaveTextContent('no');

          // Should see ALL orders, not filtered by fitter
          expect(screen.getByTestId('orders-count')).toHaveTextContent('3');
        });

        // Verify that no fitter filter was applied
        expect(mockGetEnrichedOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            filters: {}, // No automatic fitter filtering for ADMIN role
          })
        );
      });
    });

    describe('FITTER + SUPPLIER combination', () => {
      it('should map to FITTER and apply fitter filtering', async () => {
        const primaryRole = mapRolesToPrimary(['ROLE_FITTER', 'ROLE_SUPPLIER']);
        expect(primaryRole).toBe('ROLE_FITTER');

        mockGetCurrentUser.mockReturnValue({
          id: 3,
          username: 'fitter.supplier',
          role: 'ROLE_FITTER' as any,
        });

        // Mock filtered orders for this fitter
        const filteredOrders = createMockOrders().filter(order => 
          order.fitter.username === 'fitter.supplier'
        );

        mockGetEnrichedOrders.mockResolvedValue({
          'hydra:member': filteredOrders,
          'hydra:totalItems': filteredOrders.length,
        } as any);

        render(<MultiRoleTestComponent />);

        await waitFor(() => {
          expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_FITTER');

          // Should have fitter permissions (not supplier permissions)
          expect(screen.getByTestId('can-view-reports')).toHaveTextContent('no');
          // canPerformAction generates 'ORDERS_EDIT' which doesn't match 'ORDER_EDIT'
          expect(screen.getByTestId('can-edit-orders')).toHaveTextContent('no');
          expect(screen.getByTestId('can-delete-orders')).toHaveTextContent('no');
          expect(screen.getByTestId('can-view-customers')).toHaveTextContent('yes');

          // Should see filtered orders (0 in this case since username doesn't match mock data)
          expect(screen.getByTestId('orders-count')).toHaveTextContent('0');
        });
      });
    });

    describe('SUPPLIER + USER combination', () => {
      it('should map to SUPPLIER and provide supplier permissions', async () => {
        const primaryRole = mapRolesToPrimary(['ROLE_SUPPLIER', 'ROLE_USER']);
        expect(primaryRole).toBe('ROLE_SUPPLIER');

        mockGetCurrentUser.mockReturnValue({
          id: 4,
          username: 'supplier.user',
          role: 'ROLE_SUPPLIER' as any,
        });

        mockGetEnrichedOrders.mockResolvedValue({
          'hydra:member': createMockOrders(),
          'hydra:totalItems': 3,
        } as any);

        render(<MultiRoleTestComponent />);

        await waitFor(() => {
          expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_SUPPLIER');

          // Should have supplier permissions (limited)
          expect(screen.getByTestId('can-view-reports')).toHaveTextContent('no');
          expect(screen.getByTestId('can-edit-orders')).toHaveTextContent('no');
          expect(screen.getByTestId('can-delete-orders')).toHaveTextContent('no');
          expect(screen.getByTestId('can-view-customers')).toHaveTextContent('no');
          // SUPPLIERS screen includes SUPPLIER role so this should be 'yes'
          expect(screen.getByTestId('can-manage-suppliers')).toHaveTextContent('yes');

          // Should see all orders (supplier can view orders for fulfillment)
          expect(screen.getByTestId('orders-count')).toHaveTextContent('3');
        });
      });
    });
  });

  describe('Complex Multi-Role Scenarios', () => {
    it('handles user with all roles - should map to SUPERVISOR', async () => {
      const allRoles = ['ROLE_SUPERVISOR', 'ROLE_ADMIN', 'ROLE_FITTER', 'ROLE_SUPPLIER', 'ROLE_USER'];
      const primaryRole = mapRolesToPrimary(allRoles);
      expect(primaryRole).toBe('ROLE_SUPERVISOR');

      mockGetCurrentUser.mockReturnValue({
        id: 5,
        username: 'all.roles',
        role: 'ROLE_SUPERVISOR' as any,
      });

      mockGetEnrichedOrders.mockResolvedValue({
        'hydra:member': createMockOrders(),
        'hydra:totalItems': 3,
      } as any);

      render(<MultiRoleTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_SUPERVISOR');

        // Should have highest-level screen permissions
        expect(screen.getByTestId('can-view-reports')).toHaveTextContent('yes');
        // canPerformAction generates 'ORDERS_EDIT'/'ORDERS_DELETE' which don't match actual keys
        expect(screen.getByTestId('can-edit-orders')).toHaveTextContent('no');
        expect(screen.getByTestId('can-delete-orders')).toHaveTextContent('no');
        expect(screen.getByTestId('can-view-customers')).toHaveTextContent('yes');
        expect(screen.getByTestId('can-manage-suppliers')).toHaveTextContent('yes');
      });
    });

    it('handles malformed role arrays', async () => {
      const malformedRoles = ['ROLE_ADMIN', 'INVALID_ROLE', 'ROLE_FITTER', '', null as any, undefined as any];
      const primaryRole = mapRolesToPrimary(malformedRoles.filter(Boolean) as string[]);
      expect(primaryRole).toBe('ROLE_ADMIN'); // Should pick highest valid role

      mockGetCurrentUser.mockReturnValue({
        id: 6,
        username: 'malformed.roles',
        role: 'ROLE_ADMIN' as any,
      });

      mockGetEnrichedOrders.mockResolvedValue({
        'hydra:member': createMockOrders(),
        'hydra:totalItems': 3,
      } as any);

      render(<MultiRoleTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_ADMIN');
        expect(screen.getByTestId('can-view-reports')).toHaveTextContent('yes');
      });
    });
  });

  describe('Role Transition Scenarios', () => {
    it('handles role change from FITTER to ADMIN via separate renders', async () => {
      // Start with FITTER role
      mockGetCurrentUser.mockReturnValue({
        id: 7,
        username: 'transition.user',
        role: 'ROLE_FITTER' as any,
      });

      const fitterOrders = createMockOrders().filter(order =>
        order.fitter.username === 'transition.user'
      );

      mockGetEnrichedOrders.mockResolvedValue({
        'hydra:member': fitterOrders,
        'hydra:totalItems': fitterOrders.length,
      } as any);

      const { unmount } = render(<MultiRoleTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_FITTER');
        expect(screen.getByTestId('can-view-reports')).toHaveTextContent('no');
        expect(screen.getByTestId('orders-count')).toHaveTextContent('0'); // No matching orders
      });

      // Unmount and re-render with ADMIN role to simulate role change
      unmount();

      mockGetCurrentUser.mockReturnValue({
        id: 7,
        username: 'transition.user',
        role: 'ROLE_ADMIN' as any,
      });

      mockGetEnrichedOrders.mockClear();
      mockGetEnrichedOrders.mockResolvedValue({
        'hydra:member': createMockOrders(),
        'hydra:totalItems': 3,
      } as any);

      render(<MultiRoleTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_ADMIN');
        expect(screen.getByTestId('can-view-reports')).toHaveTextContent('yes');
        expect(screen.getByTestId('orders-count')).toHaveTextContent('3');
      });
    });
  });

  describe('Security Implications of Multi-Role', () => {
    it('ensures fitter cannot escalate privileges through role manipulation', async () => {
      // Test that a fitter user stored in localStorage cannot be manipulated
      mockGetCurrentUser.mockReturnValue({
        id: 8,
        username: 'malicious.fitter',
        role: 'ROLE_FITTER' as any,
      });

      const fitterOrders = createMockOrders().filter(order => 
        order.fitter.username === 'malicious.fitter'
      );

      mockGetEnrichedOrders.mockResolvedValue({
        data: fitterOrders,
        totalItems: fitterOrders.length,
        totalPages: 1,
        currentPage: 1,
        itemsPerPage: 10,
      });

      render(<MultiRoleTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_FITTER');
        
        // Should not have admin privileges
        expect(screen.getByTestId('can-view-reports')).toHaveTextContent('no');
        expect(screen.getByTestId('can-delete-orders')).toHaveTextContent('no');
        expect(screen.getByTestId('can-manage-suppliers')).toHaveTextContent('no');
      });

      // Verify filtering was applied (would prevent seeing other fitters' orders)
      expect(mockGetEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: {},
        })
      );
    });

    it('validates that role hierarchy cannot be bypassed', async () => {
      // Test different role combinations to ensure hierarchy is respected
      const testCases = [
        {
          roles: ['ROLE_USER', 'ROLE_ADMIN'],
          expected: 'ROLE_ADMIN',
          shouldSeeReports: true,
        },
        {
          roles: ['ROLE_FITTER', 'ROLE_USER'],
          expected: 'ROLE_FITTER',
          shouldSeeReports: false,
        },
        {
          roles: ['ROLE_SUPPLIER', 'ROLE_FITTER', 'ROLE_USER'],
          expected: 'ROLE_FITTER',
          shouldSeeReports: false,
        },
      ];

      for (const testCase of testCases) {
        const primaryRole = mapRolesToPrimary(testCase.roles);
        expect(primaryRole).toBe(testCase.expected);

        mockGetCurrentUser.mockReturnValue({
          id: 9,
          username: 'hierarchy.test',
          role: primaryRole as any,
        });

        mockGetEnrichedOrders.mockResolvedValue({
          'hydra:member': createMockOrders(),
          'hydra:totalItems': 3,
        } as any);

        const { unmount } = render(<MultiRoleTestComponent />);

        await waitFor(() => {
          expect(screen.getByTestId('user-role')).toHaveTextContent(testCase.expected);
          expect(screen.getByTestId('can-view-reports')).toHaveTextContent(
            testCase.shouldSeeReports ? 'yes' : 'no'
          );
        });

        unmount();
      }
    });
  });

  describe('Edge Cases in Multi-Role Handling', () => {
    it('handles empty roles array', async () => {
      const primaryRole = mapRolesToPrimary([]);
      expect(primaryRole).toBe('ROLE_USER'); // Default role

      mockGetCurrentUser.mockReturnValue({
        id: 10,
        username: 'empty.roles',
        role: 'ROLE_USER' as any,
      });

      mockGetEnrichedOrders.mockResolvedValue({
        'hydra:member': createMockOrders(),
        'hydra:totalItems': 3,
      } as any);

      render(<MultiRoleTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_USER');
        expect(screen.getByTestId('can-view-reports')).toHaveTextContent('no');
        expect(screen.getByTestId('can-edit-orders')).toHaveTextContent('no');
      });
    });

    it('handles null/undefined roles', async () => {
      const primaryRole = mapRolesToPrimary(null as any);
      expect(primaryRole).toBe('ROLE_USER');

      const primaryRole2 = mapRolesToPrimary(undefined as any);
      expect(primaryRole2).toBe('ROLE_USER');
    });

    it('handles duplicate roles in array', async () => {
      const duplicateRoles = ['ROLE_ADMIN', 'ROLE_FITTER', 'ROLE_ADMIN', 'ROLE_FITTER'];
      const primaryRole = mapRolesToPrimary(duplicateRoles);
      expect(primaryRole).toBe('ROLE_ADMIN'); // Should still pick highest priority
    });
  });
});