import { renderHook } from '@testing-library/react';
import { useUserRole } from '@/hooks/useUserRole';
import { UserRole } from '@/types/Role';
import { getAllRoles } from '../utils/roleTestHelpers';
import * as AuthContextModule from '@/context/AuthContext';

// Mock the AuthContext
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn()
}));

const mockUseAuth = AuthContextModule.useAuth as jest.Mock;

describe('useUserRole Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Role Detection', () => {
    getAllRoles().forEach(role => {
      test(`correctly identifies ${role} role`, () => {
        mockUseAuth.mockReturnValue({
          user: { role },
          isAuthenticated: true
        });

        const { result } = renderHook(() => useUserRole());

        expect(result.current.role).toBe(role);
        
        // Test role-specific flags
        expect(result.current.isAdmin).toBe(role === UserRole.ADMIN || role === UserRole.SUPERVISOR);
        expect(result.current.isSupervisor).toBe(role === UserRole.SUPERVISOR);
        expect(result.current.isFitter).toBe(role === UserRole.FITTER);
        expect(result.current.isSupplier).toBe(role === UserRole.SUPPLIER);
        expect(result.current.isUser).toBe(role === UserRole.USER);
      });
    });

    test('handles null user', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false
      });

      const { result } = renderHook(() => useUserRole());

      expect(result.current.role).toBe(null);
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isSupervisor).toBe(false);
      expect(result.current.isFitter).toBe(false);
      expect(result.current.isSupplier).toBe(false);
      expect(result.current.isUser).toBe(false);
    });

    test('handles user without role', () => {
      mockUseAuth.mockReturnValue({
        user: { username: 'testuser' },
        isAuthenticated: true
      });

      const { result } = renderHook(() => useUserRole());

      expect(result.current.role).toBe(null);
      expect(result.current.isAdmin).toBe(false);
    });
  });

  describe('hasRole Function', () => {
    test('returns false for null role', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false
      });

      const { result } = renderHook(() => useUserRole());

      expect(result.current.hasRole(UserRole.USER)).toBe(false);
      expect(result.current.hasRole([UserRole.USER, UserRole.ADMIN])).toBe(false);
    });

    describe('Single Role Checks', () => {
      test('USER role checks', () => {
        mockUseAuth.mockReturnValue({
          user: { role: UserRole.USER },
          isAuthenticated: true
        });

        const { result } = renderHook(() => useUserRole());

        expect(result.current.hasRole(UserRole.USER)).toBe(true);
        expect(result.current.hasRole(UserRole.ADMIN)).toBe(false);
        expect(result.current.hasRole(UserRole.FITTER)).toBe(false);
      });

      test('ADMIN role checks', () => {
        mockUseAuth.mockReturnValue({
          user: { role: UserRole.ADMIN },
          isAuthenticated: true
        });

        const { result } = renderHook(() => useUserRole());

        expect(result.current.hasRole(UserRole.ADMIN)).toBe(true);
        expect(result.current.hasRole(UserRole.USER)).toBe(true); // Any authenticated user
        expect(result.current.hasRole(UserRole.FITTER)).toBe(true); // Admin has fitter permissions
        expect(result.current.hasRole(UserRole.SUPPLIER)).toBe(true); // Admin has supplier permissions
        expect(result.current.hasRole(UserRole.SUPERVISOR)).toBe(false); // Admin is not supervisor
      });

      test('SUPERVISOR role checks', () => {
        mockUseAuth.mockReturnValue({
          user: { role: UserRole.SUPERVISOR },
          isAuthenticated: true
        });

        const { result } = renderHook(() => useUserRole());

        expect(result.current.hasRole(UserRole.SUPERVISOR)).toBe(true);
        expect(result.current.hasRole(UserRole.ADMIN)).toBe(true); // Supervisor inherits admin
        expect(result.current.hasRole(UserRole.USER)).toBe(true); // Any authenticated user
        expect(result.current.hasRole(UserRole.FITTER)).toBe(true); // Supervisor has fitter permissions
        expect(result.current.hasRole(UserRole.SUPPLIER)).toBe(true); // Supervisor has supplier permissions
      });

      test('FITTER role checks', () => {
        mockUseAuth.mockReturnValue({
          user: { role: UserRole.FITTER },
          isAuthenticated: true
        });

        const { result } = renderHook(() => useUserRole());

        expect(result.current.hasRole(UserRole.FITTER)).toBe(true);
        expect(result.current.hasRole(UserRole.USER)).toBe(true); // Any authenticated user
        expect(result.current.hasRole(UserRole.ADMIN)).toBe(false);
        expect(result.current.hasRole(UserRole.SUPERVISOR)).toBe(false);
        expect(result.current.hasRole(UserRole.SUPPLIER)).toBe(false);
      });

      test('SUPPLIER role checks', () => {
        mockUseAuth.mockReturnValue({
          user: { role: UserRole.SUPPLIER },
          isAuthenticated: true
        });

        const { result } = renderHook(() => useUserRole());

        expect(result.current.hasRole(UserRole.SUPPLIER)).toBe(true);
        expect(result.current.hasRole(UserRole.USER)).toBe(true); // Any authenticated user
        expect(result.current.hasRole(UserRole.ADMIN)).toBe(false);
        expect(result.current.hasRole(UserRole.SUPERVISOR)).toBe(false);
        expect(result.current.hasRole(UserRole.FITTER)).toBe(false);
      });
    });

    describe('Multiple Role Checks', () => {
      test('array of roles - USER', () => {
        mockUseAuth.mockReturnValue({
          user: { role: UserRole.USER },
          isAuthenticated: true
        });

        const { result } = renderHook(() => useUserRole());

        expect(result.current.hasRole([UserRole.USER, UserRole.ADMIN])).toBe(true);
        expect(result.current.hasRole([UserRole.ADMIN, UserRole.SUPERVISOR])).toBe(false);
        expect(result.current.hasRole([UserRole.FITTER, UserRole.SUPPLIER])).toBe(false);
      });

      test('array of roles - ADMIN', () => {
        mockUseAuth.mockReturnValue({
          user: { role: UserRole.ADMIN },
          isAuthenticated: true
        });

        const { result } = renderHook(() => useUserRole());

        // Array check uses direct includes() - no hierarchy
        expect(result.current.hasRole([UserRole.ADMIN, UserRole.SUPERVISOR])).toBe(true);
        expect(result.current.hasRole([UserRole.USER, UserRole.FITTER])).toBe(false); // ADMIN not in array
        expect(result.current.hasRole([UserRole.SUPERVISOR])).toBe(false);
      });

      test('array of roles - SUPERVISOR', () => {
        mockUseAuth.mockReturnValue({
          user: { role: UserRole.SUPERVISOR },
          isAuthenticated: true
        });

        const { result } = renderHook(() => useUserRole());

        // Array check uses direct includes() - no hierarchy
        expect(result.current.hasRole([UserRole.ADMIN, UserRole.SUPERVISOR])).toBe(true);
        expect(result.current.hasRole([UserRole.USER, UserRole.FITTER])).toBe(false); // SUPERVISOR not in array
        expect(result.current.hasRole([UserRole.SUPERVISOR])).toBe(true);
      });
    });
  });

  describe('hasAnyRole Function', () => {
    test('returns true if user has any of the specified roles', () => {
      mockUseAuth.mockReturnValue({
        user: { role: UserRole.ADMIN },
        isAuthenticated: true
      });

      const { result } = renderHook(() => useUserRole());

      expect(result.current.hasAnyRole([UserRole.ADMIN, UserRole.SUPERVISOR])).toBe(true);
      expect(result.current.hasAnyRole([UserRole.USER, UserRole.FITTER])).toBe(true); // Admin has these permissions
      expect(result.current.hasAnyRole([UserRole.SUPERVISOR])).toBe(false); // Admin is not supervisor
    });

    test('returns false if user has none of the specified roles', () => {
      mockUseAuth.mockReturnValue({
        user: { role: UserRole.USER },
        isAuthenticated: true
      });

      const { result } = renderHook(() => useUserRole());

      expect(result.current.hasAnyRole([UserRole.ADMIN, UserRole.SUPERVISOR])).toBe(false);
      expect(result.current.hasAnyRole([UserRole.FITTER, UserRole.SUPPLIER])).toBe(false);
      expect(result.current.hasAnyRole([UserRole.USER])).toBe(true);
    });

    test('returns false for null role', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false
      });

      const { result } = renderHook(() => useUserRole());

      expect(result.current.hasAnyRole([UserRole.USER, UserRole.ADMIN])).toBe(false);
    });
  });

  describe('Role Hierarchy', () => {
    test('supervisor has admin permissions', () => {
      mockUseAuth.mockReturnValue({
        user: { role: UserRole.SUPERVISOR },
        isAuthenticated: true
      });

      const { result } = renderHook(() => useUserRole());

      expect(result.current.hasRole(UserRole.ADMIN)).toBe(true);
      expect(result.current.hasRole(UserRole.SUPERVISOR)).toBe(true);
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isSupervisor).toBe(true);
    });

    test('admin has elevated permissions but not supervisor', () => {
      mockUseAuth.mockReturnValue({
        user: { role: UserRole.ADMIN },
        isAuthenticated: true
      });

      const { result } = renderHook(() => useUserRole());

      expect(result.current.hasRole(UserRole.ADMIN)).toBe(true);
      expect(result.current.hasRole(UserRole.FITTER)).toBe(true);
      expect(result.current.hasRole(UserRole.SUPPLIER)).toBe(true);
      expect(result.current.hasRole(UserRole.SUPERVISOR)).toBe(false);
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isSupervisor).toBe(false);
    });

    test('regular roles do not have elevated permissions', () => {
      const regularRoles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER];
      
      regularRoles.forEach(role => {
        mockUseAuth.mockReturnValue({
          user: { role },
          isAuthenticated: true
        });

        const { result } = renderHook(() => useUserRole());

        if (role !== UserRole.FITTER) {
          expect(result.current.hasRole(UserRole.FITTER)).toBe(false);
        }
        if (role !== UserRole.SUPPLIER) {
          expect(result.current.hasRole(UserRole.SUPPLIER)).toBe(false);
        }
        expect(result.current.hasRole(UserRole.ADMIN)).toBe(false);
        expect(result.current.hasRole(UserRole.SUPERVISOR)).toBe(false);
      });
    });
  });
});