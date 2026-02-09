# Authentication

This guide covers the authentication and authorization system in the OMS frontend, including JWT token management, role-based access control, and security patterns.

## 🔐 Authentication Overview

The OMS frontend uses JWT (JSON Web Token) based authentication with httpOnly cookies and role-based access control supporting five distinct user roles in the saddle manufacturing workflow.

### Authentication Flow

```
1. User Login (username/password) with credentials: 'include'
        ↓
2. Backend Validation
        ↓
3. JWT Token Generation
        ↓
4. Server sets httpOnly secure cookie (Set-Cookie: token=...)
        ↓
5. Browser sends cookie automatically on subsequent requests
        ↓
6. Route & Component Protection
```

## 👥 User Roles & Permissions

### Role Hierarchy

```typescript
export enum UserRole {
  USER = 'USER',           // Basic customers
  FITTER = 'FITTER',       // Measurement professionals
  SUPPLIER = 'SUPPLIER',   // Product suppliers
  ADMIN = 'ADMIN',         // System administrators
  SUPERVISOR = 'SUPERVISOR' // Management oversight
}

// Permission levels (cumulative)
const rolePermissions = {
  USER: ['read:own_orders', 'create:orders', 'update:own_profile'],
  FITTER: ['read:assigned_orders', 'update:measurements', 'read:customers'],
  SUPPLIER: ['read:orders', 'update:fulfillment', 'manage:inventory'],
  SUPERVISOR: ['read:all_orders', 'approve:orders', 'read:reports'],
  ADMIN: ['*'] // Full system access
};
```

### Role-Based Features

**User (Customer)**
- Place and track orders
- View order history
- Manage personal profile
- Configure saddle preferences

**Fitter**
- View assigned orders
- Record measurements
- Update order status
- Access customer information

**Supplier**
- View production orders
- Update fulfillment status
- Manage inventory
- Track delivery schedules

**Supervisor**
- Monitor all operations
- Approve special requests
- Generate reports
- Oversee performance

**Admin**
- Full system access
- User management
- System configuration
- Security settings

## 🏪 State Management

### Authentication Atoms

The authentication state is managed using Jotai atoms in `store/auth.ts`. Since tokens are stored in httpOnly cookies (not accessible from JS), the frontend only tracks user presence in memory:

```typescript
// Core authentication state — memory-only, no localStorage
export const userAtom = atom<User | null>(null);
export const isAuthLoadingAtom = atom<boolean>(false);

// Derived authentication status — based on user presence, not token
export const isAuthenticatedAtom = atom((get) => {
  const user = get(userAtom);
  return !!user;
});
```

### Authentication Actions

```typescript
// Login action atom — stores user in memory, token is in httpOnly cookie
export const loginActionAtom = atom(
  null,
  (get, set, { user }: { user: User }) => {
    set(userAtom, user);
    set(isAuthLoadingAtom, false);
  }
);

// Logout action atom — clears memory state, cookie cleared by server
export const logoutActionAtom = atom(
  null,
  (get, set) => {
    set(userAtom, null);
    set(isAuthLoadingAtom, false);
  }
);
```

## 🔑 Authentication Service

### Login Process

```typescript
// services/auth.ts
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/email/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Required for cookie auth
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Login failed');
  }

  // Server sets httpOnly cookie automatically via Set-Cookie header
  return response.json();
};

export const logout = async (): Promise<void> => {
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include', // Cookie sent automatically
    });
  } catch (error) {
    console.error('Logout request failed:', error);
  }
  // Server clears the httpOnly cookie via Set-Cookie
};
```

### Token Management

With httpOnly cookies, the token is managed entirely by the server. The frontend cannot read or modify the JWT directly. This is more secure as it prevents XSS attacks from accessing tokens.

```typescript
// Token refresh — uses httpOnly refreshToken cookie
export const refreshToken = async (): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include', // Sends refreshToken cookie
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  // Server sets new token and refreshToken cookies automatically
};
```

## 🛡️ Route Protection

### Middleware Authentication

The `middleware.ts` file handles route-level authentication:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '');

  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register', '/forgot-password'];

  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check for authentication token
  if (!token) {
    console.log('🔒 No token found, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Validate token (basic check - full validation happens on backend)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;

    if (payload.exp <= currentTime) {
      console.log('🔒 Token expired, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Role-based route protection
    const userRole = payload.role;

    if (pathname.startsWith('/admin') && !['ADMIN', 'SUPERVISOR'].includes(userRole)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    if (pathname.startsWith('/reports') && userRole === 'USER') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

  } catch (error) {
    console.log('🔒 Invalid token, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

## 🔐 Component-Level Protection

### Authentication Hook

```typescript
// hooks/useAuth.ts
export const useAuth = () => {
  const [token] = useAtom(tokenAtom);
  const [user] = useAtom(userAtom);
  const [userBasicInfo] = useAtom(userBasicInfoAtom);
  const [isLoading] = useAtom(isAuthLoadingAtom);
  const [isAuthenticated] = useAtom(isAuthenticatedAtom);
  const setLoginAction = useSetAtom(loginActionAtom);
  const setLogoutAction = useSetAtom(logoutActionAtom);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      const authResponse = await authService.login(credentials);
      setLoginAction(authResponse);
      return authResponse;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, [setLoginAction]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setLogoutAction();
    }
  }, [setLogoutAction]);

  const hasRole = useCallback((requiredRoles: UserRole[]) => {
    const currentUser = user || userBasicInfo;
    return currentUser ? requiredRoles.includes(currentUser.role as UserRole) : false;
  }, [user, userBasicInfo]);

  return {
    user: user || userBasicInfo,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    hasRole,
  };
};
```

### Role-Based Component Guards

```typescript
// components/guards/RoleGuard.tsx
interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  children,
  fallback
}) => {
  const { hasRole } = useAuth();

  if (!hasRole(allowedRoles)) {
    return fallback || <UnauthorizedMessage />;
  }

  return <>{children}</>;
};

// Usage example
export const AdminPanel = () => (
  <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.SUPERVISOR]}>
    <AdminDashboard />
  </RoleGuard>
);
```

### Permission-Based Rendering

```typescript
// components/shared/ConditionalRender.tsx
interface ConditionalRenderProps {
  condition: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ConditionalRender: React.FC<ConditionalRenderProps> = ({
  condition,
  children,
  fallback = null,
}) => {
  return condition ? <>{children}</> : <>{fallback}</>;
};

// Hook for permission checking
export const usePermission = (permission: string) => {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) return false;

    // Check if user has specific permission
    const userPermissions = rolePermissions[user.role] || [];
    return userPermissions.includes('*') || userPermissions.includes(permission);
  }, [user, permission]);
};

// Usage example
export const OrderActions = ({ order }: { order: Order }) => {
  const canEdit = usePermission('update:orders');
  const canDelete = usePermission('delete:orders');

  return (
    <div className="flex gap-2">
      <ConditionalRender condition={canEdit}>
        <Button onClick={() => editOrder(order.id)}>Edit</Button>
      </ConditionalRender>

      <ConditionalRender condition={canDelete}>
        <Button variant="destructive" onClick={() => deleteOrder(order.id)}>
          Delete
        </Button>
      </ConditionalRender>
    </div>
  );
};
```

## 🔄 Session Management

### Automatic Token Refresh

With httpOnly cookies, the frontend cannot inspect token expiry directly. Instead, token refresh is handled by intercepting 401 responses:

```typescript
// hooks/useTokenRefresh.ts
export const useTokenRefresh = () => {
  const setLogoutAction = useSetAtom(logoutActionAtom);

  useEffect(() => {
    // Periodically call /auth/refresh to keep the session alive
    const refreshInterval = setInterval(async () => {
      try {
        await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // Refresh failed — user will be logged out on next 401
        setLogoutAction();
      }
    }, 10 * 60 * 1000); // Every 10 minutes

    return () => clearInterval(refreshInterval);
  }, [setLogoutAction]);
};
```

### Session Persistence

```typescript
// utils/sessionPersistence.ts
export const restoreSession = async (): Promise<boolean> => {
  try {
    // Validate session by calling /auth/me — cookie sent automatically
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      credentials: 'include',
    });

    if (!response.ok) return false;

    const user = await response.json();
    return !!user;
  } catch {
    return false;
  }
};
```

## 🚫 Error Handling

### Authentication Errors

```typescript
// utils/authErrors.ts
export class AuthenticationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string, public requiredRole?: UserRole) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// Error handling in API requests
export const handleAuthError = (error: any) => {
  if (error.status === 401) {
    // Token expired or invalid
    clearToken();
    window.location.href = '/login';
    throw new AuthenticationError('Session expired. Please login again.');
  }

  if (error.status === 403) {
    // Insufficient permissions
    throw new AuthorizationError('Insufficient permissions for this action.');
  }

  throw error;
};
```

### Global Error Boundary

```typescript
// components/ErrorBoundary.tsx
export class AuthErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (error instanceof AuthenticationError) {
      // Redirect to login
      window.location.href = '/login';
    } else if (error instanceof AuthorizationError) {
      // Show unauthorized message
      console.error('Authorization error:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">
              Authentication Error
            </h1>
            <p className="mt-2 text-gray-600">
              Please refresh the page or login again.
            </p>
            <Button
              onClick={() => window.location.href = '/login'}
              className="mt-4"
            >
              Go to Login
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## 🔐 Security Best Practices

### Token Security

Tokens are stored in httpOnly secure cookies, which provides strong XSS protection since JavaScript cannot access them.

```typescript
// Security configurations
const SECURITY_CONFIG = {
  TOKEN_STORAGE: 'httpOnly cookie', // Set by server, not accessible from JS
  REFRESH_THRESHOLD: 300, // 5 minutes
  MAX_RETRY_ATTEMPTS: 3,
  LOGOUT_ON_ERROR: true,
};

// Secure API request — cookies sent automatically
export const secureApiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include', // Send cookies
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    // Token might be expired, try refresh once
    try {
      await refreshToken();
      return secureApiRequest<T>(endpoint, options);
    } catch {
      throw new AuthenticationError('Session expired');
    }
  }

  return response.json();
};
```

### CSRF Protection

```typescript
// CSRF token handling (if implemented)
export const getCSRFToken = (): string | null => {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : null;
};

export const apiRequestWithCSRF = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const csrfToken = getCSRFToken();

  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    },
  });
};
```

## 🧪 Testing Authentication

### Mock Authentication

```typescript
// __tests__/mocks/auth.ts
export const mockUser: User = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  role: UserRole.USER,
  firstName: 'Test',
  lastName: 'User',
};

export const mockAuthToken = 'mock.jwt.token';

export const mockAuthResponse: AuthResponse = {
  token: mockAuthToken,
  user: mockUser,
};

// Mock auth service
export const mockAuthService = {
  login: jest.fn().mockResolvedValue(mockAuthResponse),
  logout: jest.fn().mockResolvedValue(undefined),
  refreshToken: jest.fn().mockResolvedValue(mockAuthToken),
};
```

### Testing Protected Components

```typescript
// __tests__/components/ProtectedComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { Provider } from 'jotai';
import { ProtectedComponent } from '@/components/ProtectedComponent';
import { tokenAtom, userAtom } from '@/store/auth';

const renderWithAuth = (component: React.ReactNode, user?: User) => {
  const store = createStore();

  if (user) {
    store.set(tokenAtom, 'mock-token');
    store.set(userAtom, user);
  }

  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('ProtectedComponent', () => {
  test('renders content for authenticated admin', () => {
    renderWithAuth(
      <ProtectedComponent />,
      { ...mockUser, role: UserRole.ADMIN }
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  test('shows unauthorized message for non-admin user', () => {
    renderWithAuth(
      <ProtectedComponent />,
      { ...mockUser, role: UserRole.USER }
    );

    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
  });
});
```

## 📋 Common Authentication Patterns

### Login Form

```typescript
// components/forms/LoginForm.tsx
export const LoginForm = () => {
  const { login, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>();

  const onSubmit = async (credentials: LoginCredentials) => {
    try {
      setError(null);
      await login(credentials);
      // Redirect handled by middleware
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="username">Username</label>
        <input
          {...register('username', { required: 'Username is required' })}
          type="text"
          className="w-full p-2 border rounded"
        />
        {errors.username && (
          <p className="text-red-500 text-sm">{errors.username.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          {...register('password', { required: 'Password is required' })}
          type="password"
          className="w-full p-2 border rounded"
        />
        {errors.password && (
          <p className="text-red-500 text-sm">{errors.password.message}</p>
        )}
      </div>

      {error && (
        <div className="p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full p-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
};
```

### User Menu

```typescript
// components/layout/UserMenu.tsx
export const UserMenu = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100"
      >
        <Avatar>
          <AvatarImage src={user.avatar} alt={user.firstName} />
          <AvatarFallback>
            {user.firstName?.[0]}{user.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">
          {user.firstName} {user.lastName}
        </span>
        <ChevronDownIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-lg">
          <div className="p-2 border-b">
            <p className="text-sm font-medium">{user.username}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
            <Badge variant="secondary" className="text-xs">
              {user.role}
            </Badge>
          </div>

          <nav className="p-1">
            <Link
              href="/profile"
              className="block px-2 py-1 text-sm hover:bg-gray-100 rounded"
            >
              Profile
            </Link>
            <Link
              href="/settings"
              className="block px-2 py-1 text-sm hover:bg-gray-100 rounded"
            >
              Settings
            </Link>
          </nav>

          <div className="border-t p-1">
            <button
              onClick={logout}
              className="block w-full text-left px-2 py-1 text-sm text-red-600 hover:bg-gray-100 rounded"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

## ⚡ Next Steps

To learn more about related topics:

- **[API Integration](./api-integration.md)** - How authentication integrates with API calls
- **[Components](./components.md)** - Building protected UI components
- **[State Management](./state-management.md)** - Managing auth state with Jotai
- **[Testing](./testing.md)** - Testing authentication flows