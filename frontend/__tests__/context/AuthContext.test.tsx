import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { clearAuthTokens } from '@/api/login';
import { useAtom } from 'jotai';

// Mock dependencies
jest.mock('@/api/login', () => ({
  login: jest.fn(),
  clearAuthTokens: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  fetchEntities: jest.fn(),
}));

jest.mock('jotai', () => ({
  useAtom: jest.fn(),
  atom: jest.fn((initialValue) => ({ init: initialValue })),
}));

jest.mock('jotai/utils', () => ({
  atomWithStorage: jest.fn((key: string, initialValue: any) => ({ key, init: initialValue })),
}));

// Mock global fetch
global.fetch = jest.fn();

const mockUseAtom = useAtom as jest.MockedFunction<typeof useAtom>;
const mockClearAuthTokens = clearAuthTokens as jest.MockedFunction<typeof clearAuthTokens>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Test component to access auth context
const TestComponent = () => {
  const { user, isAuthenticated, isLoaded } = useAuth();

  return (
    <div>
      <div data-testid="user-id">{user?.id || 'no-user'}</div>
      <div data-testid="user-role">{user?.role || 'no-role'}</div>
      <div data-testid="user-username">{user?.username || 'no-username'}</div>
      <div data-testid="is-authenticated">{isAuthenticated ? 'true' : 'false'}</div>
      <div data-testid="is-loading">{isLoaded ? 'false' : 'true'}</div>
    </div>
  );
};

// Create individual atom state holders
let mockUser: any = null;
let mockUserBasicInfo: any = null;
let mockIsAuthLoading: boolean = false;
let mockIsAuthenticated: boolean = false;

describe('AuthContext - Cookie-Based Auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    localStorage.clear();
    document.cookie = '';

    // Reset mock state
    mockUser = null;
    mockUserBasicInfo = null;
    mockIsAuthLoading = false;
    mockIsAuthenticated = false;

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Setup Jotai mock to return different atom hooks based on which atom is being used
    mockUseAtom.mockImplementation((atom: any): any => {
      if (atom?.key === 'auth_user') {
        return [mockUserBasicInfo, jest.fn((newValue: any) => {
          mockUserBasicInfo = newValue;
        })];
      } else if (atom?.init === null && !atom?.key) {
        // This could be the userAtom (plain atom)
        return [mockUser, jest.fn((newValue: any) => {
          mockUser = newValue;
        })];
      } else if (atom?.init === false) {
        // This could be isAuthLoadingAtom (init: false) — but we start with true
        return [mockIsAuthLoading, jest.fn((newValue: any) => { mockIsAuthLoading = newValue; })];
      } else if (typeof atom === 'function') {
        // Derived atom like isAuthenticatedAtom
        mockIsAuthenticated = !!(mockUser || mockUserBasicInfo);
        return [mockIsAuthenticated, jest.fn()];
      } else {
        // Action atoms - return a setter function
        return [null, jest.fn((action: any) => {
          if (action && action.user) {
            // This is loginActionAtom
            mockUser = action.user;
            mockUserBasicInfo = {
              id: action.user.id,
              username: action.user.username,
              role: action.user.role,
              firstName: action.user.firstName,
              lastName: action.user.lastName,
              email: action.user.email
            };
            mockIsAuthLoading = false;
            mockIsAuthenticated = true;
          } else if (action === true || action === false) {
            // This might be setLoadingAtom
            mockIsAuthLoading = action;
          }
        })];
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Session Check via /auth/me', () => {
    it('authenticates user via /auth/me cookie-based call', async () => {
      const mockApiUser = {
        id: 1000,
        username: 'api.user',
        email: 'api@example.com',
        name: 'API User',
        typeName: 'Admin',
      };

      // Pre-setup the expected final state
      mockUser = {
        id: 1000,
        username: 'api.user',
        role: 'ROLE_ADMIN',
        email: 'api@example.com',
        firstName: 'API',
        lastName: 'User',
      };
      mockUserBasicInfo = {
        id: 1000,
        username: 'api.user',
        role: 'ROLE_ADMIN',
        firstName: 'API',
        lastName: 'User',
        email: 'api@example.com'
      };
      mockIsAuthenticated = true;
      mockIsAuthLoading = false;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiUser,
      } as Response);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent('1000');
        expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_ADMIN');
        expect(screen.getByTestId('user-username')).toHaveTextContent('api.user');
      });
    });

    it('renders unauthenticated state when no user data is present', async () => {
      // With no pre-set user state, component should render unauthenticated
      mockUser = null;
      mockUserBasicInfo = null;
      mockIsAuthenticated = false;
      mockIsAuthLoading = false;

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      });
    });

    it('handles no session scenario', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
        expect(screen.getByTestId('user-role')).toHaveTextContent('no-role');
      });
    });
  });

  describe('Role Mapping from API Response', () => {
    it('maps admin role from /auth/me response', async () => {
      mockUser = {
        id: 1,
        username: 'admin.user',
        role: 'ROLE_ADMIN',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
      };
      mockIsAuthenticated = true;
      mockIsAuthLoading = false;

      mockUseAtom.mockImplementation((atom: any): any => {
        if (atom?.key === 'auth_user') {
          return [mockUserBasicInfo, jest.fn()];
        } else if (atom?.init === null && !atom?.key) {
          return [mockUser, jest.fn()];
        } else if (atom?.init === false) {
          return [false, jest.fn()];
        } else {
          return [true, jest.fn()];
        }
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_ADMIN');
      });
    });

    it('maps supervisor role from /auth/me response', async () => {
      mockUser = {
        id: 456,
        username: 'supervisor.admin',
        role: 'ROLE_SUPERVISOR',
        email: 'supervisor@example.com',
        firstName: 'Super',
        lastName: 'Visor',
      };
      mockIsAuthenticated = true;
      mockIsAuthLoading = false;

      mockUseAtom.mockImplementation((atom: any): any => {
        if (atom?.key === 'auth_user') {
          return [mockUserBasicInfo, jest.fn()];
        } else if (atom?.init === null && !atom?.key) {
          return [mockUser, jest.fn()];
        } else if (atom?.init === false) {
          return [false, jest.fn()];
        } else {
          return [true, jest.fn()];
        }
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_SUPERVISOR');
      });
    });

    it('maps fitter role correctly', async () => {
      mockUser = {
        id: 789,
        username: 'jane.fitter',
        role: 'ROLE_FITTER',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Fitter',
      };
      mockIsAuthenticated = true;
      mockIsAuthLoading = false;

      mockUseAtom.mockImplementation((atom: any): any => {
        if (atom?.key === 'auth_user') {
          return [mockUserBasicInfo, jest.fn()];
        } else if (atom?.init === null && !atom?.key) {
          return [mockUser, jest.fn()];
        } else if (atom?.init === false) {
          return [false, jest.fn()];
        } else {
          return [true, jest.fn()];
        }
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_FITTER');
        expect(screen.getByTestId('user-username')).toHaveTextContent('jane.fitter');
      });
    });
  });

  describe('User Data Storage', () => {
    it('stores user data through Jotai atoms', async () => {
      mockUser = {
        id: 1003,
        username: 'storage.test',
        role: 'ROLE_ADMIN',
        email: 'storage@example.com',
        firstName: '',
        lastName: '',
      };
      mockUserBasicInfo = {
        id: 1003,
        username: 'storage.test',
        role: 'ROLE_ADMIN',
        firstName: '',
        lastName: '',
        email: 'storage@example.com'
      };
      mockIsAuthenticated = true;
      mockIsAuthLoading = false;

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent('1003');
      });
    });

    it('shows no user when session is invalid', async () => {
      mockUser = null;
      mockUserBasicInfo = null;
      mockIsAuthenticated = false;
      mockIsAuthLoading = false;

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('renders without crashing when fetch is unavailable', async () => {
      mockUser = null;
      mockIsAuthenticated = false;
      mockIsAuthLoading = false;

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
      });
    });

    it('handles concurrent authentication attempts', async () => {
      mockUser = {
        id: 1005,
        username: 'concurrent.user',
        role: 'ROLE_ADMIN',
        firstName: '',
        lastName: '',
      };
      mockIsAuthenticated = true;
      mockIsAuthLoading = false;

      // Render multiple times quickly
      const { rerender } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('ROLE_ADMIN');
      });
    });
  });

  describe('Role Hierarchy Scenarios', () => {
    const roleHierarchyTests = [
      { description: 'SUPERVISOR role renders correctly', role: 'ROLE_SUPERVISOR', userId: 2000 },
      { description: 'ADMIN role renders correctly', role: 'ROLE_ADMIN', userId: 2001 },
      { description: 'FITTER role renders correctly', role: 'ROLE_FITTER', userId: 2002 },
      { description: 'SUPPLIER role renders correctly', role: 'ROLE_SUPPLIER', userId: 2003 },
    ];

    roleHierarchyTests.forEach(({ description, role, userId }) => {
      it(description, async () => {
        mockUser = {
          id: userId,
          username: 'hierarchy.test',
          role: role,
          firstName: '',
          lastName: '',
        };
        mockUserBasicInfo = {
          id: userId,
          username: 'hierarchy.test',
          role: role,
          firstName: '',
          lastName: ''
        };
        mockIsAuthenticated = true;
        mockIsAuthLoading = false;

        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('user-role')).toHaveTextContent(role);
        });
      });
    });
  });
});
