import { fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/services/warehouses';
import type { Warehouse, CreateWarehouseData } from '@/services/warehouses';
import * as apiModule from '@/services/api';

// Minimal fetch response shape used in mocks
interface MockFetchResponse {
  ok: boolean;
  statusText?: string;
  json: () => Promise<unknown>;
}

// Mock the api service
jest.mock('@/services/api', () => ({
  fetchEntities: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

const mockFetchEntities = jest.mocked(apiModule.fetchEntities);
const mockFetch = global.fetch as jest.Mock;

describe('Warehouses Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchWarehouses', () => {
    test('fetches warehouses with correct parameters', async () => {
      const mockResponse = {
        'hydra:member': [
          {
            id: '1',
            name: 'Main Warehouse',
            username: 'main-warehouse',
            location: 'New York',
            status: 'active',
          } satisfies Warehouse
        ],
        'hydra:totalItems': 1
      };

      mockFetchEntities.mockResolvedValue(mockResponse);

      const result = await fetchWarehouses();

      expect(mockFetchEntities).toHaveBeenCalledWith({
        entity: 'warehouses',
        page: 1,
        orderBy: 'username',
        partial: false,
        extraParams: {},
      });

      expect(result).toEqual(mockResponse);
    });

    test('fetches warehouses with custom parameters', async () => {
      const mockResponse = {
        'hydra:member': [],
        'hydra:totalItems': 0
      };

      mockFetchEntities.mockResolvedValue(mockResponse);

      await fetchWarehouses({
        page: 2,
        filters: { status: 'active' },
        orderBy: 'name',
        partial: true,
      });

      expect(mockFetchEntities).toHaveBeenCalledWith({
        entity: 'warehouses',
        page: 2,
        orderBy: 'name',
        partial: true,
        extraParams: { status: 'active' },
      });
    });

    test('handles fetch warehouses error', async () => {
      const error = new Error('Failed to fetch warehouses');
      mockFetchEntities.mockRejectedValue(error);

      await expect(fetchWarehouses()).rejects.toThrow('Failed to fetch warehouses');
    });
  });

  describe('createWarehouse', () => {
    test('creates warehouse with correct data', async () => {
      const warehouseData: CreateWarehouseData = {
        username: 'new-warehouse',
        name: 'New Warehouse',
        location: 'California',
        status: 'active',
      };

      const mockResponse: Warehouse = {
        id: '123',
        ...warehouseData
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } satisfies MockFetchResponse);

      const result = await createWarehouse(warehouseData);

      expect(result).toEqual(mockResponse);
    });

    test('handles create warehouse error', async () => {
      const warehouseData: CreateWarehouseData = {
        username: 'new-warehouse',
        name: 'New Warehouse',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Failed to create warehouse',
        json: async () => ({}),
      } satisfies MockFetchResponse);

      await expect(createWarehouse(warehouseData)).rejects.toThrow();
    });
  });

  describe('updateWarehouse', () => {
    test('updates warehouse with correct data', async () => {
      const warehouseId = '123';
      const updateData = {
        name: 'Updated Warehouse',
        location: 'Updated Location',
      };

      const mockResponse = {
        id: warehouseId,
        username: 'test-warehouse',
        ...updateData
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } satisfies MockFetchResponse);

      const result = await updateWarehouse(warehouseId, updateData);

      expect(result).toEqual(mockResponse);
    });

    test('handles update warehouse error', async () => {
      const warehouseId = '123';
      const updateData = { name: 'Updated Warehouse' };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Failed to update warehouse',
        json: async () => ({}),
      } satisfies MockFetchResponse);

      await expect(updateWarehouse(warehouseId, updateData)).rejects.toThrow();
    });
  });

  describe('deleteWarehouse', () => {
    test('deletes warehouse with correct ID', async () => {
      const warehouseId = '123';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } satisfies MockFetchResponse);

      await deleteWarehouse(warehouseId);
    });

    test('handles delete warehouse error', async () => {
      const warehouseId = '123';

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Failed to delete warehouse',
        json: async () => ({}),
      } satisfies MockFetchResponse);

      await expect(deleteWarehouse(warehouseId)).rejects.toThrow();
    });

    test('handles non-existent warehouse deletion', async () => {
      const warehouseId = 'non-existent';

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Warehouse not found',
        json: async () => ({ message: 'Warehouse not found' }),
      } satisfies MockFetchResponse);

      await expect(deleteWarehouse(warehouseId)).rejects.toThrow();
    });
  });

  describe('Data Validation', () => {
    test('handles different warehouse statuses correctly', async () => {
      const statuses = ['active', 'inactive', 'maintenance'] as const;

      for (const status of statuses) {
        const warehouseData: CreateWarehouseData = {
          username: `${status}-warehouse`,
          name: `${status} Warehouse`,
          location: 'Test Location',
          status,
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ id: '123', ...warehouseData }),
        } satisfies MockFetchResponse);

        const result = await createWarehouse(warehouseData);

        expect(result.status).toBe(status);
      }
    });
  });

  describe('Filtering and Sorting', () => {
    test('filters warehouses by status', async () => {
      const mockResponse = {
        'hydra:member': [
          { id: '1', name: 'Active Warehouse', username: 'active-warehouse', status: 'active' } satisfies Warehouse
        ],
        'hydra:totalItems': 1
      };

      mockFetchEntities.mockResolvedValue(mockResponse);

      await fetchWarehouses({
        filters: { status: 'active' }
      });

      expect(mockFetchEntities).toHaveBeenCalledWith({
        entity: 'warehouses',
        page: 1,
        orderBy: 'username',
        partial: false,
        extraParams: { status: 'active' },
      });
    });

    test('filters warehouses by location', async () => {
      const mockResponse = {
        'hydra:member': [],
        'hydra:totalItems': 0
      };

      mockFetchEntities.mockResolvedValue(mockResponse);

      await fetchWarehouses({
        filters: { location: 'California' }
      });

      expect(mockFetchEntities).toHaveBeenCalledWith({
        entity: 'warehouses',
        page: 1,
        orderBy: 'username',
        partial: false,
        extraParams: { location: 'California' },
      });
    });

    test('sorts warehouses by different fields', async () => {
      const sortFields = ['name', 'username', 'location'];

      for (const field of sortFields) {
        mockFetchEntities.mockResolvedValue({ 'hydra:member': [], 'hydra:totalItems': 0 });

        await fetchWarehouses({
          orderBy: field,
        });

        expect(mockFetchEntities).toHaveBeenCalledWith({
          entity: 'warehouses',
          page: 1,
          orderBy: field,
          partial: false,
          extraParams: {},
        });
      }
    });
  });

  describe('Error Handling', () => {
    test('handles network errors gracefully', async () => {
      const networkError = new Error('Network error');
      mockFetchEntities.mockRejectedValue(networkError);

      await expect(fetchWarehouses()).rejects.toThrow('Network error');
    });

    test('handles API errors with proper error messages', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Unauthorized' }),
      } satisfies MockFetchResponse);

      await expect(createWarehouse({
        username: 'test',
        name: 'Test Warehouse',
      })).rejects.toThrow();
    });
  });
});
