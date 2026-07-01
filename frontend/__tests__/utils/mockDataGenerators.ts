import type { Customer } from '@/types/Customer';
import type { Fitter } from '@/types/Fitter';
import type { Supplier } from '@/types/Supplier';
import type { Order } from '@/types/Order';

// Partial mock shapes — not all Order fields are populated in tests
type MockOrder = Partial<Order> & { id: number; orderNumber: string };
type MockCustomer = Partial<Customer> & { id: number; name: string };
type MockSupplier = Partial<Supplier> & { id: number; name: string };
type MockFitter = Partial<Fitter> & { id: number; name: string };

// Order mock data generators
export const createMockOrder = (overrides: Partial<MockOrder> = {}): MockOrder => ({
  id: 1,
  orderNumber: 'ORD-001',
  customer: { id: 1, name: 'John Customer' },
  fitter: { id: 1, name: 'Jane Fitter' },
  status: 'pending',
  urgent: false,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  seatSize: 'M',
  reference: 'REF-SEAT-M-001',
  notes: 'Test order notes',
  ...overrides,
});

export const createMockOrders = (count: number, baseOverrides: Partial<MockOrder> = {}): MockOrder[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockOrder({
      id: index + 1,
      orderNumber: `ORD-${String(index + 1).padStart(3, '0')}`,
      reference: `REF-SEAT-${['S', 'M', 'L', 'XL'][index % 4]}-${String(index + 1).padStart(3, '0')}`,
      status: ['pending', 'approved', 'completed', 'cancelled'][index % 4],
      urgent: index % 3 === 0,
      createdAt: new Date(2024, 0, 15 + index),
      ...baseOverrides,
    })
  );
};

// Customer mock data generators
export const createMockCustomer = (overrides: Partial<MockCustomer> = {}): MockCustomer => ({
  id: 1,
  name: 'John Customer',
  email: 'john.customer@example.com',
  phone: '+1234567890',
  createdAt: '2024-01-10T09:00:00Z',
  updatedAt: '2024-01-10T09:00:00Z',
  ...overrides,
});

export const createMockCustomers = (count: number, baseOverrides: Partial<MockCustomer> = {}): MockCustomer[] => {
  const firstNames = ['John', 'Jane', 'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

  return Array.from({ length: count }, (_, index) => {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[index % lastNames.length];

    return createMockCustomer({
      id: index + 1,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: `+123456${String(index).padStart(4, '0')}`,
      createdAt: new Date(2024, 0, 1 + index).toISOString(),
      ...baseOverrides,
    });
  });
};

// Supplier mock data generators
export const createMockSupplier = (overrides: Partial<MockSupplier> = {}): MockSupplier => ({
  id: 1,
  name: 'Acme Saddle Supply',
  email: 'contact@acmesaddle.com',
  phone: '+1234567890',
  createdAt: '2024-01-05T08:00:00Z',
  updatedAt: '2024-01-05T08:00:00Z',
  ...overrides,
});

export const createMockSuppliers = (count: number, baseOverrides: Partial<MockSupplier> = {}): MockSupplier[] => {
  const companyPrefixes = ['Acme', 'Premium', 'Elite', 'Professional', 'Master', 'Quality', 'Superior', 'Expert'];
  const companyTypes = ['Leather', 'Saddle', 'Equestrian', 'Horse', 'Riding', 'Tack', 'Equipment'];
  const contactNames = ['Sarah Johnson', 'Mike Wilson', 'Lisa Brown', 'David Smith', 'Emma Davis', 'Chris Miller'];

  return Array.from({ length: count }, (_, index) => {
    const prefix = companyPrefixes[index % companyPrefixes.length];
    const type = companyTypes[index % companyTypes.length];
    const contact = contactNames[index % contactNames.length];

    return createMockSupplier({
      id: index + 1,
      name: `${prefix} ${type} Supply`,
      email: `contact@${prefix.toLowerCase()}${type.toLowerCase()}.com`,
      phone: `+123456${String(7000 + index).slice(-4)}`,
      createdAt: new Date(2023, 11, 1 + index).toISOString(),
      ...({ contactPerson: contact } as Partial<MockSupplier>),
      ...({ isActive: index % 6 !== 0 } as Partial<MockSupplier>),
      ...baseOverrides,
    });
  });
};

// Fitter mock data generators
export const createMockFitter = (overrides: Partial<MockFitter> = {}): MockFitter => ({
  id: 1,
  name: 'Jane Professional Fitter',
  email: 'jane@profittings.com',
  phone: '+1234567890',
  createdAt: '2024-01-01T07:00:00Z',
  updatedAt: '2024-01-01T07:00:00Z',
  ...overrides,
});

export const createMockFitters = (count: number, baseOverrides: Partial<MockFitter> = {}): MockFitter[] => {
  const firstNames = ['Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 'Tom'];
  const lastNames = ['Professional', 'Expert', 'Master', 'Certified', 'Senior', 'Specialist', 'Elite', 'Premier'];
  const regions = ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West', 'Northwest', 'Central', 'International'];

  return Array.from({ length: count }, (_, index) => {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[index % lastNames.length];
    const region = regions[index % regions.length];

    return createMockFitter({
      id: index + 1,
      name: `${firstName} ${lastName} Fitter`,
      email: `${firstName.toLowerCase()}@${lastName.toLowerCase()}fittings.com`,
      phone: `+123456${String(8000 + index).slice(-4)}`,
      isActive: index % 7 !== 0, // ~86% active
      createdAt: new Date(2023, 10, 1 + index).toISOString(),
      ...({ region } as Partial<MockFitter>),
      ...baseOverrides,
    });
  });
};

// Pagination mock data
export const createMockPagination = (overrides: Record<string, unknown> = {}) => ({
  currentPage: 1,
  totalPages: 5,
  totalItems: 50,
  itemsPerPage: 10,
  onPageChange: jest.fn(),
  ...overrides,
});

// Filter data generators
export const createMockFilterData = () => ({
  seatSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  statuses: ['pending', 'approved', 'completed', 'cancelled', 'on-hold'],
  fitters: createMockFitters(5).map(f => ({ id: f.id, name: f.name })),
  customers: createMockCustomers(5).map(c => ({ id: c.id, name: c.name })),
  suppliers: createMockSuppliers(5).map(s => ({ id: s.id, name: s.name })),
});

// Complex order scenarios
export const createUrgentOrders = (count: number): MockOrder[] => {
  return createMockOrders(count, { urgent: true, status: 'pending' });
};

export const createCompletedOrders = (count: number): MockOrder[] => {
  return createMockOrders(count, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  } as Partial<MockOrder>);
};

export const createOrdersWithVariousStatuses = (): MockOrder[] => {
  return [
    createMockOrder({ id: 1, status: 'pending', urgent: true }),
    createMockOrder({ id: 2, status: 'approved', urgent: false }),
    createMockOrder({ id: 3, status: 'completed', urgent: false, completedAt: '2024-01-20T15:00:00Z' } as Partial<MockOrder>),
    createMockOrder({ id: 4, status: 'cancelled', urgent: false }),
    createMockOrder({ id: 5, status: 'on-hold', urgent: true }),
  ];
};

export const createOrdersWithVariousSeatSizes = (): MockOrder[] => {
  const seatSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  return seatSizes.map((size, index) =>
    createMockOrder({
      id: index + 1,
      seatSize: size,
      reference: `REF-SEAT-${size}-${String(index + 1).padStart(3, '0')}`,
    })
  );
};

// API response generators
export const createMockApiResponse = <T>(data: T[], totalItems?: number) => ({
  data,
  totalItems: totalItems || data.length,
  totalPages: Math.ceil((totalItems || data.length) / 10),
  currentPage: 1,
  itemsPerPage: 10,
});

// Error scenarios
export const createMockApiError = (message: string = 'API Error') => {
  return new Error(message);
};

// Empty state generators
export const createEmptyOrders = () => [];
export const createEmptyCustomers = () => [];
export const createEmptySuppliers = () => [];
export const createEmptyFitters = () => [];

// Date range generators
export const createDateRange = (daysAgo: number = 30) => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysAgo);

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
};

// Test-specific utility functions
export const createTableTestData = () => ({
  orders: createMockOrders(15),
  customers: createMockCustomers(10),
  suppliers: createMockSuppliers(8),
  fitters: createMockFitters(6),
  pagination: createMockPagination(),
  filters: createMockFilterData(),
});

export const createLoadingState = () => ({
  loading: true,
  error: null,
  data: [],
});

export const createErrorState = (message: string = 'Failed to load data') => ({
  loading: false,
  error: message,
  data: [],
});

export const createSuccessState = <T>(data: T[]) => ({
  loading: false,
  error: null,
  data,
});

// Add a basic test to satisfy Jest's requirement
if (typeof test !== 'undefined') {
  test('mockDataGenerators should provide mock data functions', () => {
    expect(createMockOrder).toBeDefined();
    expect(createMockOrders(1)).toHaveLength(1);
    expect(createMockCustomer).toBeDefined();
    expect(createMockSupplier).toBeDefined();
    expect(createMockFitter).toBeDefined();
  });
}
