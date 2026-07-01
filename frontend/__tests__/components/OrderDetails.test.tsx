import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OrderDetails } from '@/components/OrderDetails';
import * as enrichedOrdersModule from '@/services/enrichedOrders';

// ---------------------------------------------------------------------------
// External service mocks
// ---------------------------------------------------------------------------

jest.mock('@/services/enrichedOrders', () => ({
  fetchOrderDetail: jest.fn(),
  updateOrder: jest.fn(),
  createOrderFromPayload: jest.fn(),
  createDraftOrder: jest.fn(),
}));

jest.mock('@/services/api-config', () => ({
  API_URL: 'http://localhost:3001',
}));

// ---------------------------------------------------------------------------
// UI component mocks
// ---------------------------------------------------------------------------

// Dialog: only render children when open
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: { children: React.ReactNode; onValueChange?: (v: string) => void; value?: string }) => (
    <div data-testid="select-wrapper">
      <select
        value={value}
        onChange={(e) => onValueChange && onValueChange(e.target.value)}
        data-testid="select-input"
      >
        {children}
      </select>
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ placeholder, value, onChange }: { placeholder?: string; value?: string; onChange?: React.ChangeEventHandler<HTMLTextAreaElement> }) => (
    <textarea placeholder={placeholder} value={value} onChange={onChange} />
  ),
}));

// PDF generation — not under test here
jest.mock('@/lib/generate-pdf', () => ({
  generateOrderPDF: jest.fn(() => ({ save: jest.fn() })),
  generateLabelPDF: jest.fn(() => ({ save: jest.fn() })),
}));

// ComprehensiveEditOrder — render a stub that is identifiable.
// Mirror the real component's default: isDuplicate defaults to false when not supplied.
jest.mock('@/components/ComprehensiveEditOrder', () => ({
  ComprehensiveEditOrder: ({ isDuplicate = false, onClose }: { isDuplicate?: boolean; onClose: () => void }) => (
    <div data-testid="comprehensive-edit-order">
      <span data-testid="is-duplicate">{String(isDuplicate)}</span>
      <button onClick={onClose} data-testid="close-edit">
        Close
      </button>
    </div>
  ),
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fetchOrderDetail = enrichedOrdersModule.fetchOrderDetail as jest.Mock;
const createDraftOrder = enrichedOrdersModule.createDraftOrder as jest.Mock;

const mockOrderDetail = {
  id: 42,
  orderId: 1001,
  orderTime: '2024-03-15T10:00:00Z',
  urgent: false,
  specialNotes: 'Handle with care',
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
  priceTradein: 500,
  priceDeposit: 250,
  priceDiscount: 0,
  priceFittingeval: 0,
  priceCallfee: 0,
  priceGirth: 0,
  priceShipping: 0,
  priceTax: 0,
  priceAdditional: 0,
  totalPrice: 2750,
  orderStatus: 'Ordered',
  statusId: 2,
  customerId: 7,
  customerName: 'Jane Rider',
  customerEmail: 'jane@example.com',
  customerAddress: '10 Stable Rd',
  customerCity: 'Lexington',
  customerState: 'KY',
  customerZipcode: '40502',
  customerCountry: 'USA',
  customerPhone: '555-1234',
  customerCell: '555-5678',
  fitterId: 3,
  fitterName: 'Bob Fitter',
  fitterUsername: 'bfitter',
  fitterEmail: 'bob@fitter.com',
  fitterAddress: '5 Paddock Lane',
  fitterCity: 'Lexington',
  fitterState: 'KY',
  fitterZipcode: '40503',
  fitterCountry: 'USA',
  fitterPhone: '555-9999',
  fitterCell: '555-8888',
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
  saddleSpecs: [
    {
      optionId: 1,
      optionName: 'Seat Size',
      optionItemId: 5,
      itemName: '17.5"',
      leatherName: null,
      custom: '',
      sequence: 1,
      displayValue: '17.5"',
    },
  ],
  comments: [],
  logEntries: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultOrder = { id: '42', orderId: 1001, status: 'Ordered' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrderDetails component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Loading state
  // -------------------------------------------------------------------------
  it('shows loading spinner and text while fetch is pending', () => {
    // fetchOrderDetail never resolves during this test
    fetchOrderDetail.mockReturnValue(new Promise(() => {}));

    render(<OrderDetails order={defaultOrder} onClose={jest.fn()} />);

    // Loading indicator: the spinner div and descriptive text
    expect(
      screen.getByText('Loading order details...')
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. Successful data display
  // -------------------------------------------------------------------------
  it('displays order data after successful fetch', async () => {
    fetchOrderDetail.mockResolvedValue(mockOrderDetail);

    render(<OrderDetails order={defaultOrder} onClose={jest.fn()} />);

    // Wait for the loading state to clear and real data to appear
    await waitFor(() =>
      expect(screen.queryByText('Loading order details...')).not.toBeInTheDocument()
    );

    // Order ID in header (orderId=1001)
    expect(screen.getByText(/Order 1001/)).toBeInTheDocument();

    // Customer section
    expect(screen.getByText('Jane Rider')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();

    // Fitter section
    expect(screen.getByText('Bob Fitter')).toBeInTheDocument();

    // Saddle info
    expect(
      screen.getByText('Custom Saddlery Elegance')
    ).toBeInTheDocument();
    expect(screen.getByText('Full Grain')).toBeInTheDocument();

    // Pricing — saddle price formatted to 2dp
    expect(screen.getByText('3500.00')).toBeInTheDocument();

    // Serial number
    expect(screen.getByText('SN-99')).toBeInTheDocument();

    // Special notes
    expect(screen.getByText('Handle with care')).toBeInTheDocument();

    // Saddle spec
    expect(screen.getByText('17.5"')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Error state when fetch fails
  // -------------------------------------------------------------------------
  it('shows error message when fetchOrderDetail rejects', async () => {
    fetchOrderDetail.mockRejectedValue(
      new Error('Network error: 500')
    );

    render(<OrderDetails order={defaultOrder} onClose={jest.fn()} />);

    await waitFor(() =>
      expect(
        screen.getByText('Failed to load order details')
      ).toBeInTheDocument()
    );

    // Specific error message from the Error object
    expect(screen.getByText('Network error: 500')).toBeInTheDocument();

    // Retry button present
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 4. Edit button opens ComprehensiveEditOrder with isDuplicate=false
  // -------------------------------------------------------------------------
  it('opens ComprehensiveEditOrder in edit mode when Edit order button is clicked', async () => {
    fetchOrderDetail.mockResolvedValue(mockOrderDetail);

    render(<OrderDetails order={defaultOrder} onClose={jest.fn()} />);

    await waitFor(() =>
      expect(screen.queryByText('Loading order details...')).not.toBeInTheDocument()
    );

    // ComprehensiveEditOrder should NOT be visible before clicking Edit
    expect(
      screen.queryByTestId('comprehensive-edit-order')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /edit order/i }));

    // After click the edit dialog opens
    await waitFor(() =>
      expect(
        screen.getByTestId('comprehensive-edit-order')
      ).toBeInTheDocument()
    );

    // isDuplicate must be false for edit mode
    expect(screen.getByTestId('is-duplicate').textContent).toBe('false');
  });

  // -------------------------------------------------------------------------
  // 5. Duplicate button opens ComprehensiveEditOrder with isDuplicate=true
  // -------------------------------------------------------------------------
  it('opens ComprehensiveEditOrder in duplicate mode when Duplicate order button is clicked', async () => {
    fetchOrderDetail.mockResolvedValue(mockOrderDetail);
    createDraftOrder.mockResolvedValue({ success: true, orderId: 42 });

    render(<OrderDetails order={defaultOrder} onClose={jest.fn()} />);

    await waitFor(() =>
      expect(screen.queryByText('Loading order details...')).not.toBeInTheDocument()
    );

    // ComprehensiveEditOrder should NOT be visible before clicking Duplicate
    expect(
      screen.queryByTestId('comprehensive-edit-order')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /duplicate order/i })
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('comprehensive-edit-order')
      ).toBeInTheDocument()
    );

    // isDuplicate must be true for duplicate mode
    expect(screen.getByTestId('is-duplicate').textContent).toBe('true');
  });

  // -------------------------------------------------------------------------
  // 6. Only one panel open at a time — edit and duplicate are independent
  // -------------------------------------------------------------------------
  it('only shows one ComprehensiveEditOrder at a time', async () => {
    fetchOrderDetail.mockResolvedValue(mockOrderDetail);
    createDraftOrder.mockResolvedValue({ success: true, orderId: 42 });

    render(<OrderDetails order={defaultOrder} onClose={jest.fn()} />);

    await waitFor(() =>
      expect(screen.queryByText('Loading order details...')).not.toBeInTheDocument()
    );

    // Open edit dialog
    fireEvent.click(screen.getByRole('button', { name: /edit order/i }));
    await waitFor(() =>
      expect(screen.getByTestId('is-duplicate').textContent).toBe('false')
    );

    // Close edit dialog via the stub's Close button
    fireEvent.click(screen.getByTestId('close-edit'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('comprehensive-edit-order')
      ).not.toBeInTheDocument()
    );

    // Open duplicate dialog
    fireEvent.click(
      screen.getByRole('button', { name: /duplicate order/i })
    );

    await waitFor(() =>
      expect(screen.getByTestId('is-duplicate').textContent).toBe('true')
    );
  });

  // -------------------------------------------------------------------------
  // 7. fetchOrderDetail is called with the numeric order id derived from props
  // -------------------------------------------------------------------------
  it('calls fetchOrderDetail with the correct numeric orderId', async () => {
    fetchOrderDetail.mockResolvedValue(mockOrderDetail);

    render(<OrderDetails order={{ id: '99', orderId: 99 }} onClose={jest.fn()} />);

    await waitFor(() =>
      expect(fetchOrderDetail).toHaveBeenCalledWith(99)
    );
  });

  // -------------------------------------------------------------------------
  // 8. No fetch when no valid orderId can be derived
  // -------------------------------------------------------------------------
  it('shows error immediately when the order prop has no valid id', async () => {
    render(
      <OrderDetails order={{ id: '0' }} onClose={jest.fn()} />
    );

    await waitFor(() =>
      expect(
        screen.getByText('No order ID provided')
      ).toBeInTheDocument()
    );

    expect(fetchOrderDetail).not.toHaveBeenCalled();
  });
});
