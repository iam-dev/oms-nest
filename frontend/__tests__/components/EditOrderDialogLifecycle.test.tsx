import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OrderDetails } from '@/components/OrderDetails';
import * as enrichedOrdersModule from '@/services/enrichedOrders';

/**
 * Regression test: "Edit Order > changes still show after Cancel".
 *
 * Radix `Dialog` renders its non-Content children regardless of `open`; only
 * `DialogContent` (Portal + Presence) is unmounted on close.  Since
 * `ComprehensiveEditOrder` keeps the whole wizard form in `useState` and only
 * refetches when `orderId` changes, a host that mounts it directly under
 * `<Dialog>` keeps the abandoned edits alive after Cancel and shows them
 * again on the next open of the same order.
 *
 * The Dialog mock below mirrors that Radix behaviour so the test can assert
 * that hosts unmount the editor when the dialog closes.
 */

jest.mock('@/services/enrichedOrders', () => ({
  fetchOrderDetail: jest.fn(),
  updateOrder: jest.fn(),
  createOrderFromPayload: jest.fn(),
  createDraftOrder: jest.fn(),
}));

jest.mock('@/services/api-config', () => ({
  API_URL: 'http://localhost:3001',
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn(() => null) }),
  usePathname: () => '/',
}));

// Radix-faithful Dialog: children always render, DialogContent only while open.
// Default context is `true` so a DialogContent rendered outside any Dialog
// (e.g. OrderDetails' own body in this test) is still visible.
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

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

jest.mock('@/lib/generate-pdf', () => ({
  generateOrderPDF: jest.fn(() => ({ save: jest.fn() })),
  generateLabelPDF: jest.fn(() => ({ save: jest.fn() })),
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Stub editor that (a) reports every mount, and (b) holds local "dirty" state
// so we can prove a reopen starts from a clean slate.
const mockEditorMounted = jest.fn();
jest.mock('@/components/ComprehensiveEditOrder', () => {
  const ReactActual = jest.requireActual('react') as typeof React;
  return {
    ComprehensiveEditOrder: ({ onClose }: { onClose: () => void }) => {
      const [dirty, setDirty] = ReactActual.useState(false);
      ReactActual.useEffect(() => {
        mockEditorMounted();
      }, []);
      return (
        <div data-testid="comprehensive-edit-order" data-dirty={String(dirty)}>
          <button data-testid="make-dirty" onClick={() => setDirty(true)}>
            Make dirty
          </button>
          <button data-testid="cancel-edit" onClick={onClose}>
            Cancel
          </button>
        </div>
      );
    },
  };
});

const fetchOrderDetail = enrichedOrdersModule.fetchOrderDetail as jest.Mock;

const mockOrderDetail = {
  id: 42,
  orderId: 1001,
  orderTime: '2024-03-15T10:00:00Z',
  urgent: false,
  specialNotes: '',
  serialNumber: 'SN-99',
  customOrder: false,
  repair: false,
  demo: false,
  sponsored: false,
  fitterStock: false,
  orderStep: 1,
  currency: 'USD',
  fitterReference: 'REF-001',
  orderData: null,
  orderName: null,
  horseName: null,
  orderAddress: null,
  orderCity: null,
  orderState: null,
  orderZipcode: null,
  orderCountry: null,
  orderPhone: null,
  orderCell: null,
  orderEmail: null,
  shipName: null,
  shipAddress: null,
  shipCity: null,
  shipState: null,
  shipZipcode: null,
  shipCountry: null,
  priceSaddle: 3500,
  priceTradein: 0,
  priceDeposit: 0,
  priceDiscount: 0,
  priceFittingeval: 0,
  priceCallfee: 0,
  priceGirth: 0,
  priceShipping: 0,
  priceTax: 0,
  priceAdditional: 0,
  totalPrice: 3500,
  orderStatus: 'Ordered',
  statusId: 2,
  customerId: 7,
  customerName: 'Jane Rider',
  customerEmail: 'jane@example.com',
  customerAddress: null,
  customerCity: null,
  customerState: null,
  customerZipcode: null,
  customerCountry: null,
  customerPhone: null,
  customerCell: null,
  fitterId: 3,
  fitterName: 'Bob Fitter',
  fitterUsername: 'bfitter',
  fitterEmail: null,
  fitterAddress: null,
  fitterCity: null,
  fitterState: null,
  fitterZipcode: null,
  fitterCountry: null,
  fitterPhone: null,
  fitterCell: null,
  fitterCurrency: 'USD',
  factoryId: null,
  factoryName: null,
  factoryUsername: null,
  saddleId: 10,
  brandName: 'Custom Saddlery',
  modelName: 'Elegance',
  saddleType: null,
  leatherId: 2,
  leatherName: 'Full Grain',
  saddleSpecs: [],
  comments: [],
  logEntries: [],
};

const defaultOrder = { id: '42', orderId: 1001, status: 'Ordered' };

async function renderLoadedOrderDetails() {
  fetchOrderDetail.mockResolvedValue(mockOrderDetail);
  render(<OrderDetails order={defaultOrder} onClose={jest.fn()} />);
  await waitFor(() =>
    expect(screen.queryByText('Loading order details...')).not.toBeInTheDocument()
  );
}

describe('Edit Order dialog lifecycle (OrderDetails host)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not mount the editor before Edit order is clicked', async () => {
    await renderLoadedOrderDetails();

    expect(screen.queryByTestId('comprehensive-edit-order')).not.toBeInTheDocument();
    expect(mockEditorMounted).not.toHaveBeenCalled();
  });

  it('unmounts the editor when Cancel is clicked', async () => {
    await renderLoadedOrderDetails();

    fireEvent.click(screen.getByRole('button', { name: /edit order/i }));
    await waitFor(() => expect(screen.getByTestId('comprehensive-edit-order')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('cancel-edit'));

    await waitFor(() =>
      expect(screen.queryByTestId('comprehensive-edit-order')).not.toBeInTheDocument()
    );
  });

  it('reopens the same order with a fresh editor, discarding unsaved edits', async () => {
    await renderLoadedOrderDetails();

    // Open, dirty the form, cancel
    fireEvent.click(screen.getByRole('button', { name: /edit order/i }));
    await waitFor(() => expect(screen.getByTestId('comprehensive-edit-order')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('make-dirty'));
    expect(screen.getByTestId('comprehensive-edit-order')).toHaveAttribute('data-dirty', 'true');
    fireEvent.click(screen.getByTestId('cancel-edit'));

    // Reopen the same order — must be a brand-new editor instance
    fireEvent.click(screen.getByRole('button', { name: /edit order/i }));
    await waitFor(() => expect(screen.getByTestId('comprehensive-edit-order')).toBeInTheDocument());

    expect(screen.getByTestId('comprehensive-edit-order')).toHaveAttribute('data-dirty', 'false');
    expect(mockEditorMounted).toHaveBeenCalledTimes(2);
  });
});
