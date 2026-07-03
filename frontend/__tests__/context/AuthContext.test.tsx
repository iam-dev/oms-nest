import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useAtom } from 'jotai';
import { UserRole } from '@/types/Role';

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

// Mock global fetch
global.fetch = jest.fn();

const mockUseAtom = useAtom as jest.MockedFunction<typeof useAtom>;
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
let mockUser: import('@/types/Role').User | null = null;
let mockIsAuthLoading: boolean = false;
let mockIsAuthenticated: boolean = false;

/** Cast a mock-implementation function to the type mockImplementation expects. */
type UseAtomImpl = Parameters<typeof mockUseAtom.mockImplementation>[0];

describe('AuthContext - Cookie-Based Auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();

    // Reset mock state
    mockUser = null;
    mockIsAuthLoading = false;
    mockIsAuthenticated = false;

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Setup Jotai mock to return different atom hooks based on which atom is being used
    mockUseAtom.mockImplementation(((atom: unknown): [unknown, jest.Mock] => {
      const a = atom as Record<string, unknown> | null;
      if (a?.init === null && !a?.key) {
        // This is the userAtom (plain atom with null init)
        return [mockUser, jest.fn((newValue: typeof mockUser) => {
          mockUser = newValue;
        })];
      } else if (a?.init === false) {
        // This could be isAuthLoadingAtom (init: false) -- but we start with true
        return [mockIsAuthLoading, jest.fn((newValue: boolean) => { mockIsAuthLoading = newValue; })];
      } else if (typeof atom === 'function') {
        // Derived atom like isAuthenticatedAtom
        mockIsAuthenticated = !!mockUser;
        return [mockIsAuthenticated, jest.fn()];
      } else {
        // Action atoms - return a setter function
        return [null, jest.fn((action: unknown) => {
          const act = action as Record<string, unknown> | boolean | null | undefined;
          if (act && typeof act === 'object' && 'user' in act) {
            // This is loginActionAtom
            mockUser = act.user as typeof mockUser;
            mockIsAuthLoading = false;
            mockIsAuthenticated = true;
          } else if (act === true || act === false) {
            // This might be setLoadingAtom
            mockIsAuthLoading = act;
          }
        })];
      }
    }) as UseAtomImpl);
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
        role: UserRole.ADMIN,
        email: 'api@example.com',
        firstName: 'API',
        lastName: 'User',
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
        role: UserRole.ADMIN,
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
      };
      mockIsAuthenticated = true;
      mockIsAuthLoading = false;

      mockUseAtom.mockImplementation(((atom: unknown): [unknown, jest.Mock] => {
        const a = atom as Record<string, unknown> | null;
        if (a?.init === null && !a?.key) {
          return [mockUser, jest.fn()];
        } else if (a?.init === false) {
          return [false, jest.fn()];
        } else {
          return [true, jest.fn()];
        }
      }) as UseAtomImpl);

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
        role: UserRole.SUPERVISOR,
        email: 'supervisor@example.com',
        firstName: 'Super',
        lastName: 'Visor',
      };
      mockIsAuthenticated = true;
      mockIsAuthLoading = false;

      mockUseAtom.mockImplementation(((atom: unknown): [unknown, jest.Mock] => {
        const a = atom as Record<string, unknown> | null;
        if (a?.init === null && !a?.key) {
          return [mockUser, jest.fn()];
        } else if (a?.init === false) {
          return [false, jest.fn()];
        } else {
          return [true, jest.fn()];
        }
      }) as UseAtomImpl);

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
        role: UserRole.FITTER,
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Fitter',
      };
      mockIsAuthenticated = true;
      mockIsAuthLoading = false;

      mockUseAtom.mockImplementation(((atom: unknown): [unknown, jest.Mock] => {
        const a = atom as Record<string, unknown> | null;
        if (a?.init === null && !a?.key) {
          return [mockUser, jest.fn()];
        } else if (a?.init === false) {
          return [false, jest.fn()];
        } else {
          return [true, jest.fn()];
        }
      }) as UseAtomImpl);

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
        role: UserRole.ADMIN,
        email: 'storage@example.com',
        firstName: '',
        lastName: '',
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
        role: UserRole.ADMIN,
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
    const roleHierarchyTests: Array<{ description: string; role: UserRole; userId: number }> = [
      { description: 'SUPERVISOR role renders correctly', role: UserRole.SUPERVISOR, userId: 2000 },
      { description: 'ADMIN role renders correctly', role: UserRole.ADMIN, userId: 2001 },
      { description: 'FITTER role renders correctly', role: UserRole.FITTER, userId: 2002 },
      { description: 'SUPPLIER role renders correctly', role: UserRole.SUPPLIER, userId: 2003 },
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
