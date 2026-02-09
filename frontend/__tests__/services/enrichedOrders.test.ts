import { getEnrichedOrders } from '@/services/enrichedOrders';
import { fetchEntities } from '@/services/api';

// Mock the API service
jest.mock('@/services/api', () => ({
  fetchEntities: jest.fn(),
}));

const mockFetchEntities = fetchEntities as jest.MockedFunction<typeof fetchEntities>;

// Fitter filtering is now handled server-side via RLS and the authenticated cookie session.
// These tests verify the service correctly passes filters to the API without
// client-side fitter auto-filtering (which was removed as part of the cookie-based auth migration).

describe('Enriched Orders Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Filter Passthrough', () => {
    const mockOrders = [
      {
        id: 1,
        orderNumber: 'ORD-001',
        customer: { id: 1, name: 'John Customer' },
        fitter: { id: 1, name: 'Jane Fitter', username: 'jane.fitter' },
        status: 'pending',
        urgent: false,
      },
      {
        id: 2,
        orderNumber: 'ORD-002',
        customer: { id: 2, name: 'Alice Customer' },
        fitter: { id: 2, name: 'Bob Fitter', username: 'bob.fitter' },
        status: 'approved',
        urgent: true,
      },
    ];

    it('passes filters directly to fetchEntities without client-side fitter auto-filtering', async () => {
      mockFetchEntities.mockResolvedValue({
        'hydra:member': mockOrders,
        'hydra:totalItems': 2,
      });

      const result = await getEnrichedOrders({
        page: 1,
        filters: {},
      });

      expect(mockFetchEntities).toHaveBeenCalledWith({
        entity: 'enriched_orders',
        page: 1,
        partial: undefined,
        extraParams: {},
        searchTerm: undefined,
      });

      // No client-side fitter filter should be applied
      const callParams = mockFetchEntities.mock.calls[0][0].extraParams;
      expect(callParams).not.toHaveProperty('fitterUsername');

      expect(result['hydra:member']).toHaveLength(2);
    });

    it('passes explicit fitterUsername filter to the API', async () => {
      mockFetchEntities.mockResolvedValue({
        'hydra:member': mockOrders.filter(order => order.fitter.username === 'bob.fitter'),
        'hydra:totalItems': 1,
      });

      await getEnrichedOrders({
        page: 1,
        filters: {
          fitterUsername: 'bob.fitter',
        },
      });

      expect(mockFetchEntities).toHaveBeenCalledWith({
        entity: 'enriched_orders',
        page: 1,
        partial: undefined,
        extraParams: expect.objectContaining({
          fitterUsername: 'bob.fitter',
        }),
        searchTerm: undefined,
      });
    });

    it('does not apply any client-side fitter filtering', async () => {
      mockFetchEntities.mockResolvedValue({
        'hydra:member': mockOrders,
        'hydra:totalItems': 2,
      });

      const result = await getEnrichedOrders({
        page: 1,
        filters: {},
      });

      // Should not include fitterUsername filter - server-side RLS handles this
      const callParams = mockFetchEntities.mock.calls[0][0].extraParams;
      expect(callParams).not.toHaveProperty('fitterUsername');
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      const apiError = new Error('API Error');
      mockFetchEntities.mockRejectedValue(apiError);

      await expect(getEnrichedOrders({
        page: 1,
        filters: {},
      })).rejects.toThrow('API Error');
    });
  });

  describe('Filter Processing', () => {
    it('correctly formats complex filters', async () => {
      mockFetchEntities.mockResolvedValue({
        'hydra:member': [],
        'hydra:totalItems': 0,
      });

      await getEnrichedOrders({
        page: 1,
        filters: {
          orderStatus: 'pending',
          urgent: 'true',
          customerName: 'John',
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        },
        orderBy: 'createdAt',
        order: 'desc',
      });

      expect(mockFetchEntities).toHaveBeenCalledWith({
        entity: 'enriched_orders',
        page: 1,
        partial: undefined,
        extraParams: expect.objectContaining({
          orderStatus: 'pending',
          urgent: 'true',
          customerName: 'John',
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
          'order[createdAt]': 'desc',
        }),
        searchTerm: undefined,
      });
    });

    it('handles search parameter correctly', async () => {
      mockFetchEntities.mockResolvedValue({
        'hydra:member': [],
        'hydra:totalItems': 0,
      });

      await getEnrichedOrders({
        page: 1,
        searchTerm: 'ORD-001',
        filters: {},
      });

      expect(mockFetchEntities).toHaveBeenCalledWith({
        entity: 'enriched_orders',
        page: 1,
        partial: undefined,
        extraParams: {},
        searchTerm: 'ORD-001',
      });
    });
  });
});
