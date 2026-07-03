import { renderHook } from '@testing-library/react';
import { useRolePermission } from '@/components/shared/RoleProtectedComponent';
import { UserRole } from '@/types/Role';
import { SCREEN_PERMISSIONS } from '@/utils/rolePermissions';
import * as useUserRoleModule from '@/hooks/useUserRole';

type ScreenKey = keyof typeof SCREEN_PERMISSIONS;

// Mock the useUserRole hook
jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: jest.fn()
}));

const mockUseUserRole = useUserRoleModule.useUserRole as jest.Mock;

describe('useRolePermission Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Permission-based access', () => {
    test('grants access when user has required permission', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: jest.fn()
      });

      // Mock hasScreenPermission to return true for admin
      jest.doMock('@/utils/rolePermissions', () => ({
        hasScreenPermission: jest.fn((role, permission) => {
          if (role === UserRole.ADMIN && permission === 'ORDERS') return true;
          return false;
        })
      }));

      const { result } = renderHook(() => useRolePermission('ORDERS'));
      expect(result.current).toBe(true);
    });

    test('denies access when user lacks required permission', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn()
      });

      // Mock hasScreenPermission to return false for user trying to access fitters
      jest.doMock('@/utils/rolePermissions', () => ({
        hasScreenPermission: jest.fn((role, permission) => {
          if (role === UserRole.USER && permission === 'FITTERS') return false;
          return false;
        })
      }));

      const { result } = renderHook(() => useRolePermission('FITTERS'));
      expect(result.current).toBe(false);
    });
  });

  describe('Role-based access', () => {
    test('grants access for single required role', () => {
      const mockHasRole = jest.fn().mockReturnValue(true);
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: mockHasRole
      });

      const { result } = renderHook(() => useRolePermission(undefined, UserRole.ADMIN));
      
      expect(result.current).toBe(true);
      expect(mockHasRole).toHaveBeenCalledWith(UserRole.ADMIN);
    });

    test('grants access for multiple required roles', () => {
      const mockHasRole = jest.fn().mockReturnValue(true);
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: mockHasRole
      });

      const requiredRoles = [UserRole.ADMIN, UserRole.SUPERVISOR];
      const { result } = renderHook(() => useRolePermission(undefined, requiredRoles));
      
      expect(result.current).toBe(true);
      expect(mockHasRole).toHaveBeenCalledWith(requiredRoles);
    });

    test('denies access when user lacks required role', () => {
      const mockHasRole = jest.fn().mockReturnValue(false);
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: mockHasRole
      });

      const { result } = renderHook(() => useRolePermission(undefined, UserRole.ADMIN));
      
      expect(result.current).toBe(false);
      expect(mockHasRole).toHaveBeenCalledWith(UserRole.ADMIN);
    });
  });

  describe('Custom check function', () => {
    test('uses custom check when provided', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn()
      });

      const customCheck = jest.fn().mockReturnValue(true);
      const { result } = renderHook(() => 
        useRolePermission(undefined, undefined, customCheck)
      );
      
      expect(result.current).toBe(true);
      expect(customCheck).toHaveBeenCalledWith(UserRole.USER);
    });

    test('custom check takes precedence over other parameters', () => {
      const mockHasRole = jest.fn();
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: mockHasRole
      });

      const customCheck = jest.fn().mockReturnValue(false);
      const { result } = renderHook(() => 
        useRolePermission('DASHBOARD', UserRole.USER, customCheck)
      );
      
      expect(result.current).toBe(false);
      expect(customCheck).toHaveBeenCalledWith(UserRole.USER);
      expect(mockHasRole).not.toHaveBeenCalled();
    });

    test('custom check receives null role', () => {
      mockUseUserRole.mockReturnValue({
        role: null,
        hasRole: jest.fn()
      });

      const customCheck = jest.fn().mockReturnValue(false);
      const { result } = renderHook(() => 
        useRolePermission(undefined, undefined, customCheck)
      );
      
      expect(result.current).toBe(false);
      expect(customCheck).toHaveBeenCalledWith(null);
    });
  });

  describe('Default behavior', () => {
    test('returns true when no restrictions specified', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn()
      });

      const { result } = renderHook(() => useRolePermission());
      expect(result.current).toBe(true);
    });

    test('returns true when no restrictions specified and user is null', () => {
      mockUseUserRole.mockReturnValue({
        role: null,
        hasRole: jest.fn()
      });

      const { result } = renderHook(() => useRolePermission());
      expect(result.current).toBe(true);
    });
  });

  describe('Real-world scenarios', () => {
    test('admin can access all order actions', () => {
      const mockHasRole = jest.fn().mockReturnValue(true);
      mockUseUserRole.mockReturnValue({
        role: UserRole.ADMIN,
        hasRole: mockHasRole
      });

      // Mock hasScreenPermission for admin order actions
      jest.doMock('@/utils/rolePermissions', () => ({
        hasScreenPermission: jest.fn((role, permission) => {
          const adminPermissions = ['ORDER_CREATE', 'ORDER_EDIT', 'ORDER_DELETE', 'ORDER_APPROVE'];
          return role === UserRole.ADMIN && adminPermissions.includes(permission);
        })
      }));

      const orderActions: ScreenKey[] = ['ORDER_CREATE', 'ORDER_EDIT', 'ORDER_DELETE', 'ORDER_APPROVE'];
      
      orderActions.forEach(action => {
        const { result } = renderHook(() => useRolePermission(action));
        expect(result.current).toBe(true);
      });
    });

    test('user can only create and view orders', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.USER,
        hasRole: jest.fn()
      });

      // Mock hasScreenPermission for user order actions
      jest.doMock('@/utils/rolePermissions', () => ({
        hasScreenPermission: jest.fn((role, permission) => {
          const userPermissions = ['ORDER_CREATE', 'ORDER_VIEW'];
          return role === UserRole.USER && userPermissions.includes(permission);
        })
      }));

      const allowedActions: ScreenKey[] = ['ORDER_CREATE', 'ORDER_VIEW'];
      const deniedActions: ScreenKey[] = ['ORDER_EDIT', 'ORDER_DELETE', 'ORDER_APPROVE'];
      
      allowedActions.forEach(action => {
        const { result } = renderHook(() => useRolePermission(action));
        expect(result.current).toBe(true);
      });

      deniedActions.forEach(action => {
        const { result } = renderHook(() => useRolePermission(action));
        expect(result.current).toBe(false);
      });
    });

    test('fitter can access customers but not fitters management', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.FITTER,
        hasRole: jest.fn()
      });

      // Mock hasScreenPermission for fitter access
      jest.doMock('@/utils/rolePermissions', () => ({
        hasScreenPermission: jest.fn((role, permission) => {
          if (role === UserRole.FITTER) {
            return ['CUSTOMERS', 'CUSTOMER_CREATE', 'CUSTOMER_EDIT'].includes(permission);
          }
          return false;
        })
      }));

      // Should have access to customer management
      const { result: customersResult } = renderHook(() => useRolePermission('CUSTOMERS'));
      expect(customersResult.current).toBe(true);

      const { result: customerCreateResult } = renderHook(() => useRolePermission('CUSTOMER_CREATE'));
      expect(customerCreateResult.current).toBe(true);

      // Should not have access to fitter management
      const { result: fittersResult } = renderHook(() => useRolePermission('FITTERS'));
      expect(fittersResult.current).toBe(false);

      const { result: customerDeleteResult } = renderHook(() => useRolePermission('CUSTOMER_DELETE'));
      expect(customerDeleteResult.current).toBe(false);
    });

    test('supplier can only access supplier-related features', () => {
      mockUseUserRole.mockReturnValue({
        role: UserRole.SUPPLIER,
        hasRole: jest.fn()
      });

      // Mock hasScreenPermission for supplier access
      jest.doMock('@/utils/rolePermissions', () => ({
        hasScreenPermission: jest.fn((role, permission) => {
          if (role === UserRole.SUPPLIER) {
            return ['DASHBOARD', 'SUPPLIERS'].includes(permission);
          }
          return false;
        })
      }));

      // Should have access to dashboard and suppliers
      const { result: dashboardResult } = renderHook(() => useRolePermission('DASHBOARD'));
      expect(dashboardResult.current).toBe(true);

      const { result: suppliersResult } = renderHook(() => useRolePermission('SUPPLIERS'));
      expect(suppliersResult.current).toBe(true);

      // Should not have access to orders or customers
      const { result: ordersResult } = renderHook(() => useRolePermission('ORDERS'));
      expect(ordersResult.current).toBe(false);

      const { result: customersResult } = renderHook(() => useRolePermission('CUSTOMERS'));
      expect(customersResult.current).toBe(false);
    });
  });
});