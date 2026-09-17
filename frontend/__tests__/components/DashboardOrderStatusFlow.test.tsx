import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  it('lays the status groups out in a responsive grid instead of a fixed four-column row', async () => {
    // Each card is ~200px wide (label, connector dot and count badge), so four
    // flex:1 columns overlap each other once the panel drops below ~950px —
    // which is what happens at browser zoom levels above ~125%.
    render(<DashboardOrderStatusFlow />);

    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    const row = screen.getByTestId('status-flow-grid');
    expect(row).toHaveClass('grid');
    expect(row).toHaveClass('xl:grid-cols-4');
    expect(row).toHaveClass('md:grid-cols-2');
    // Labels must never wrap, or a card grows taller than its row slot.
    expect(screen.getByText('Approved').closest('[data-status-card]')).toHaveStyle({ whiteSpace: 'nowrap' });
  });

  // The backend reports inventory per location (inventory_aiken / _uk /
  // _holland) and folds Ordered + Changed into ordered_changed.  The Inventory
  // card read a non-existent `inventory` key, so it always showed 0 and its
  // click filtered on the non-existent status "Inventory"; the Ordered/Changed
  // card counted both statuses but filtered only "Ordered".
  it('sums the per-location inventory counts and filters on all three statuses', async () => {
    mockFetchOrderStatusStats.mockResolvedValue({
      totalOrders: 6,
      statusCounts: { inventory_aiken: 1, inventory_uk: 2, inventory_holland: 3 },
    });
    const onStatusClick = jest.fn();
    render(<DashboardOrderStatusFlow onStatusClick={onStatusClick} />);

    const card = await screen.findByText('Inventory');
    expect(card.closest('[data-status-card]')).toHaveTextContent('6');

    fireEvent.click(card);
    expect(onStatusClick).toHaveBeenCalledWith('Inventory Aiken,Inventory UK,Inventory HOLLAND');
  });

  it('filters the Ordered/Changed card on both statuses', async () => {
    mockFetchOrderStatusStats.mockResolvedValue({
      totalOrders: 3,
      statusCounts: { ordered_changed: 3 },
    });
    const onStatusClick = jest.fn();
    render(<DashboardOrderStatusFlow onStatusClick={onStatusClick} />);

    fireEvent.click(await screen.findByText('Ordered/Changed'));
    expect(onStatusClick).toHaveBeenCalledWith('Ordered,Changed');
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
