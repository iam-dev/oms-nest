import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardOrderStatusFlow from '@/components/DashboardOrderStatusFlow';
import * as apiModule from '@/services/api';

jest.mock('@/services/api', () => ({
  fetchOrderStatusStats: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockFetchOrderStatusStats = apiModule.fetchOrderStatusStats as jest.Mock;

const statsWith = (approved: number, unordered: number) => ({
  totalOrders: approved + unordered,
  statusCounts: { approved, unordered },
});

describe('DashboardOrderStatusFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchOrderStatusStats.mockResolvedValue(statsWith(1, 2));
  });

  it('loads the status counts on mount', async () => {
    render(<DashboardOrderStatusFlow />);

    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });
    expect(mockFetchOrderStatusStats).toHaveBeenCalledTimes(1);
  });

  it('refetches the counts when refreshKey changes', async () => {
    // Regression: a status change made in the details or Edit Order dialog moves
    // an order between buckets, so counts fetched once on mount kept showing the
    // pre-change totals next to a table that had already refreshed.
    const { rerender } = render(<DashboardOrderStatusFlow refreshKey={0} />);

    await waitFor(() => {
      expect(mockFetchOrderStatusStats).toHaveBeenCalledTimes(1);
    });

    mockFetchOrderStatusStats.mockResolvedValue(statsWith(2, 1));
    rerender(<DashboardOrderStatusFlow refreshKey={1} />);

    await waitFor(() => {
      expect(mockFetchOrderStatusStats).toHaveBeenCalledTimes(2);
    });
  });

  it('keeps the loaded cards on screen while refetching', async () => {
    // The refetch must not swap the cards back to the loading placeholder —
    // that flash is what a mount-only fetch avoided by never refetching at all.
    const { rerender } = render(<DashboardOrderStatusFlow refreshKey={0} />);

    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    let resolveSecond: (v: unknown) => void = () => {};
    mockFetchOrderStatusStats.mockReturnValue(
      new Promise((resolve) => {
        resolveSecond = resolve;
      }),
    );
    rerender(<DashboardOrderStatusFlow refreshKey={1} />);

    expect(screen.queryByText(/loading order status/i)).not.toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();

    resolveSecond(statsWith(2, 1));
    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });
  });
});
