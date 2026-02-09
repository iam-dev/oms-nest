# API Integration

This guide covers how the OMS frontend integrates with backend services, including patterns for data fetching, state management, and error handling.

## 🏗️ Architecture Overview

### API Service Layer

The frontend uses a centralized service architecture for API integration:

```
Frontend Components
       ↓
Service Functions (services/)
       ↓
HTTP Client (fetch)
       ↓
Backend APIs (NestJS/PHP)
```

### Backend Transition

The application supports two backend configurations:

- **NestJS API** (Current): `http://localhost:3001` - Modern TypeScript API
- **PHP/Symfony API** (Legacy): `http://localhost:8888` - Legacy system during migration

## 🔧 Service Configuration

### Base API Service

Located at `services/api.ts`:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Generic fetch wrapper with error handling
// Authentication is handled via httpOnly cookies — no manual header injection needed
export const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Send httpOnly auth cookies automatically
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};
```

### Environment Configuration

Configure API endpoints in `.env.local`:

```env
# NestJS Backend (Recommended)
NEXT_PUBLIC_API_URL=http://localhost:3001

# PHP Backend (Legacy)
NEXT_PUBLIC_API_URL=http://localhost:8888
```

## 📡 Entity Service Patterns

### Generic Entity Service

Each entity follows a consistent service pattern. Example from `services/customers.ts`:

```typescript
export interface CustomerFilters {
  name?: string;
  email?: string;
  active?: boolean;
  country?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Fetch entities with filtering and pagination
export const fetchCustomers = async (
  page: number = 1,
  limit: number = 10,
  filters: CustomerFilters = {}
): Promise<PaginatedResponse<Customer>> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...buildFilterString(filters),
  });

  return apiRequest<PaginatedResponse<Customer>>(
    `/customers?${params.toString()}`
  );
};

// Create new entity
export const createCustomer = async (
  customerData: CreateCustomerDto
): Promise<Customer> => {
  return apiRequest<Customer>('/customers', {
    method: 'POST',
    body: JSON.stringify(customerData),
  });
};

// Update existing entity
export const updateCustomer = async (
  id: string,
  customerData: UpdateCustomerDto
): Promise<Customer> => {
  return apiRequest<Customer>(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(customerData),
  });
};

// Delete entity
export const deleteCustomer = async (id: string): Promise<void> => {
  return apiRequest<void>(`/customers/${id}`, {
    method: 'DELETE',
  });
};
```

### Filter Building

OData-style filter construction:

```typescript
export const buildFilterString = (filters: Record<string, any>) => {
  const filterParams: Record<string, string> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'string') {
        // Text search with contains
        filterParams[`filter[${key}]`] = `contains('${value}')`;
      } else if (typeof value === 'boolean') {
        filterParams[`filter[${key}]`] = value.toString();
      } else if (typeof value === 'number') {
        filterParams[`filter[${key}]`] = value.toString();
      }
    }
  });

  return filterParams;
};
```

## 🎣 Data Fetching Hooks

### Generic Entity Hook

Custom hook pattern for entity management:

```typescript
export const useEntityData = <T>(
  entityName: string,
  page: number = 1,
  filters: Record<string, any> = {}
) => {
  const [data, setData] = useState<PaginatedResponse<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getEntityService(entityName).fetch(page, 10, filters);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [entityName, page, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};
```

### Specific Entity Hooks

Example for orders:

```typescript
export const useOrders = (
  page: number = 1,
  filters: OrderFilters = {}
) => {
  return useEntityData<Order>('orders', page, filters);
};

export const useOrder = (id: string) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      setLoading(true);
      try {
        const orderData = await apiRequest<Order>(`/orders/${id}`);
        setOrder(orderData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch order');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  return { order, loading, error };
};
```

## 🔐 Authentication Integration

### Token Management

Authentication tokens are stored in httpOnly cookies set by the server. The frontend doesn't need to manage tokens directly — cookies are sent automatically by the browser with `credentials: 'include'`.

```typescript
// Token refresh — calls the server which rotates both token and refreshToken cookies
export const refreshToken = async (): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include', // Sends refreshToken cookie
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }
  // Server sets new cookies automatically via Set-Cookie headers
};
```

### Protected API Calls

All API calls automatically include authentication cookies:

```typescript
// Cookies are sent automatically with credentials: 'include'
const customers = await fetchCustomers(1, 10, { active: true });

// Public endpoints work the same way (server ignores missing cookie)
const publicData = await apiRequest('/public/health');
```

## 🔄 State Management Integration

### Jotai Atoms for API State

Global state management for frequently accessed data:

```typescript
// atoms/customer.ts
export const customerListAtom = atom<Customer[]>([]);
export const customerLoadingAtom = atom<boolean>(false);
export const customerErrorAtom = atom<string | null>(null);

// Derived atom for filtered customers
export const filteredCustomersAtom = atom((get) => {
  const customers = get(customerListAtom);
  const filters = get(customerFiltersAtom);

  return customers.filter(customer => {
    return (!filters.name || customer.name.includes(filters.name)) &&
           (!filters.active || customer.active === filters.active);
  });
});
```

### Action Atoms

Atoms that trigger API calls:

```typescript
export const loadCustomersAtom = atom(
  null,
  async (get, set, { page, filters }: { page: number; filters: CustomerFilters }) => {
    set(customerLoadingAtom, true);
    set(customerErrorAtom, null);

    try {
      const response = await fetchCustomers(page, 10, filters);
      set(customerListAtom, response.data);
    } catch (error) {
      set(customerErrorAtom, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      set(customerLoadingAtom, false);
    }
  }
);
```

## 📊 Real-time Updates

### WebSocket Integration

For real-time order updates:

```typescript
export const useOrderUpdates = (orderId: string) => {
  const [order, setOrder] = useAtom(currentOrderAtom);

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/orders/${orderId}`);

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setOrder(currentOrder => ({
        ...currentOrder,
        ...update
      }));
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [orderId, setOrder]);

  return order;
};
```

### Polling for Updates

Alternative approach for legacy systems:

```typescript
export const useOrderPolling = (orderId: string, interval: number = 30000) => {
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const orderData = await apiRequest<Order>(`/orders/${orderId}`);
        setOrder(orderData);
      } catch (error) {
        console.error('Failed to fetch order update:', error);
      }
    };

    // Initial fetch
    fetchOrder();

    // Set up polling
    const intervalId = setInterval(fetchOrder, interval);

    return () => {
      clearInterval(intervalId);
    };
  }, [orderId, interval]);

  return order;
};
```

## ❌ Error Handling

### API Error Types

Centralized error handling:

```typescript
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    public fields: Record<string, string[]>
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}
```

### Error Boundary Integration

Component-level error handling:

```typescript
export const ApiErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={<ErrorFallback />}
      onError={(error) => {
        if (error instanceof AuthenticationError) {
          // Redirect to login
          window.location.href = '/login';
        } else if (error instanceof ApiError) {
          // Show user-friendly error message
          toast.error(error.message);
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

## 📈 Performance Optimization

### Request Deduplication

Prevent duplicate API calls:

```typescript
const requestCache = new Map<string, Promise<any>>();

export const cachedApiRequest = <T>(
  endpoint: string,
  options: RequestInit = {},
  ttl: number = 5000 // 5 seconds
): Promise<T> => {
  const cacheKey = `${endpoint}-${JSON.stringify(options)}`;

  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey);
  }

  const request = apiRequest<T>(endpoint, options);
  requestCache.set(cacheKey, request);

  // Clear cache after TTL
  setTimeout(() => {
    requestCache.delete(cacheKey);
  }, ttl);

  return request;
};
```

### Pagination Optimization

Efficient data loading:

```typescript
export const useInfiniteEntities = <T>(
  entityName: string,
  pageSize: number = 20
) => {
  const [data, setData] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const response = await getEntityService(entityName).fetch(page, pageSize);

      setData(prev => [...prev, ...response.data]);
      setHasMore(response.data.length === pageSize);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error('Failed to load more entities:', error);
    } finally {
      setLoading(false);
    }
  }, [entityName, page, pageSize, loading, hasMore]);

  return {
    data,
    hasMore,
    loading,
    loadMore,
  };
};
```

## 🧪 Testing API Integration

### Service Testing

Unit tests for API services:

```typescript
// __tests__/services/customers.test.ts
import { fetchCustomers, createCustomer } from '@/services/customers';

// Mock fetch
global.fetch = jest.fn();

describe('Customer Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchCustomers returns paginated data', async () => {
    const mockResponse = {
      data: [{ id: '1', name: 'Test Customer' }],
      total: 1,
      page: 1,
      limit: 10,
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await fetchCustomers(1, 10);
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/customers?page=1&limit=10'),
      expect.any(Object)
    );
  });
});
```

### Hook Testing

Testing custom hooks:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useCustomers } from '@/hooks/useCustomers';

test('useCustomers loads customer data', async () => {
  const { result } = renderHook(() => useCustomers(1, {}));

  expect(result.current.loading).toBe(true);

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.data).toBeDefined();
  expect(result.current.error).toBeNull();
});
```

## 🔄 Migration Patterns

### Dual Backend Support

Supporting both NestJS and PHP backends:

```typescript
const getApiVersion = (): 'nestjs' | 'php' => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  return apiUrl.includes(':3001') ? 'nestjs' : 'php';
};

export const fetchEntities = async <T>(endpoint: string): Promise<T> => {
  const version = getApiVersion();

  switch (version) {
    case 'nestjs':
      return nestjsApiRequest<T>(endpoint);
    case 'php':
      return phpApiRequest<T>(endpoint);
    default:
      throw new Error('Unknown API version');
  }
};
```

### Gradual Migration

Feature flags for API migration:

```typescript
export const useApiMigration = (feature: string) => {
  const [useNewApi, setUseNewApi] = useState(false);

  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        const flags = await apiRequest<FeatureFlags>('/feature-flags');
        setUseNewApi(flags[feature] || false);
      } catch (error) {
        // Fallback to old API
        setUseNewApi(false);
      }
    };

    checkFeatureFlag();
  }, [feature]);

  return useNewApi;
};
```

## 📋 Best Practices

### 1. Consistent Error Handling
- Use custom error types
- Implement retry logic for transient errors
- Provide user-friendly error messages

### 2. Performance Optimization
- Implement request deduplication
- Use appropriate caching strategies
- Optimize pagination and infinite scrolling

### 3. Type Safety
- Define TypeScript interfaces for all API responses
- Use generic types for reusable patterns
- Validate response shapes in development

### 4. Testing
- Mock API calls in unit tests
- Test error scenarios
- Use integration tests for critical workflows

### 5. Security
- Never expose sensitive tokens
- Implement proper CORS handling
- Validate all user inputs before API calls

## ⚡ Next Steps

- **[Components](./components.md)** - Learn about the component system
- **[State Management](./state-management.md)** - Understand Jotai integration
- **[Testing](./testing.md)** - Explore testing strategies
- **[Performance](./performance.md)** - Optimization techniques