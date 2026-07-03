import {
  hasScreenPermission,
  canEditOrder,
  getRoleDisplayName,
  SCREEN_PERMISSIONS,
  NAVIGATION_ITEMS,
  SADDLE_MODELING_ITEMS,
} from '@/utils/rolePermissions';
import { UserRole } from '@/types/Role';
import { FITTER_RESTRICTED_STATUSES } from '@/utils/orderConstants';

type ScreenType = keyof typeof SCREEN_PERMISSIONS;

describe('Role Permissions System', () => {
  describe('Screen Permissions', () => {
    describe('ADMIN Role', () => {
      it('should have access to all admin-permitted screens', () => {
        const adminScreens: ScreenType[] = [
          'DASHBOARD',
          'ORDERS',
          'CUSTOMERS',
          'FITTERS',
          'REPORTS',
          'BRANDS',
          'MODELS',
          'LEATHER_TYPES',
          'OPTIONS',
          'EXTRAS',
          'PRESETS',
          'SUPPLIERS',
          'SADDLE_MODELING',
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
          'SUPPLIER_DELETE',
          'REPAIRS',
          'ALL_SADDLE_STOCK',
        ];

        adminScreens.forEach(screen => {
          expect(hasScreenPermission(UserRole.ADMIN, screen)).toBe(true);
        });
      });

      it('should NOT have access to user management screens (supervisor-only)', () => {
        const userManagementScreens: ScreenType[] = [
          'USER_CREATE',
          'USER_EDIT',
          'USER_DELETE',
          'USER_VIEW',
          'WAREHOUSE_CREATE',
          'WAREHOUSE_EDIT',
          'WAREHOUSE_DELETE',
          'WAREHOUSE_VIEW',
        ];

        userManagementScreens.forEach(screen => {
          expect(hasScreenPermission(UserRole.ADMIN, screen)).toBe(false);
        });
      });
    });

    describe('SUPERVISOR Role', () => {
      it('should have access to all screens that include SUPERVISOR or ADMIN in allowed roles', () => {
        const allScreens = Object.keys(SCREEN_PERMISSIONS) as ScreenType[];

        // SUPERVISOR inherits ADMIN permissions but NOT fitter-only permissions
        const fitterOnlyScreens = ['MY_SADDLE_STOCK', 'AVAILABLE_SADDLE_STOCK'];

        allScreens.forEach(screen => {
          if (fitterOnlyScreens.includes(screen)) {
            expect(hasScreenPermission(UserRole.SUPERVISOR, screen)).toBe(false);
          } else {
            expect(hasScreenPermission(UserRole.SUPERVISOR, screen)).toBe(true);
          }
        });
      });

      it('should inherit all admin permissions', () => {
        const adminScreens: ScreenType[] = [
          'REPORTS',
          'ORDERS',
          'CUSTOMERS',
          'FITTERS',
        ];

        adminScreens.forEach(screen => {
          expect(hasScreenPermission(UserRole.SUPERVISOR, screen)).toBe(true);
        });
      });
    });

    describe('FITTER Role', () => {
      it('should have access to fitter-permitted screens', () => {
        const fitterScreens: ScreenType[] = [
          'DASHBOARD',
          'ORDERS',
          'CUSTOMERS',
          'ORDER_CREATE',
          'ORDER_VIEW',
          'CUSTOMER_CREATE',
          'CUSTOMER_EDIT',
        ];

        fitterScreens.forEach(screen => {
          expect(hasScreenPermission(UserRole.FITTER, screen)).toBe(true);
        });
      });

      it('should not have access to admin/supervisor screens', () => {
        const restrictedScreens: ScreenType[] = [
          'REPORTS',
          'FITTERS',
          'SUPPLIERS',
          'ORDER_DELETE',
          'ORDER_APPROVE',
          'CUSTOMER_DELETE',
        ];

        restrictedScreens.forEach(screen => {
          expect(hasScreenPermission(UserRole.FITTER, screen)).toBe(false);
        });
      });
    });

    describe('USER Role', () => {
      it('should have access to basic user screens', () => {
        const userScreens: ScreenType[] = [
          'DASHBOARD',
          'ORDERS',
          'SADDLE_MODELING',
          'BRANDS',
          'MODELS',
          'LEATHER_TYPES',
          'OPTIONS',
          'EXTRAS',
          'PRESETS',
          'ORDER_CREATE',
          'ORDER_VIEW',
          'REPAIRS',
        ];

        userScreens.forEach(screen => {
          expect(hasScreenPermission(UserRole.USER, screen)).toBe(true);
        });
      });

      it('should not have access to administrative screens', () => {
        const restrictedScreens: ScreenType[] = [
          'REPORTS',
          'CUSTOMERS',
          'FITTERS',
          'SUPPLIERS',
          'ORDER_EDIT',
          'ORDER_DELETE',
          'ORDER_APPROVE',
          'CUSTOMER_CREATE',
          'CUSTOMER_EDIT',
          'CUSTOMER_DELETE',
        ];

        restrictedScreens.forEach(screen => {
          expect(hasScreenPermission(UserRole.USER, screen)).toBe(false);
        });
      });
    });

    describe('SUPPLIER Role', () => {
      it('should have access to supplier-relevant screens', () => {
        const supplierScreens: ScreenType[] = [
          'DASHBOARD',
          'SUPPLIERS',
          'ORDER_VIEW',
        ];

        supplierScreens.forEach(screen => {
          expect(hasScreenPermission(UserRole.SUPPLIER, screen)).toBe(true);
        });
      });

      it('should not have access to management screens', () => {
        const restrictedScreens: ScreenType[] = [
          'REPORTS',
          'CUSTOMERS',
          'FITTERS',
          'ORDERS', // Suppliers can't access general orders page
          'SADDLE_MODELING',
          'ORDER_CREATE',
          'ORDER_EDIT',
          'ORDER_DELETE',
        ];

        restrictedScreens.forEach(screen => {
          expect(hasScreenPermission(UserRole.SUPPLIER, screen)).toBe(false);
        });
      });
    });
  });

  describe('Role Display Names', () => {
    it('should return correct display names for all roles', () => {
      expect(getRoleDisplayName(UserRole.SUPERVISOR)).toBe('Supervisor');
      expect(getRoleDisplayName(UserRole.ADMIN)).toBe('Administrator');
      expect(getRoleDisplayName(UserRole.FITTER)).toBe('Fitter');
      expect(getRoleDisplayName(UserRole.SUPPLIER)).toBe('Factory');
      expect(getRoleDisplayName(UserRole.USER)).toBe('User');
    });

    it('should handle unknown role gracefully', () => {
      expect(getRoleDisplayName('UNKNOWN' as UserRole)).toBe('Unknown');
    });
  });

  // Removing Action Permissions tests since canPerformAction doesn't exist
  // describe('Action Permissions', () => {
  // });

  describe('Screen Permissions Configuration', () => {
    it('should have all expected screen permissions defined', () => {
      const expectedScreens = [
        'DASHBOARD',
        'ORDERS',
        'CUSTOMERS',
        'FITTERS',
        'REPORTS',
        'SADDLE_MODELING',
        'BRANDS',
        'MODELS',
        'LEATHER_TYPES',
        'OPTIONS',
        'EXTRAS',
        'PRESETS',
        'SUPPLIERS',
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
        'SUPPLIER_DELETE',
        'REPAIRS',
        'MY_SADDLE_STOCK',
        'AVAILABLE_SADDLE_STOCK',
        'ALL_SADDLE_STOCK',
        'ACCOUNT_MANAGEMENT',
        'USER_MANAGEMENT',
        'WAREHOUSE_MANAGEMENT',
        'USER_PERMISSIONS_VIEW',
        'ACCESS_FILTER_GROUPS',
        'WAREHOUSES',
        'COUNTRY_MANAGERS',
        'SUPPLIERS_MANAGEMENT',
        'USER_CREATE',
        'USER_EDIT',
        'USER_DELETE',
        'USER_VIEW',
        'WAREHOUSE_CREATE',
        'WAREHOUSE_EDIT',
        'WAREHOUSE_DELETE',
        'WAREHOUSE_VIEW',
      ];

      expectedScreens.forEach(screen => {
        expect(SCREEN_PERMISSIONS).toHaveProperty(screen);
        expect(Array.isArray(SCREEN_PERMISSIONS[screen as ScreenType])).toBe(true);
      });
    });

    it('should have navigation items properly configured', () => {
      expect(Array.isArray(NAVIGATION_ITEMS)).toBe(true);
      expect(NAVIGATION_ITEMS.length).toBeGreaterThan(0);
      
      NAVIGATION_ITEMS.forEach(item => {
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('href');
        expect(item).toHaveProperty('permission');
        expect(SCREEN_PERMISSIONS).toHaveProperty(item.permission);
      });
    });

    it('should have saddle modeling items properly configured', () => {
      expect(Array.isArray(SADDLE_MODELING_ITEMS)).toBe(true);
      expect(SADDLE_MODELING_ITEMS.length).toBeGreaterThan(0);
      
      SADDLE_MODELING_ITEMS.forEach(item => {
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('href');
        expect(item).toHaveProperty('permission');
        expect(SCREEN_PERMISSIONS).toHaveProperty(item.permission);
      });
    });
  });

  describe('Role Hierarchy Verification', () => {
    it('should ensure SUPERVISOR inherits ADMIN permissions', () => {
      // Test that supervisor has access to admin screens
      const adminOnlyScreens: ScreenType[] = ['REPORTS', 'FITTERS'];
      
      adminOnlyScreens.forEach(screen => {
        expect(hasScreenPermission(UserRole.ADMIN, screen)).toBe(true);
        expect(hasScreenPermission(UserRole.SUPERVISOR, screen)).toBe(true);
      });
    });

    it('should verify role hierarchy is properly enforced', () => {
      // Test specific role combinations
      const testCases = [
        { role: UserRole.SUPERVISOR, screen: 'USER_CREATE' as ScreenType, expected: true },
        { role: UserRole.ADMIN, screen: 'USER_CREATE' as ScreenType, expected: false }, // ADMIN does NOT have access
        { role: UserRole.FITTER, screen: 'REPORTS' as ScreenType, expected: false },
        { role: UserRole.USER, screen: 'CUSTOMERS' as ScreenType, expected: false },
        { role: UserRole.SUPPLIER, screen: 'ORDERS' as ScreenType, expected: false },
      ];

      testCases.forEach(({ role, screen, expected }) => {
        expect(hasScreenPermission(role, screen)).toBe(expected);
      });
    });
  });


  describe('canEditOrder - Status-based Edit Restrictions', () => {
    describe('Admin role', () => {
      it('can edit orders in any status', () => {
        FITTER_RESTRICTED_STATUSES.forEach(status => {
          expect(canEditOrder(UserRole.ADMIN, status)).toBe(true);
        });
        expect(canEditOrder(UserRole.ADMIN, 'Unordered')).toBe(true);
        expect(canEditOrder(UserRole.ADMIN, 'Ordered')).toBe(true);
        expect(canEditOrder(UserRole.ADMIN, 'On hold')).toBe(true);
      });

      it('can edit when status is undefined', () => {
        expect(canEditOrder(UserRole.ADMIN, undefined)).toBe(true);
      });
    });

    describe('Supervisor role', () => {
      it('can edit orders in any status', () => {
        FITTER_RESTRICTED_STATUSES.forEach(status => {
          expect(canEditOrder(UserRole.SUPERVISOR, status)).toBe(true);
        });
        expect(canEditOrder(UserRole.SUPERVISOR, 'Unordered')).toBe(true);
        expect(canEditOrder(UserRole.SUPERVISOR, 'Ordered')).toBe(true);
      });

      it('can edit when status is undefined', () => {
        expect(canEditOrder(UserRole.SUPERVISOR, undefined)).toBe(true);
      });
    });

    describe('Fitter role', () => {
      it('can edit orders in non-restricted statuses', () => {
        expect(canEditOrder(UserRole.FITTER, 'Unordered')).toBe(true);
        expect(canEditOrder(UserRole.FITTER, 'Ordered')).toBe(true);
        expect(canEditOrder(UserRole.FITTER, 'On hold')).toBe(true);
        expect(canEditOrder(UserRole.FITTER, 'On trial')).toBe(true);
        expect(canEditOrder(UserRole.FITTER, 'Changed')).toBe(true);
        expect(canEditOrder(UserRole.FITTER, 'Awaiting Client Confirmation')).toBe(true);
      });

      it('cannot edit orders in restricted statuses', () => {
        FITTER_RESTRICTED_STATUSES.forEach(status => {
          expect(canEditOrder(UserRole.FITTER, status)).toBe(false);
        });
      });

      // FE-035: fitter must fail closed when status is unknown — backend is authoritative.
      it('cannot edit when status is undefined (fail-closed)', () => {
        expect(canEditOrder(UserRole.FITTER, undefined)).toBe(false);
      });

      it('has base ORDER_EDIT screen permission', () => {
        expect(hasScreenPermission(UserRole.FITTER, 'ORDER_EDIT')).toBe(true);
      });
    });

    describe('Other roles', () => {
      it('USER cannot edit orders regardless of status', () => {
        expect(canEditOrder(UserRole.USER, 'Unordered')).toBe(false);
        expect(canEditOrder(UserRole.USER, 'Approved')).toBe(false);
      });

      it('SUPPLIER cannot edit orders regardless of status', () => {
        expect(canEditOrder(UserRole.SUPPLIER, 'Unordered')).toBe(false);
        expect(canEditOrder(UserRole.SUPPLIER, 'Approved')).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('returns false for null role', () => {
        expect(canEditOrder(null, 'Unordered')).toBe(false);
      });

      it('restricted statuses list contains expected statuses', () => {
        expect(FITTER_RESTRICTED_STATUSES).toContain('Approved');
        expect(FITTER_RESTRICTED_STATUSES).toContain('In Production P1');
        expect(FITTER_RESTRICTED_STATUSES).toContain('In Production P2');
        expect(FITTER_RESTRICTED_STATUSES).toContain('In Production P3');
        expect(FITTER_RESTRICTED_STATUSES).toContain('Shipped to Fitter');
        expect(FITTER_RESTRICTED_STATUSES).toContain('Shipped to Customer');
        expect(FITTER_RESTRICTED_STATUSES).toContain('Completed sale');
        expect(FITTER_RESTRICTED_STATUSES).toHaveLength(7);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null role gracefully', () => {
      expect(hasScreenPermission(null, 'DASHBOARD')).toBe(false);
    });

    it('should handle invalid screen gracefully', () => {
      expect(hasScreenPermission(UserRole.ADMIN, 'INVALID_SCREEN' as ScreenType)).toBe(false);
    });

    it('should handle undefined values gracefully', () => {
      expect(hasScreenPermission(undefined as unknown as null, 'DASHBOARD')).toBe(false);
      expect(hasScreenPermission(UserRole.ADMIN, undefined as unknown as keyof typeof SCREEN_PERMISSIONS)).toBe(false);
    });
  });

  describe('Specific Business Rules', () => {
    it('should enforce fitter-specific business rules', () => {
      // Fitters can access orders and customers
      expect(hasScreenPermission(UserRole.FITTER, 'ORDERS')).toBe(true);
      expect(hasScreenPermission(UserRole.FITTER, 'CUSTOMERS')).toBe(true);
      expect(hasScreenPermission(UserRole.FITTER, 'ORDER_CREATE')).toBe(true);
      expect(hasScreenPermission(UserRole.FITTER, 'CUSTOMER_CREATE')).toBe(true);
      
      // But cannot delete or access administrative functions
      expect(hasScreenPermission(UserRole.FITTER, 'ORDER_DELETE')).toBe(false);
      expect(hasScreenPermission(UserRole.FITTER, 'REPORTS')).toBe(false);
    });

    it('should enforce supplier-specific business rules', () => {
      // Suppliers can access their own supplier management
      expect(hasScreenPermission(UserRole.SUPPLIER, 'SUPPLIERS')).toBe(true);
      expect(hasScreenPermission(UserRole.SUPPLIER, 'ORDER_VIEW')).toBe(true);
      
      // Cannot access customer management or reports
      expect(hasScreenPermission(UserRole.SUPPLIER, 'CUSTOMERS')).toBe(false);
      expect(hasScreenPermission(UserRole.SUPPLIER, 'REPORTS')).toBe(false);
      expect(hasScreenPermission(UserRole.SUPPLIER, 'ORDERS')).toBe(false);
    });

    it('should enforce user-specific business rules', () => {
      // Users can create orders and access saddle modeling
      expect(hasScreenPermission(UserRole.USER, 'ORDER_CREATE')).toBe(true);
      expect(hasScreenPermission(UserRole.USER, 'ORDER_VIEW')).toBe(true);
      expect(hasScreenPermission(UserRole.USER, 'SADDLE_MODELING')).toBe(true);
      expect(hasScreenPermission(UserRole.USER, 'BRANDS')).toBe(true);
      
      // Cannot edit orders or manage customers
      expect(hasScreenPermission(UserRole.USER, 'ORDER_EDIT')).toBe(false);
      expect(hasScreenPermission(UserRole.USER, 'CUSTOMERS')).toBe(false);
    });
  });

  describe('Multi-Role Scenario Implications', () => {
    it('should understand implications of role priority mapping', () => {
      // If a user has both ADMIN and FITTER roles, they get ADMIN permissions
      // This means they would NOT get automatic fitter filtering
      
      // These tests verify that the permission system is consistent
      // with the role mapping logic in AuthContext
      
      // ADMIN permissions (highest priority among ADMIN+FITTER)
      expect(hasScreenPermission(UserRole.ADMIN, 'REPORTS')).toBe(true);
      expect(hasScreenPermission(UserRole.ADMIN, 'ORDER_DELETE')).toBe(true);
      
      // FITTER permissions (would be overridden by ADMIN in multi-role scenario)
      expect(hasScreenPermission(UserRole.FITTER, 'REPORTS')).toBe(false);
      expect(hasScreenPermission(UserRole.FITTER, 'ORDER_DELETE')).toBe(false);
    });

    it('should verify supervisor inherits all admin capabilities', () => {
      // Important for multi-role scenarios where user might have SUPERVISOR+ADMIN
      const adminScreens: ScreenType[] = [
        'DASHBOARD', 'ORDERS', 'CUSTOMERS', 'FITTERS', 'REPORTS',
        'BRANDS', 'MODELS', 'LEATHER_TYPES', 'OPTIONS', 'EXTRAS', 'PRESETS',
      ];

      adminScreens.forEach(screen => {
        const adminHasAccess = hasScreenPermission(UserRole.ADMIN, screen);
        const supervisorHasAccess = hasScreenPermission(UserRole.SUPERVISOR, screen);

        if (adminHasAccess) {
          expect(supervisorHasAccess).toBe(true);
        }
      });
    });
  });

  // FE-034: SUPERVISOR is strictly superior to ADMIN — every screen ADMIN can access,
  // SUPERVISOR must also be able to access.
  describe('FE-034 — SUPERVISOR strictly superior to ADMIN', () => {
    it('SUPERVISOR can access every screen that ADMIN can access', () => {
      const allScreens = Object.keys(SCREEN_PERMISSIONS) as ScreenType[];
      allScreens.forEach((screen) => {
        if (hasScreenPermission(UserRole.ADMIN, screen)) {
          expect(hasScreenPermission(UserRole.SUPERVISOR, screen)).toBe(true);
        }
      });
    });

    it('SUPERVISOR has exclusive access to ADMIN-inaccessible management screens', () => {
      const supervisorExclusiveScreens: ScreenType[] = [
        'USER_CREATE',
        'USER_EDIT',
        'USER_DELETE',
        'USER_VIEW',
        'WAREHOUSE_CREATE',
        'WAREHOUSE_EDIT',
        'WAREHOUSE_DELETE',
        'WAREHOUSE_VIEW',
      ];
      supervisorExclusiveScreens.forEach((screen) => {
        expect(hasScreenPermission(UserRole.SUPERVISOR, screen)).toBe(true);
        expect(hasScreenPermission(UserRole.ADMIN, screen)).toBe(false);
      });
    });
  });
});