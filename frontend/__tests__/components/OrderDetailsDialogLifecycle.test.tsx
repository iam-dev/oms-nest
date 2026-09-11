import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Orders from '@/components/Orders';

/**
 * Regression test: "Edit order > Update Order > reopen the order > old values".
 *
 * Radix `Dialog` renders its non-Content children regardless of `open`; only
 * `DialogContent` (Portal + Presence) is unmounted on close.  `OrderDetails`
 * fetches the order once per `orderId` and keeps the result in `useState`, so a
 * host that renders it as `{selectedOrder && <OrderDetails/>}` under an
 * always-rendered `<Dialog>` keeps the *pre-edit* snapshot alive after the
 * dialog closes.  Reopening the same order then shows stale data even though
 * the save succeeded — which reads to the user as "saving didn't change the
 * info".
 *
 * Hosts must unmount `OrderDetails` while its dialog is closed so every open
 * starts from a fresh fetch.  Same class of bug (and same fix) as the editor
 * lifecycle covered by EditOrderDialogLifecycle.test.tsx.
 */

const mockFetchAndSetOrders = jest.fn();

// One stable object: Orders has effects keyed on `headerFilters`/`page`, so a
// fresh object per render would re-run them forever.
const mockOrderFilters = {
  searchTerm: '',
  searchMessage: null,
  isSearching: false,
  handleSearch: jest.fn(),
  handleBulkSearch: jest.fn(),
  processedOrders: [{ id: 42, orderId: 1001, orderStatus: 'Ordered' }],
  loading: false,
  error: null,
  headerFilters: {},
  handleFilterChange: jest.fn(),
  resetFilters: jest.fn(),
  hasActiveFilters: false,
  dynamicSeatSizes: [],
  dynamicFactories: [],
  page: 1,
  setPage: jest.fn(),
  pagination: { totalPages: 1, totalItems: 1, itemsPerPage: 25 },
  fetchAndSetOrders: mockFetchAndSetOrders,
};

jest.mock('@/hooks/useOrderFilters', () => ({
  useOrderFilters: () => mockOrderFilters,
}));

jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({ isFitter: false }),
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/utils/orderTableColumns', () => ({
  getOrderTableColumns: () => [],
}));

jest.mock('@/utils/orderProcessing', () => ({
  fetchCompleteOrderData: jest.fn(),
}));

jest.mock('@/components/BulkOrderSearch', () => ({
  BulkOrderSearch: () => null,
}));
jest.mock('@/components/BulkActionsToolbar', () => ({
  BulkActionsToolbar: () => null,
}));
jest.mock('@/components/OrderSearchMessage', () => ({
  OrderSearchMessage: () => null,
}));
jest.mock('@/components/shared/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock('@/components/EditOrder', () => ({
  EditOrder: () => <div data-testid="edit-order" />,
}));
jest.mock('@/components/ComprehensiveEditOrder', () => ({
  ComprehensiveEditOrder: () => <div data-testid="comprehensive-edit-order" />,
}));

// Minimal table: one "View" button per entity, wired to onView.
jest.mock('@/components/shared/EntityTable', () => ({
  EntityTable: ({
    entities,
    onView,
  }: {
    entities: Array<{ id: number }>;
    onView: (entity: { id: number }) => void;
  }) => (
    <div data-testid="entity-table">
      {entities.map((entity) => (
        <button key={entity.id} data-testid={`view-${entity.id}`} onClick={() => onView(entity)}>
          View
        </button>
      ))}
    </div>
  ),
}));

// Radix-faithful Dialog: children always render, DialogContent only while open.
jest.mock('@/components/ui/dialog', () => {
  const ReactActual = jest.requireActual('react') as typeof React;
  const OpenContext = ReactActual.createContext(true);
  return {
    Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
      <OpenContext.Provider value={!!open}>{children}</OpenContext.Provider>
    ),
    DialogContent: ({ children }: { children: React.ReactNode }) =>
      ReactActual.useContext(OpenContext) ? <div data-testid="dialog-content">{children}</div> : null,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  };
});

// Stub OrderDetails that (a) reports every mount and (b) can signal a saved edit
// via onOrderChanged, exactly as the real component does after the editor closes.
const mockDetailsMounted = jest.fn();
jest.mock('@/components/OrderDetails', () => {
  const ReactActual = jest.requireActual('react') as typeof React;
  return {
    OrderDetails: ({ onOrderChanged }: { onOrderChanged?: () => void }) => {
      ReactActual.useEffect(() => {
        mockDetailsMounted();
      }, []);
      return (
        <div data-testid="order-details">
          <button data-testid="saved-edit" onClick={() => onOrderChanged?.()}>
            Saved edit
          </button>
        </div>
      );
    },
  };
});

describe('Order details dialog lifecycle (Orders host)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not mount OrderDetails before an order is viewed', () => {
    render(<Orders />);

    expect(screen.queryByTestId('order-details')).not.toBeInTheDocument();
    expect(mockDetailsMounted).not.toHaveBeenCalled();
  });

  it('remounts OrderDetails when the same order is reopened after a saved edit', async () => {
    render(<Orders />);

    // Open the details for order 42
    fireEvent.click(screen.getByTestId('view-42'));
    await waitFor(() => expect(screen.getByTestId('order-details')).toBeInTheDocument());
    expect(mockDetailsMounted).toHaveBeenCalledTimes(1);

    // The editor saved and closed: OrderDetails reports the change, the host
    // closes the details dialog and refreshes the list.
    fireEvent.click(screen.getByTestId('saved-edit'));
    await waitFor(() => expect(screen.queryByTestId('order-details')).not.toBeInTheDocument());
    expect(mockFetchAndSetOrders).toHaveBeenCalledWith(true);

    // Reopen the same order — must be a brand-new OrderDetails instance so it
    // refetches the persisted values instead of showing its pre-edit snapshot.
    fireEvent.click(screen.getByTestId('view-42'));
    await waitFor(() => expect(screen.getByTestId('order-details')).toBeInTheDocument());
    expect(mockDetailsMounted).toHaveBeenCalledTimes(2);
  });
});
