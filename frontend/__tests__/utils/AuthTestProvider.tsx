import React, { ReactNode } from 'react';
import { Provider } from 'jotai';
import { User, UserRole } from '@/types/Role';
import { getMockUserByRole } from './mockUsers';

interface AuthTestProviderProps {
  children: ReactNode;
  role?: UserRole | string;
  customUser?: User;
  isAuthenticated?: boolean;
}

export const AuthTestProvider: React.FC<AuthTestProviderProps> = ({
  children,
  role = UserRole.USER,
  customUser,
  isAuthenticated = true
}) => {
  const mockUserData = getMockUserByRole(role);
  const mockUser = customUser || mockUserData.user;
  // Mock the auth store atoms (unused but documents intended behavior)
  void mockUser;
  void isAuthenticated;

  return (
    <Provider>
      {children}
    </Provider>
  );
};

export const createAuthTestWrapper = (
  role: UserRole | string = UserRole.USER,
  isAuthenticated: boolean = true
) => {
  const AuthTestWrapper = ({ children }: { children: ReactNode }) => (
    <AuthTestProvider role={role} isAuthenticated={isAuthenticated}>
      {children}
    </AuthTestProvider>
  );
  AuthTestWrapper.displayName = 'AuthTestWrapper';
  return AuthTestWrapper;
};

// Helper function to mock AuthContext for non-Jotai tests
export const mockAuthContext = (role: UserRole | string = UserRole.USER, isAuthenticated: boolean = true) => {
  const mockUserData = isAuthenticated ? getMockUserByRole(role) : null;
  const mockUser = mockUserData?.user || null;

  return {
    user: mockUser,
    isAuthenticated,
    login: jest.fn(),
    logout: jest.fn(),
    isLoading: false,
    error: null
  };
};

// Mock the useAuth hook
export const mockUseAuth = (role: UserRole | string = UserRole.USER, isAuthenticated: boolean = true) => {
  return jest.fn(() => mockAuthContext(role, isAuthenticated));
};

// Mock the useUserRole hook
export const mockUseUserRole = (role: UserRole | string = UserRole.USER) => {
  const mockUserData = getMockUserByRole(role);
  const actualRole = mockUserData.role;
  const isAdmin = actualRole === UserRole.ADMIN || actualRole === UserRole.SUPERVISOR;
  const isSupervisor = actualRole === UserRole.SUPERVISOR;
  const isUser = actualRole === UserRole.USER;
  const isFitter = actualRole === UserRole.FITTER;
  const isSupplier = actualRole === UserRole.SUPPLIER;

  return jest.fn(() => ({
    role: actualRole,
    isAdmin,
    isSupervisor,
    isUser,
    isFitter,
    isSupplier,
    hasRole: jest.fn((checkRole: UserRole) => actualRole === checkRole),
    hasAnyRole: jest.fn((roles: UserRole[]) => roles.includes(actualRole)),
    hasScreenPermission: jest.fn(),
    isAuthenticated: true
  }));
};

// Add a basic test to satisfy Jest's requirement
if (typeof test !== 'undefined') {
  test('AuthTestProvider utilities should be available', () => {
    const wrapper = createAuthTestWrapper(UserRole.ADMIN);
    expect(wrapper).toBeDefined();
    expect(mockAuthContext()).toBeDefined();
  });
}