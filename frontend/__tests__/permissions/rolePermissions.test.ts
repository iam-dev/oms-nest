import { hasScreenPermission, SCREEN_PERMISSIONS, getRoleDisplayName } from '@/utils/rolePermissions';
import { UserRole } from '@/types/Role';
import { getAllRoles, roleTestCases } from '../utils/roleTestHelpers';

describe('Role Permissions Configuration', () => {
  describe('hasScreenPermission', () => {
    test('returns false for null user role', () => {
      expect(hasScreenPermission(null, 'DASHBOARD')).toBe(false);
    });

    test('supervisor inherits admin permissions', () => {
      // Test a permission that only ADMIN should have
      expect(hasScreenPermission(UserRole.ADMIN, 'FITTERS')).toBe(true);
      expect(hasScreenPermission(UserRole.SUPERVISOR, 'FITTERS')).toBe(true);
    });

    describe('Screen Access by Role', () => {
      getAllRoles().forEach(role => {
        const testCase = roleTestCases.find(tc => tc.role === role);
        if (!testCase) return;

        describe(`${testCase.roleName} Role`, () => {
          test('should have access to allowed screens', () => {
            const allowedScreens = testCase.expectedAccess.screens;
            
            allowedScreens.forEach(screen => {
              const permissionKey = getPermissionKeyFromScreen(screen);
              if (permissionKey) {
                expect(hasScreenPermission(role, permissionKey)).toBe(true);
              }
            });
          });

          test('should be denied access to restricted screens', () => {
            const deniedScreens = testCase.expectedAccess.deniedScreens;
            
            deniedScreens.forEach(screen => {
              const permissionKey = getPermissionKeyFromScreen(screen);
              if (permissionKey) {
                expect(hasScreenPermission(role, permissionKey)).toBe(false);
              }
            });
          });
        });
      });
    });

    describe('Specific Permission Tests', () => {
      test('Dashboard access', () => {
        // All roles should have dashboard access
        getAllRoles().forEach(role => {
          expect(hasScreenPermission(role, 'DASHBOARD')).toBe(true);
        });
      });

      test('Orders access', () => {
        expect(hasScreenPermission(UserRole.USER, 'ORDERS')).toBe(true);
        expect(hasScreenPermission(UserRole.FITTER, 'ORDERS')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'ORDERS')).toBe(false);
        expect(hasScreenPermission(UserRole.ADMIN, 'ORDERS')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'ORDERS')).toBe(true);
      });

      test('Customers access', () => {
        expect(hasScreenPermission(UserRole.USER, 'CUSTOMERS')).toBe(false);
        expect(hasScreenPermission(UserRole.FITTER, 'CUSTOMERS')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'CUSTOMERS')).toBe(false);
        expect(hasScreenPermission(UserRole.ADMIN, 'CUSTOMERS')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'CUSTOMERS')).toBe(true);
      });

      test('Fitters access', () => {
        expect(hasScreenPermission(UserRole.USER, 'FITTERS')).toBe(false);
        expect(hasScreenPermission(UserRole.FITTER, 'FITTERS')).toBe(false);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'FITTERS')).toBe(false);
        expect(hasScreenPermission(UserRole.ADMIN, 'FITTERS')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'FITTERS')).toBe(true);
      });

      test('Reports access', () => {
        expect(hasScreenPermission(UserRole.USER, 'REPORTS')).toBe(false);
        expect(hasScreenPermission(UserRole.FITTER, 'REPORTS')).toBe(false);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'REPORTS')).toBe(false);
        expect(hasScreenPermission(UserRole.ADMIN, 'REPORTS')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'REPORTS')).toBe(true);
      });

      test('Suppliers access', () => {
        expect(hasScreenPermission(UserRole.USER, 'SUPPLIERS')).toBe(false);
        expect(hasScreenPermission(UserRole.FITTER, 'SUPPLIERS')).toBe(false);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'SUPPLIERS')).toBe(true);
        expect(hasScreenPermission(UserRole.ADMIN, 'SUPPLIERS')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'SUPPLIERS')).toBe(true);
      });
    });

    describe('Action Permissions', () => {
      test('Order actions', () => {
        // ORDER_CREATE
        expect(hasScreenPermission(UserRole.USER, 'ORDER_CREATE')).toBe(true);
        expect(hasScreenPermission(UserRole.FITTER, 'ORDER_CREATE')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'ORDER_CREATE')).toBe(false);
        expect(hasScreenPermission(UserRole.ADMIN, 'ORDER_CREATE')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'ORDER_CREATE')).toBe(true);

        // ORDER_EDIT (Admin, Supervisor, Fitter — fitters have status-based restrictions via canEditOrder)
        expect(hasScreenPermission(UserRole.USER, 'ORDER_EDIT')).toBe(false);
        expect(hasScreenPermission(UserRole.FITTER, 'ORDER_EDIT')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'ORDER_EDIT')).toBe(false);
        expect(hasScreenPermission(UserRole.ADMIN, 'ORDER_EDIT')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'ORDER_EDIT')).toBe(true);

        // ORDER_DELETE (Admin only)
        expect(hasScreenPermission(UserRole.USER, 'ORDER_DELETE')).toBe(false);
        expect(hasScreenPermission(UserRole.FITTER, 'ORDER_DELETE')).toBe(false);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'ORDER_DELETE')).toBe(false);
        expect(hasScreenPermission(UserRole.ADMIN, 'ORDER_DELETE')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'ORDER_DELETE')).toBe(true);

        // ORDER_APPROVE (Admin only)
        expect(hasScreenPermission(UserRole.USER, 'ORDER_APPROVE')).toBe(false);
        expect(hasScreenPermission(UserRole.FITTER, 'ORDER_APPROVE')).toBe(false);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'ORDER_APPROVE')).toBe(false);
        expect(hasScreenPermission(UserRole.ADMIN, 'ORDER_APPROVE')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'ORDER_APPROVE')).toBe(true);
      });

      test('Customer actions', () => {
        // CUSTOMER_CREATE
        expect(hasScreenPermission(UserRole.USER, 'CUSTOMER_CREATE')).toBe(false);
        expect(hasScreenPermission(UserRole.FITTER, 'CUSTOMER_CREATE')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'CUSTOMER_CREATE')).toBe(false);
        expect(hasScreenPermission(UserRole.ADMIN, 'CUSTOMER_CREATE')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'CUSTOMER_CREATE')).toBe(true);

        // CUSTOMER_EDIT
        expect(hasScreenPermission(UserRole.USER, 'CUSTOMER_EDIT')).toBe(false);
        expect(hasScreenPermission(UserRole.FITTER, 'CUSTOMER_EDIT')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'CUSTOMER_EDIT')).toBe(false);
        expect(hasScreenPermission(UserRole.ADMIN, 'CUSTOMER_EDIT')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'CUSTOMER_EDIT')).toBe(true);

        // CUSTOMER_DELETE (Admin only)
        expect(hasScreenPermission(UserRole.USER, 'CUSTOMER_DELETE')).toBe(false);
        expect(hasScreenPermission(UserRole.FITTER, 'CUSTOMER_DELETE')).toBe(false);
        expect(hasScreenPermission(UserRole.SUPPLIER, 'CUSTOMER_DELETE')).toBe(false);
        expect(hasScreenPermission(UserRole.ADMIN, 'CUSTOMER_DELETE')).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, 'CUSTOMER_DELETE')).toBe(true);
      });
    });
  });

  describe('getRoleDisplayName', () => {
    test('returns correct display names for all roles', () => {
      expect(getRoleDisplayName(UserRole.USER)).toBe('User');
      expect(getRoleDisplayName(UserRole.FITTER)).toBe('Fitter');
      expect(getRoleDisplayName(UserRole.SUPPLIER)).toBe('Factory');
      expect(getRoleDisplayName(UserRole.ADMIN)).toBe('Administrator');
      expect(getRoleDisplayName(UserRole.SUPERVISOR)).toBe('Supervisor');
    });
  });

  describe('SCREEN_PERMISSIONS Configuration', () => {
    test('all permission keys are defined', () => {
      const expectedPermissions = [
        'DASHBOARD', 'ORDERS', 'CUSTOMERS', 'FITTERS', 'REPORTS',
        'SADDLE_MODELING', 'BRANDS', 'MODELS', 'LEATHER_TYPES', 'OPTIONS', 'EXTRAS', 'PRESETS', 'SUPPLIERS',
        'ORDER_CREATE', 'ORDER_EDIT', 'ORDER_DELETE', 'ORDER_APPROVE', 'ORDER_VIEW',
        'CUSTOMER_CREATE', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE',
        'FITTER_CREATE', 'FITTER_EDIT', 'FITTER_DELETE',
        'SUPPLIER_CREATE', 'SUPPLIER_EDIT', 'SUPPLIER_DELETE'
      ];

      expectedPermissions.forEach(permission => {
        expect(SCREEN_PERMISSIONS).toHaveProperty(permission);
      });
    });

    test('all permissions have valid roles', () => {
      Object.entries(SCREEN_PERMISSIONS).forEach(([permission, roles]) => {
        expect(Array.isArray(roles)).toBe(true);
        expect(roles.length).toBeGreaterThan(0);
        
        roles.forEach(role => {
          expect(Object.values(UserRole)).toContain(role);
        });
      });
    });
  });
});

// Helper function to map screen names to permission keys
function getPermissionKeyFromScreen(screen: string): keyof typeof SCREEN_PERMISSIONS | null {
  const mapping: Record<string, keyof typeof SCREEN_PERMISSIONS> = {
    'dashboard': 'DASHBOARD',
    'orders': 'ORDERS',
    'customers': 'CUSTOMERS',
    'fitters': 'FITTERS',
    'reports': 'REPORTS',
    'suppliers': 'SUPPLIERS',
    'brands': 'BRANDS',
    'models': 'MODELS',
    'leathertypes': 'LEATHER_TYPES',
    'options': 'OPTIONS',
    'extras': 'EXTRAS',
    'presets': 'PRESETS'
  };

  return mapping[screen] || null;
}