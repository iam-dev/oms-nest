import { hasScreenPermission, SCREEN_PERMISSIONS } from '@/utils/rolePermissions';
import { UserRole } from '@/types/Role';

describe('Account Management Permissions', () => {
  describe('SUPERVISOR-only Permissions', () => {
    const supervisorOnlyPermissions = [
      'ACCOUNT_MANAGEMENT',
      'USER_MANAGEMENT', 
      'WAREHOUSE_MANAGEMENT',
      'USER_PERMISSIONS_VIEW',
      'USER_CREATE',
      'USER_EDIT', 
      'USER_DELETE',
      'USER_VIEW',
      'WAREHOUSE_CREATE',
      'WAREHOUSE_EDIT',
      'WAREHOUSE_DELETE',
      'WAREHOUSE_VIEW'
    ];

    supervisorOnlyPermissions.forEach(permission => {
      test(`${permission} is only accessible to SUPERVISOR`, () => {
        // SUPERVISOR should have access
        expect(hasScreenPermission(UserRole.SUPERVISOR, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
        
        // All other roles should be denied
        const otherRoles = [UserRole.ADMIN, UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];
        otherRoles.forEach(role => {
          expect(hasScreenPermission(role, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
        });
      });
    });
  });

  describe('Account Management Section Access', () => {
    test('SUPERVISOR can access main Account Management section', () => {
      expect(hasScreenPermission(UserRole.SUPERVISOR, 'ACCOUNT_MANAGEMENT')).toBe(true);
    });

    test('Non-supervisor roles cannot access Account Management section', () => {
      const nonSupervisorRoles = [UserRole.ADMIN, UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];
      
      nonSupervisorRoles.forEach(role => {
        expect(hasScreenPermission(role, 'ACCOUNT_MANAGEMENT')).toBe(false);
      });
    });
  });

  describe('User Management Permissions', () => {
    test('SUPERVISOR has full user management permissions', () => {
      const userPermissions = ['USER_MANAGEMENT', 'USER_CREATE', 'USER_EDIT', 'USER_DELETE', 'USER_VIEW'];
      
      userPermissions.forEach(permission => {
        expect(hasScreenPermission(UserRole.SUPERVISOR, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
      });
    });

    test('ADMIN cannot manage users', () => {
      const userPermissions = ['USER_MANAGEMENT', 'USER_CREATE', 'USER_EDIT', 'USER_DELETE', 'USER_VIEW'];
      
      userPermissions.forEach(permission => {
        expect(hasScreenPermission(UserRole.ADMIN, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
      });
    });

    test('Regular roles cannot manage users', () => {
      const regularRoles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];
      const userPermissions = ['USER_MANAGEMENT', 'USER_CREATE', 'USER_EDIT', 'USER_DELETE', 'USER_VIEW'];
      
      regularRoles.forEach(role => {
        userPermissions.forEach(permission => {
          expect(hasScreenPermission(role, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
        });
      });
    });
  });

  describe('Warehouse Management Permissions', () => {
    test('SUPERVISOR has full warehouse management permissions', () => {
      const warehousePermissions = ['WAREHOUSE_MANAGEMENT', 'WAREHOUSE_CREATE', 'WAREHOUSE_EDIT', 'WAREHOUSE_DELETE', 'WAREHOUSE_VIEW'];
      
      warehousePermissions.forEach(permission => {
        expect(hasScreenPermission(UserRole.SUPERVISOR, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
      });
    });

    test('ADMIN cannot manage warehouses', () => {
      const warehousePermissions = ['WAREHOUSE_MANAGEMENT', 'WAREHOUSE_CREATE', 'WAREHOUSE_EDIT', 'WAREHOUSE_DELETE', 'WAREHOUSE_VIEW'];
      
      warehousePermissions.forEach(permission => {
        expect(hasScreenPermission(UserRole.ADMIN, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
      });
    });

    test('Regular roles cannot manage warehouses', () => {
      const regularRoles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];
      const warehousePermissions = ['WAREHOUSE_MANAGEMENT', 'WAREHOUSE_CREATE', 'WAREHOUSE_EDIT', 'WAREHOUSE_DELETE', 'WAREHOUSE_VIEW'];
      
      regularRoles.forEach(role => {
        warehousePermissions.forEach(permission => {
          expect(hasScreenPermission(role, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
        });
      });
    });
  });

  describe('User Permissions View', () => {
    test('SUPERVISOR can view user permissions', () => {
      expect(hasScreenPermission(UserRole.SUPERVISOR, 'USER_PERMISSIONS_VIEW')).toBe(true);
    });

    test('Non-supervisor roles cannot view user permissions', () => {
      const otherRoles = [UserRole.ADMIN, UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];
      
      otherRoles.forEach(role => {
        expect(hasScreenPermission(role, 'USER_PERMISSIONS_VIEW')).toBe(false);
      });
    });
  });

  describe('Permission Hierarchy Validation', () => {
    test('SUPERVISOR has elevated permissions beyond ADMIN', () => {
      const supervisorElevatedPermissions = [
        'ACCOUNT_MANAGEMENT',
        'USER_MANAGEMENT', 
        'WAREHOUSE_MANAGEMENT',
        'USER_PERMISSIONS_VIEW',
        'USER_CREATE',
        'USER_EDIT',
        'USER_DELETE',
        'USER_VIEW',
        'WAREHOUSE_CREATE',
        'WAREHOUSE_EDIT',
        'WAREHOUSE_DELETE',
        'WAREHOUSE_VIEW'
      ];

      supervisorElevatedPermissions.forEach(permission => {
        const supervisorAccess = hasScreenPermission(UserRole.SUPERVISOR, permission as keyof typeof SCREEN_PERMISSIONS);
        const adminAccess = hasScreenPermission(UserRole.ADMIN, permission as keyof typeof SCREEN_PERMISSIONS);
        
        expect(supervisorAccess).toBe(true);
        expect(adminAccess).toBe(false);
      });
    });

    test('SUPERVISOR retains all existing ADMIN permissions', () => {
      const sharedAdminPermissions = [
        'DASHBOARD',
        'ORDERS',
        'CUSTOMERS', 
        'FITTERS',
        'REPORTS',
        'SUPPLIERS',
        'SADDLE_MODELING',
        'BRANDS',
        'MODELS',
        'LEATHER_TYPES',
        'OPTIONS',
        'EXTRAS',
        'PRESETS',
        'ORDER_CREATE',
        'ORDER_EDIT',
        'ORDER_DELETE',
        'ORDER_APPROVE',
        'ORDER_VIEW',
        'CUSTOMER_CREATE',
        'CUSTOMER_EDIT',
        'CUSTOMER_DELETE',
        'FITTER_CREATE',
        'FITTER_EDIT',
        'FITTER_DELETE',
        'SUPPLIER_CREATE',
        'SUPPLIER_EDIT',
        'SUPPLIER_DELETE'
      ];

      sharedAdminPermissions.forEach(permission => {
        const supervisorAccess = hasScreenPermission(UserRole.SUPERVISOR, permission as keyof typeof SCREEN_PERMISSIONS);
        const adminAccess = hasScreenPermission(UserRole.ADMIN, permission as keyof typeof SCREEN_PERMISSIONS);
        
        expect(supervisorAccess).toBe(true);
        expect(adminAccess).toBe(true);
      });
    });
  });

  describe('Permission Matrix Consistency', () => {
    test('all account management permissions are properly defined', () => {
      const accountManagementPermissions = [
        'ACCOUNT_MANAGEMENT',
        'USER_MANAGEMENT',
        'WAREHOUSE_MANAGEMENT', 
        'USER_PERMISSIONS_VIEW',
        'USER_CREATE',
        'USER_EDIT',
        'USER_DELETE',
        'USER_VIEW',
        'WAREHOUSE_CREATE',
        'WAREHOUSE_EDIT',
        'WAREHOUSE_DELETE',
        'WAREHOUSE_VIEW'
      ];

      accountManagementPermissions.forEach(permission => {
        expect(SCREEN_PERMISSIONS).toHaveProperty(permission);
        expect(Array.isArray(SCREEN_PERMISSIONS[permission as keyof typeof SCREEN_PERMISSIONS])).toBe(true);
      });
    });

    test('account management permissions have valid role assignments', () => {
      const accountManagementPermissions = [
        'ACCOUNT_MANAGEMENT',
        'USER_MANAGEMENT',
        'WAREHOUSE_MANAGEMENT',
        'USER_PERMISSIONS_VIEW',
        'USER_CREATE',
        'USER_EDIT',
        'USER_DELETE',
        'USER_VIEW',
        'WAREHOUSE_CREATE',
        'WAREHOUSE_EDIT',
        'WAREHOUSE_DELETE',
        'WAREHOUSE_VIEW'
      ];

      accountManagementPermissions.forEach(permission => {
        const allowedRoles = SCREEN_PERMISSIONS[permission as keyof typeof SCREEN_PERMISSIONS];
        
        // Should only include SUPERVISOR
        expect(allowedRoles).toEqual([UserRole.SUPERVISOR]);
        expect(allowedRoles.length).toBe(1);
        expect(allowedRoles[0]).toBe(UserRole.SUPERVISOR);
      });
    });
  });

  describe('Security Validation', () => {
    test('no privilege escalation through combined permissions', () => {
      // Ensure that having multiple lower-level permissions doesn't grant higher access
      const adminPermissions = [
        'ORDERS', 'CUSTOMERS', 'FITTERS', 'REPORTS', 'SUPPLIERS',
        'ORDER_CREATE', 'ORDER_EDIT', 'ORDER_DELETE',
        'CUSTOMER_CREATE', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE'
      ];
      
      // Admin should have these permissions
      adminPermissions.forEach(permission => {
        expect(hasScreenPermission(UserRole.ADMIN, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
      });
      
      // But admin should still not have account management access
      expect(hasScreenPermission(UserRole.ADMIN, 'ACCOUNT_MANAGEMENT')).toBe(false);
      expect(hasScreenPermission(UserRole.ADMIN, 'USER_MANAGEMENT')).toBe(false);
      expect(hasScreenPermission(UserRole.ADMIN, 'WAREHOUSE_MANAGEMENT')).toBe(false);
    });

    test('role boundaries are strictly enforced', () => {
      const testCases = [
        {
          role: UserRole.ADMIN,
          shouldHave: ['FITTERS', 'REPORTS', 'SUPPLIER_CREATE'],
          shouldNotHave: ['USER_CREATE', 'WAREHOUSE_CREATE', 'ACCOUNT_MANAGEMENT']
        },
        {
          role: UserRole.FITTER, 
          shouldHave: ['CUSTOMERS', 'CUSTOMER_CREATE'],
          shouldNotHave: ['FITTERS', 'USER_CREATE', 'WAREHOUSE_CREATE', 'ACCOUNT_MANAGEMENT']
        },
        {
          role: UserRole.USER,
          shouldHave: ['DASHBOARD', 'ORDERS'],
          shouldNotHave: ['CUSTOMERS', 'USER_CREATE', 'WAREHOUSE_CREATE', 'ACCOUNT_MANAGEMENT']
        },
        {
          role: UserRole.SUPPLIER,
          shouldHave: ['DASHBOARD', 'SUPPLIERS'],
          shouldNotHave: ['ORDERS', 'CUSTOMERS', 'USER_CREATE', 'WAREHOUSE_CREATE', 'ACCOUNT_MANAGEMENT']
        }
      ];

      testCases.forEach(({ role, shouldHave, shouldNotHave }) => {
        shouldHave.forEach(permission => {
          expect(hasScreenPermission(role, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(true);
        });

        shouldNotHave.forEach(permission => {
          expect(hasScreenPermission(role, permission as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
        });
      });
    });
  });
});