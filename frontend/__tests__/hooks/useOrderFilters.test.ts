import { renderHook, waitFor } from '@testing-library/react';
import { useOrderFilters } from '@/hooks/useOrderFilters';
import { getEnrichedOrders } from '@/services/enrichedOrders';

jest.mock('@/services/enrichedOrders', () => ({
  getEnrichedOrders: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockGetEnrichedOrders = getEnrichedOrders as jest.MockedFunction<typeof getEnrichedOrders>;

describe('useOrderFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEnrichedOrders.mockResolvedValue({ 'hydra:member': [], 'hydra:totalItems': 50239 });
  });

  it('requests pages of the same size it uses to compute totalPages', async () => {
    const { result } = renderHook(() => useOrderFilters());

    await waitFor(() => {
      expect(mockGetEnrichedOrders).toHaveBeenCalled();
    });

    const { itemsPerPage } = result.current.pagination;
    expect(mockGetEnrichedOrders).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: itemsPerPage }),
    );
  });
});
