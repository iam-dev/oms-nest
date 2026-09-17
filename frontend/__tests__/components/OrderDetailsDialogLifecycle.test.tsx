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

// Minimal table: "View" and "Edit" buttons per entity, wired to onView/onEdit.
jest.mock('@/components/shared/EntityTable', () => ({
  EntityTable: ({
    entities,
    onView,
    onEdit,
  }: {
    entities: Array<{ id: number }>;
    onView: (entity: { id: number }) => void;
    onEdit: (entity: { id: number }) => void;
  }) => (
    <div data-testid="entity-table">
      {entities.map((entity) => (
        <div key={entity.id}>
          <button data-testid={`view-${entity.id}`} onClick={() => onView(entity)}>
            View
          </button>
          <button data-testid={`edit-${entity.id}`} onClick={() => onEdit(entity)}>
            Edit
          </button>
        </div>
      ))}
    </div>
  ),
}));

// Radix-faithful Dialog: children always render, DialogContent only while open.
// An open Dialog also renders a "dismiss" control standing in for the paths
// Radix routes through `onOpenChange(false)`: the × button, Escape, and a
// click on the overlay.
jest.mock('@/components/ui/dialog', () => {
  const ReactActual = jest.requireActual('react') as typeof React;
  const OpenContext = ReactActual.createContext(true);
  return {
    Dialog: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => (
      <OpenContext.Provider value={!!open}>
        {open && (
          <button data-testid="dialog-dismiss" onClick={() => onOpenChange?.(false)}>
            Dismiss
          </button>
        )}
        {children}
      </OpenContext.Provider>
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

  // The editor's "Change orderstatus" persists immediately, so dismissing the
  // editor with × / Escape must refresh the list just like Cancel does —
  // otherwise the table keeps showing the pre-edit status.
  it('refreshes the list when the edit dialog is dismissed via ×/Escape', async () => {
    render(<Orders />);

    fireEvent.click(screen.getByTestId('edit-42'));
    await waitFor(() => expect(screen.getByTestId('comprehensive-edit-order')).toBeInTheDocument());
    mockFetchAndSetOrders.mockClear();

    fireEvent.click(screen.getByTestId('dialog-dismiss'));

    await waitFor(() =>
      expect(screen.queryByTestId('comprehensive-edit-order')).not.toBeInTheDocument()
    );
    expect(mockFetchAndSetOrders).toHaveBeenCalledWith(true);
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
