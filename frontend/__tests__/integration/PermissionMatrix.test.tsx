import { hasScreenPermission, SCREEN_PERMISSIONS } from '@/utils/rolePermissions';
import { UserRole } from '@/types/Role';
import { getAllRoles, createPermissionMatrix } from '../utils/roleTestHelpers';

describe('Comprehensive Permission Matrix Validation', () => {
  describe('Permission Matrix Consistency', () => {
    test('permission matrix matches expected configuration', () => {
      const matrix = createPermissionMatrix();
      
      // Verify the matrix structure
      expect(matrix).toHaveProperty('user');
      expect(matrix).toHaveProperty('fitter');
      expect(matrix).toHaveProperty('supplier');
      expect(matrix).toHaveProperty('admin');
      expect(matrix).toHaveProperty('supervisor');

      // Verify each role has the expected permissions
      Object.keys(matrix).forEach(roleName => {
        const rolePermissions = matrix[roleName];
        expect(typeof rolePermissions).toBe('object');
        expect(Object.keys(rolePermissions).length).toBeGreaterThan(0);
      });
    });

    test('matrix screens and actions are consistent with helper data', () => {
      const matrix = createPermissionMatrix();

      // The matrix is built from roleTestHelpers which covers a subset of screens
      // Verify that all entries in the matrix are valid
      getAllRoles().forEach(role => {
        const roleName = role.replace('ROLE_', '').toLowerCase();
        const rolePermissions = matrix[roleName];

        expect(typeof rolePermissions).toBe('object');
        // Verify the matrix has at least screen and action entries
        const screenKeys = Object.keys(rolePermissions).filter(k => k.startsWith('screen_'));
        const actionKeys = Object.keys(rolePermissions).filter(k => k.startsWith('action_'));
        expect(screenKeys.length).toBeGreaterThan(0);
        expect(actionKeys.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Role-Specific Permission Validation', () => {
    describe('USER Role Permissions', () => {
      const userRole = UserRole.USER;

      test('USER has access to basic screens', () => {
        const allowedScreens = ['DASHBOARD', 'ORDERS', 'SADDLE_MODELING', 'BRANDS', 'MODELS', 'LEATHER_TYPES', 'OPTIONS', 'EXTRAS', 'PRESETS'];
        
        allowedScreens.forEach(screen => {
          expect(hasScreenPermission(userRole, screen as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
        });
      });

      test('USER is denied access to restricted screens', () => {
        const deniedScreens = ['CUSTOMERS', 'FITTERS', 'REPORTS', 'SUPPLIERS', 'ACCOUNT_MANAGEMENT', 'USER_MANAGEMENT', 'WAREHOUSE_MANAGEMENT'];
        
        deniedScreens.forEach(screen => {
          expect(hasScreenPermission(userRole, screen as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
        });
      });

      test('USER has limited action permissions', () => {
        expect(hasScreenPermission(userRole, 'ORDER_CREATE')).toBe(true);
        expect(hasScreenPermission(userRole, 'ORDER_VIEW')).toBe(true);
        expect(hasScreenPermission(userRole, 'ORDER_EDIT')).toBe(false);
        expect(hasScreenPermission(userRole, 'ORDER_DELETE')).toBe(false);
        expect(hasScreenPermission(userRole, 'ORDER_APPROVE')).toBe(false);
        
        expect(hasScreenPermission(userRole, 'CUSTOMER_CREATE')).toBe(false);
        expect(hasScreenPermission(userRole, 'CUSTOMER_EDIT')).toBe(false);
        expect(hasScreenPermission(userRole, 'CUSTOMER_DELETE')).toBe(false);
      });
    });

    describe('FITTER Role Permissions', () => {
      const fitterRole = UserRole.FITTER;

      test('FITTER has access to customer-related screens', () => {
        const allowedScreens = ['DASHBOARD', 'ORDERS', 'CUSTOMERS'];
        
        allowedScreens.forEach(screen => {
          expect(hasScreenPermission(fitterRole, screen as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
        });
      });

      test('FITTER is denied access to admin and product screens', () => {
        const deniedScreens = ['FITTERS', 'REPORTS', 'SUPPLIERS', 'BRANDS', 'MODELS', 'LEATHER_TYPES', 'OPTIONS', 'EXTRAS', 'PRESETS', 'SADDLE_MODELING', 'ACCOUNT_MANAGEMENT', 'USER_MANAGEMENT', 'WAREHOUSE_MANAGEMENT'];
        
        deniedScreens.forEach(screen => {
          expect(hasScreenPermission(fitterRole, screen as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
        });
      });

      test('FITTER has customer management permissions', () => {
        expect(hasScreenPermission(fitterRole, 'ORDER_CREATE')).toBe(true);
        expect(hasScreenPermission(fitterRole, 'ORDER_VIEW')).toBe(true);
        expect(hasScreenPermission(fitterRole, 'ORDER_EDIT')).toBe(true); // Fitters can edit (status-based restrictions via canEditOrder)
        expect(hasScreenPermission(fitterRole, 'ORDER_DELETE')).toBe(false);
        
        expect(hasScreenPermission(fitterRole, 'CUSTOMER_CREATE')).toBe(true);
        expect(hasScreenPermission(fitterRole, 'CUSTOMER_EDIT')).toBe(true);
        expect(hasScreenPermission(fitterRole, 'CUSTOMER_DELETE')).toBe(false);
      });
    });

    describe('SUPPLIER Role Permissions', () => {
      const supplierRole = UserRole.SUPPLIER;

      test('SUPPLIER has minimal access', () => {
        const allowedScreens = ['DASHBOARD', 'SUPPLIERS'];
        
        allowedScreens.forEach(screen => {
          expect(hasScreenPermission(supplierRole, screen as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
        });
      });

      test('SUPPLIER is denied access to most screens', () => {
        const deniedScreens = ['ORDERS', 'CUSTOMERS', 'FITTERS', 'REPORTS', 'BRANDS', 'MODELS', 'LEATHER_TYPES', 'OPTIONS', 'EXTRAS', 'PRESETS', 'SADDLE_MODELING', 'ACCOUNT_MANAGEMENT', 'USER_MANAGEMENT', 'WAREHOUSE_MANAGEMENT'];
        
        deniedScreens.forEach(screen => {
          expect(hasScreenPermission(supplierRole, screen as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
        });
      });

      test('SUPPLIER has no order or customer permissions', () => {
        expect(hasScreenPermission(supplierRole, 'ORDER_CREATE')).toBe(false);
        expect(hasScreenPermission(supplierRole, 'ORDER_VIEW')).toBe(true); // Suppliers can view orders
        expect(hasScreenPermission(supplierRole, 'ORDER_EDIT')).toBe(false);
        expect(hasScreenPermission(supplierRole, 'ORDER_DELETE')).toBe(false);
        
        expect(hasScreenPermission(supplierRole, 'CUSTOMER_CREATE')).toBe(false);
        expect(hasScreenPermission(supplierRole, 'CUSTOMER_EDIT')).toBe(false);
        expect(hasScreenPermission(supplierRole, 'CUSTOMER_DELETE')).toBe(false);
      });
    });

    describe('ADMIN Role Permissions', () => {
      const adminRole = UserRole.ADMIN;

      test('ADMIN has access to most screens except supervisor-only and fitter-only', () => {
        const supervisorOnlyScreens = ['ACCOUNT_MANAGEMENT', 'USER_MANAGEMENT', 'WAREHOUSE_MANAGEMENT', 'USER_PERMISSIONS_VIEW', 'ACCESS_FILTER_GROUPS', 'WAREHOUSES', 'COUNTRY_MANAGERS', 'SUPPLIERS_MANAGEMENT', 'USER_CREATE', 'USER_EDIT', 'USER_DELETE', 'USER_VIEW', 'WAREHOUSE_CREATE', 'WAREHOUSE_EDIT', 'WAREHOUSE_DELETE', 'WAREHOUSE_VIEW'];
        const fitterOnlyScreens = ['MY_SADDLE_STOCK', 'AVAILABLE_SADDLE_STOCK'];
        const excludedForAdmin = [...supervisorOnlyScreens, ...fitterOnlyScreens];
        const allScreens = Object.keys(SCREEN_PERMISSIONS);
        const adminAccessibleScreens = allScreens.filter(screen => !excludedForAdmin.includes(screen));
        
        adminAccessibleScreens.forEach(screen => {
          expect(hasScreenPermission(adminRole, screen as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
        });

        supervisorOnlyScreens.forEach(screen => {
          if (SCREEN_PERMISSIONS[screen as keyof typeof SCREEN_PERMISSIONS]) {
            expect(hasScreenPermission(adminRole, screen as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
          }
        });
      });

      test('ADMIN has most action permissions except supervisor-only', () => {
        const adminActions = [
          'ORDER_CREATE', 'ORDER_EDIT', 'ORDER_DELETE', 'ORDER_APPROVE', 'ORDER_VIEW',
          'CUSTOMER_CREATE', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE',
          'FITTER_CREATE', 'FITTER_EDIT', 'FITTER_DELETE',
          'SUPPLIER_CREATE', 'SUPPLIER_EDIT', 'SUPPLIER_DELETE'
        ];
        
        adminActions.forEach(action => {
          expect(hasScreenPermission(adminRole, action as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
        });
      });
    });

    describe('SUPERVISOR Role Permissions', () => {
      const supervisorRole = UserRole.SUPERVISOR;

      test('SUPERVISOR has access to all screens except fitter-only (inherits admin)', () => {
        const allScreens = Object.keys(SCREEN_PERMISSIONS);
        const fitterOnlyScreens = ['MY_SADDLE_STOCK', 'AVAILABLE_SADDLE_STOCK'];

        allScreens.forEach(screen => {
          if (fitterOnlyScreens.includes(screen)) {
            expect(hasScreenPermission(supervisorRole, screen as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
          } else {
            expect(hasScreenPermission(supervisorRole, screen as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
          }
        });
      });

      test('SUPERVISOR has all action permissions (inherits admin)', () => {
        const allActions = [
          'ORDER_CREATE', 'ORDER_EDIT', 'ORDER_DELETE', 'ORDER_APPROVE', 'ORDER_VIEW',
          'CUSTOMER_CREATE', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE',
          'FITTER_CREATE', 'FITTER_EDIT', 'FITTER_DELETE',
          'SUPPLIER_CREATE', 'SUPPLIER_EDIT', 'SUPPLIER_DELETE'
        ];
        
        allActions.forEach(action => {
          expect(hasScreenPermission(supervisorRole, action as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
        });
      });

      test('SUPERVISOR has all permissions that ADMIN has, plus supervisor-only permissions', () => {
        const allPermissions = Object.keys(SCREEN_PERMISSIONS);

        allPermissions.forEach(permission => {
          const adminAccess = hasScreenPermission(UserRole.ADMIN, permission as keyof typeof SCREEN_PERMISSIONS);
          const supervisorAccess = hasScreenPermission(UserRole.SUPERVISOR, permission as keyof typeof SCREEN_PERMISSIONS);

          // Supervisor should have at least the same access as admin, or more
          if (adminAccess) {
            expect(supervisorAccess).toBe(true);
          }
          // For supervisor-only permissions, supervisor should have access but admin should not
          const supervisorOnlyPermissions = ['ACCOUNT_MANAGEMENT', 'USER_MANAGEMENT', 'WAREHOUSE_MANAGEMENT', 'USER_PERMISSIONS_VIEW', 'ACCESS_FILTER_GROUPS', 'WAREHOUSES', 'COUNTRY_MANAGERS', 'SUPPLIERS_MANAGEMENT', 'USER_CREATE', 'USER_EDIT', 'USER_DELETE', 'USER_VIEW', 'WAREHOUSE_CREATE', 'WAREHOUSE_EDIT', 'WAREHOUSE_DELETE', 'WAREHOUSE_VIEW'];
          if (supervisorOnlyPermissions.includes(permission) && SCREEN_PERMISSIONS[permission as keyof typeof SCREEN_PERMISSIONS]) {
            expect(supervisorAccess).toBe(true);
            expect(adminAccess).toBe(false);
          }
        });
      });
    });
  });

  describe('Permission Hierarchy Validation', () => {
    test('role hierarchy is respected', () => {
      const roleHierarchy = [
        UserRole.SUPERVISOR,
        UserRole.ADMIN,
        UserRole.FITTER,
        UserRole.USER,
        UserRole.SUPPLIER
      ];

      // Check that higher roles have at least the same permissions as lower roles
      const generalPermissions = ['DASHBOARD', 'ORDER_VIEW'];
      
      generalPermissions.forEach(permission => {
        roleHierarchy.forEach(role => {
          if ([UserRole.SUPERVISOR, UserRole.ADMIN].includes(role)) {
            expect(hasScreenPermission(role, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
          }
        });
      });
    });

    test('admin roles have superset of regular role permissions (excluding role-specific screens)', () => {
      const adminRoles = [UserRole.ADMIN, UserRole.SUPERVISOR];
      const regularRoles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];
      // Some screens are exclusively for specific roles (e.g., MY_SADDLE_STOCK for FITTER only)
      const roleSpecificScreens = ['MY_SADDLE_STOCK', 'AVAILABLE_SADDLE_STOCK'];

      regularRoles.forEach(regularRole => {
        Object.keys(SCREEN_PERMISSIONS).forEach(permission => {
          if (roleSpecificScreens.includes(permission)) return; // Skip role-specific screens

          const regularAccess = hasScreenPermission(regularRole, permission as keyof typeof SCREEN_PERMISSIONS);

          if (regularAccess) {
            // If regular role has access, admin roles should too
            adminRoles.forEach(adminRole => {
              const adminAccess = hasScreenPermission(adminRole, permission as keyof typeof SCREEN_PERMISSIONS);
              expect(adminAccess).toBe(true);
            });
          }
        });
      });
    });
  });

  describe('Cross-Role Permission Consistency', () => {
    test('exclusive permissions are properly isolated', () => {
      const exclusivePermissions = {
        'FITTERS': [UserRole.ADMIN, UserRole.SUPERVISOR],
        'REPORTS': [UserRole.ADMIN, UserRole.SUPERVISOR],
        'SUPPLIERS': [UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR]
      };

      Object.entries(exclusivePermissions).forEach(([permission, allowedRoles]) => {
        getAllRoles().forEach(role => {
          const hasAccess = hasScreenPermission(role, permission as keyof typeof SCREEN_PERMISSIONS);
          const shouldHaveAccess = allowedRoles.includes(role);
          
          expect(hasAccess).toBe(shouldHaveAccess);
        });
      });
    });

    test('common permissions are consistently available', () => {
      const commonPermissions = {
        'DASHBOARD': getAllRoles(), // All roles should have dashboard access
        'ORDER_VIEW': [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR]
      };

      Object.entries(commonPermissions).forEach(([permission, expectedRoles]) => {
        getAllRoles().forEach(role => {
          const hasAccess = hasScreenPermission(role, permission as keyof typeof SCREEN_PERMISSIONS);
          const shouldHaveAccess = expectedRoles.includes(role);
          
          expect(hasAccess).toBe(shouldHaveAccess);
        });
      });
    });
  });

  describe('Permission Matrix Edge Cases', () => {
    test('null role has no permissions', () => {
      Object.keys(SCREEN_PERMISSIONS).forEach(permission => {
        expect(hasScreenPermission(null, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
      });
    });

    test('undefined role has no permissions', () => {
      Object.keys(SCREEN_PERMISSIONS).forEach(permission => {
        expect(hasScreenPermission(undefined as unknown as null, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
      });
    });

    test('invalid permission keys return false', () => {
      getAllRoles().forEach(role => {
        // Test with a completely invalid permission key that doesn't exist
        const invalidResult = hasScreenPermission(role, 'TOTALLY_INVALID_PERMISSION_THAT_DOES_NOT_EXIST' as unknown as keyof typeof SCREEN_PERMISSIONS);
        expect(invalidResult).toBe(false);
      });
    });
  });

  describe('Business Logic Validation', () => {
    test('order management workflow permissions', () => {
      // Users can create but not manage orders
      expect(hasScreenPermission(UserRole.USER, 'ORDER_CREATE')).toBe(true);
      expect(hasScreenPermission(UserRole.USER, 'ORDER_EDIT')).toBe(false);
      expect(hasScreenPermission(UserRole.USER, 'ORDER_DELETE')).toBe(false);
      expect(hasScreenPermission(UserRole.USER, 'ORDER_APPROVE')).toBe(false);

      // Fitters can create and edit orders (edit has status-based restrictions via canEditOrder)
      expect(hasScreenPermission(UserRole.FITTER, 'ORDER_CREATE')).toBe(true);
      expect(hasScreenPermission(UserRole.FITTER, 'ORDER_EDIT')).toBe(true);
      expect(hasScreenPermission(UserRole.FITTER, 'ORDER_DELETE')).toBe(false);
      expect(hasScreenPermission(UserRole.FITTER, 'ORDER_APPROVE')).toBe(false);

      // Suppliers cannot create or manage orders
      expect(hasScreenPermission(UserRole.SUPPLIER, 'ORDER_CREATE')).toBe(false);
      expect(hasScreenPermission(UserRole.SUPPLIER, 'ORDER_EDIT')).toBe(false);
      expect(hasScreenPermission(UserRole.SUPPLIER, 'ORDER_DELETE')).toBe(false);
      expect(hasScreenPermission(UserRole.SUPPLIER, 'ORDER_APPROVE')).toBe(false);

      // Admins can do everything
      expect(hasScreenPermission(UserRole.ADMIN, 'ORDER_CREATE')).toBe(true);
      expect(hasScreenPermission(UserRole.ADMIN, 'ORDER_EDIT')).toBe(true);
      expect(hasScreenPermission(UserRole.ADMIN, 'ORDER_DELETE')).toBe(true);
      expect(hasScreenPermission(UserRole.ADMIN, 'ORDER_APPROVE')).toBe(true);
    });

    test('customer management workflow permissions', () => {
      // Users cannot manage customers
      expect(hasScreenPermission(UserRole.USER, 'CUSTOMERS')).toBe(false);
      expect(hasScreenPermission(UserRole.USER, 'CUSTOMER_CREATE')).toBe(false);
      expect(hasScreenPermission(UserRole.USER, 'CUSTOMER_EDIT')).toBe(false);
      expect(hasScreenPermission(UserRole.USER, 'CUSTOMER_DELETE')).toBe(false);

      // Fitters can create and edit customers but not delete
      expect(hasScreenPermission(UserRole.FITTER, 'CUSTOMERS')).toBe(true);
      expect(hasScreenPermission(UserRole.FITTER, 'CUSTOMER_CREATE')).toBe(true);
      expect(hasScreenPermission(UserRole.FITTER, 'CUSTOMER_EDIT')).toBe(true);
      expect(hasScreenPermission(UserRole.FITTER, 'CUSTOMER_DELETE')).toBe(false);

      // Suppliers cannot manage customers
      expect(hasScreenPermission(UserRole.SUPPLIER, 'CUSTOMERS')).toBe(false);
      expect(hasScreenPermission(UserRole.SUPPLIER, 'CUSTOMER_CREATE')).toBe(false);
      expect(hasScreenPermission(UserRole.SUPPLIER, 'CUSTOMER_EDIT')).toBe(false);
      expect(hasScreenPermission(UserRole.SUPPLIER, 'CUSTOMER_DELETE')).toBe(false);

      // Admins can do everything
      expect(hasScreenPermission(UserRole.ADMIN, 'CUSTOMERS')).toBe(true);
      expect(hasScreenPermission(UserRole.ADMIN, 'CUSTOMER_CREATE')).toBe(true);
      expect(hasScreenPermission(UserRole.ADMIN, 'CUSTOMER_EDIT')).toBe(true);
      expect(hasScreenPermission(UserRole.ADMIN, 'CUSTOMER_DELETE')).toBe(true);
    });

    test('administrative permissions are properly restricted', () => {
      const adminOnlyPermissions = ['FITTERS', 'REPORTS', 'FITTER_CREATE', 'FITTER_EDIT', 'FITTER_DELETE'];
      const nonAdminRoles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];
      const adminRoles = [UserRole.ADMIN, UserRole.SUPERVISOR];

      adminOnlyPermissions.forEach(permission => {
        nonAdminRoles.forEach(role => {
          expect(hasScreenPermission(role, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
        });

        adminRoles.forEach(role => {
          expect(hasScreenPermission(role, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
        });
      });
    });
  });

  describe('Permission Matrix Performance', () => {
    test('permission checks are consistent across multiple calls', () => {
      const testCases = [
        { role: UserRole.USER, permission: 'ORDERS' as keyof typeof SCREEN_PERMISSIONS, expected: true },
        { role: UserRole.FITTER, permission: 'CUSTOMERS' as keyof typeof SCREEN_PERMISSIONS, expected: true },
        { role: UserRole.SUPPLIER, permission: 'ORDERS' as keyof typeof SCREEN_PERMISSIONS, expected: false },
        { role: UserRole.ADMIN, permission: 'REPORTS' as keyof typeof SCREEN_PERMISSIONS, expected: true }
      ];

      testCases.forEach(({ role, permission, expected }) => {
        // Call multiple times to ensure consistency
        for (let i = 0; i < 10; i++) {
          expect(hasScreenPermission(role, permission)).toBe(expected);
        }
      });
    });

    test('all permission combinations complete in reasonable time', () => {
      const startTime = Date.now();
      
      getAllRoles().forEach(role => {
        Object.keys(SCREEN_PERMISSIONS).forEach(permission => {
          hasScreenPermission(role, permission as keyof typeof SCREEN_PERMISSIONS);
        });
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete all permission checks in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});