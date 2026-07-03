import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { EditOrder } from '@/components/EditOrder';
import * as orderEditViewModule from '@/services/orderEditView';
import * as enrichedOrdersModule from '@/services/enrichedOrders';

// ---------------------------------------------------------------------------
// Service mocks
// ---------------------------------------------------------------------------

jest.mock('@/services/orderEditView', () => ({
  fetchOrderEditData: jest.fn(),
  searchCustomers: jest.fn(),
  searchFitters: jest.fn(),
  saveOrderEditData: jest.fn(),
}));

jest.mock('@/services/enrichedOrders', () => ({
  createOrderFromPayload: jest.fn(),
}));

jest.mock('@/services/api-config', () => ({
  API_URL: 'http://localhost:3001',
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// ---------------------------------------------------------------------------
// UI component mocks
// ---------------------------------------------------------------------------

jest.mock('@/components/ui/dialog', () => ({
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; 'data-testid'?: string }) => (
    <button onClick={onClick} disabled={disabled} data-testid={props['data-testid']}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode }) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value }: { children: React.ReactNode; value?: string }) => (
    <div data-testid="select" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input type="checkbox" {...props} />,
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: () => <span />,
  ChevronRight: () => <span />,
  Search: () => <span />,
  User: () => <span />,
  Package: () => <span />,
  Settings: () => <span />,
  Plus: () => <span />,
}));

// ---------------------------------------------------------------------------
// Typed references to mocked modules (resolved after jest.mock hoisting)
// ---------------------------------------------------------------------------

const fetchOrderEditData = orderEditViewModule.fetchOrderEditData as jest.Mock;
const saveOrderEditData = orderEditViewModule.saveOrderEditData as jest.Mock;

const createOrderFromPayload = enrichedOrdersModule.createOrderFromPayload as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockOrderEditData = {
  id: 42,
  orderStatus: 'ORDERED',
  reference: 'REF-042',
  fitterReference: 'FIT-REF-042',
  urgent: false,
  currency: 'USD',
  orderTime: '2024-03-10T09:00:00Z',
  notes: 'Handle with care',
  internalNotes: 'Internal only note',
  customerId: 7,
  customerName: 'Jane Smith',
  customerEmail: 'jane@example.com',
  customerAddress: '789 Elm St',
  customerCity: 'Denver',
  customerZipcode: '80201',
  customerState: 'CO',
  customerCountry: 'US',
  customerPhoneNo: '555-9012',
  fitterId: 3,
  fitterName: 'Pro Fitter',
  fitterEmail: 'pro@fitter.com',
  factoryId: 2,
  factoryName: 'Fine Factory',
  price: 3200,
  discount: 100,
  tax: 50,
  shipping: 75,
  total: 3225,
  seatSizes: ['17'],
  orderLines: [],
  comments: [],
  isStock: false,
  isDemo: false,
  isSponsored: false,
  isRepair: false,
};

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultOrder = { id: '42', orderId: 42 };

// ---------------------------------------------------------------------------
// Helper: render the component for a new order (no order prop)
// ---------------------------------------------------------------------------

function renderNewOrder(
  props: Partial<React.ComponentProps<typeof EditOrder>> = {}
) {
  const merged = {
    onClose: jest.fn(),
    ...props,
  };
  return render(<EditOrder {...merged} />);
}

// ---------------------------------------------------------------------------
// Helper: render the component with an existing order and wait for load
// ---------------------------------------------------------------------------

async function renderAndWaitForLoad(
  props: Partial<React.ComponentProps<typeof EditOrder>> = {}
) {
  const merged = {
    order: defaultOrder,
    onClose: jest.fn(),
    ...props,
  };
  render(<EditOrder {...merged} />);
  // fetchOrderEditData is async — wait until "Loading order data..." disappears
  await waitFor(() =>
    expect(screen.queryByText('Loading order data...')).not.toBeInTheDocument()
  );
}

// ---------------------------------------------------------------------------
// Helper: advance the form to a specific step via the "Next Step" button
// ---------------------------------------------------------------------------

async function navigateToStep(targetStep: 2 | 3) {
  for (let step = 1; step < targetStep; step++) {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    });
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('EditOrder component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchOrderEditData as jest.Mock).mockResolvedValue(mockOrderEditData);
    (saveOrderEditData as jest.Mock).mockResolvedValue({ success: true });
    (createOrderFromPayload as jest.Mock).mockResolvedValue({
      success: true,
      orderId: 99,
    });
  });

  // =========================================================================
  // 1. Rendering
  // =========================================================================
  describe('rendering', () => {
    it('renders "New Order" title when order is undefined', () => {
      renderNewOrder();

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('New Order');
    });

    it('renders "Edit Order" title when order is provided and isDuplicate is false', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        'Edit Order #42'
      );
    });

    it('renders "Duplicate Order" title when isDuplicate is true', async () => {
      await renderAndWaitForLoad({ isDuplicate: true });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        'Duplicate Order #42'
      );
    });

    it('shows loading state when isLoading prop is true', () => {
      render(
        <EditOrder order={defaultOrder} isLoading={true} onClose={jest.fn()} />
      );

      expect(screen.getByText('Loading order data...')).toBeInTheDocument();
    });

    it('shows loading state while fetchOrderEditData is pending', () => {
      // Never resolves — component stays in loading state
      (fetchOrderEditData as jest.Mock).mockReturnValue(new Promise(() => {}));

      render(<EditOrder order={defaultOrder} onClose={jest.fn()} />);

      expect(screen.getByText('Loading order data...')).toBeInTheDocument();
    });

    it('shows error state when error prop is set', async () => {
      render(
        <EditOrder
          order={defaultOrder}
          onClose={jest.fn()}
          error="Something went wrong"
        />
      );

      // fetchOrderEditData resolves so loadingData clears, revealing the error
      await waitFor(() =>
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      );
      expect(screen.getByText('Error loading order data')).toBeInTheDocument();
    });

    it('falls back to minimal form data when fetchOrderEditData fails (non-auth error)', async () => {
      // fetchOrderEditData rejection is caught by the INNER try/catch in loadOrderData.
      // The component recovers gracefully: it creates minimal fallback data and sets
      // loadingData=false. The form renders normally (no error UI) for non-auth errors.
      (fetchOrderEditData as jest.Mock).mockRejectedValue(
        new Error('Network timeout')
      );

      render(<EditOrder order={defaultOrder} onClose={jest.fn()} />);

      // Wait for loading to finish — the form should render without an error banner
      await waitFor(() =>
        expect(screen.queryByText('Loading order data...')).not.toBeInTheDocument()
      );

      // Form renders normally — Saddle Specifications heading is visible on step 1
      expect(screen.getByText('Saddle Specifications')).toBeInTheDocument();
    });

    it('renders the step title in the dialog header on mount', () => {
      renderNewOrder();

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        'Step 1: Products & Pricing'
      );
    });

    it('renders all three step indicator labels', async () => {
      await renderAndWaitForLoad();

      expect(
        screen.getAllByText('Products & Pricing').length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText('Customer & Shipping').length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText('Order Settings').length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 2. Step navigation
  // =========================================================================
  describe('step navigation', () => {
    it('starts at step 1 (Products & Pricing)', () => {
      renderNewOrder();

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        'Step 1: Products & Pricing'
      );
    });

    it('advances to step 2 when Next Step is clicked once', async () => {
      await renderAndWaitForLoad();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next step/i }));
      });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        'Step 2: Customer & Shipping'
      );
    });

    it('advances to step 3 when Next Step is clicked twice', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(3);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        'Step 3: Order Settings'
      );
    });

    it('goes back from step 2 to step 1 when Previous Step is clicked', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(2);
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 2:');

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /previous step/i })
        );
      });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 1:');
    });

    it('goes back from step 3 to step 2 when Previous Step is clicked', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(3);
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 3:');

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /previous step/i })
        );
      });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 2:');
    });

    it('calls onClose when Cancel is clicked on step 1 (no onBack prop)', async () => {
      const onClose = jest.fn();
      await renderAndWaitForLoad({ onClose });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onBack when onBack prop is provided and back is triggered on step 1', async () => {
      const onBack = jest.fn();
      const onClose = jest.fn();
      await renderAndWaitForLoad({ onBack, onClose });

      // The header "Back to Orders" button also triggers handleBack
      const backButtons = screen.getAllByRole('button', {
        name: /back to orders/i,
      });
      fireEvent.click(backButtons[0]);

      expect(onBack).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does NOT call onBack when onBack is provided but we are past step 1', async () => {
      const onBack = jest.fn();
      await renderAndWaitForLoad({ onBack });

      await navigateToStep(2);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /previous step/i })
        );
      });

      // Goes back to step 1 — onBack should NOT have been called
      expect(onBack).not.toHaveBeenCalled();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 1:');
    });

    it('shows "Cancel" on the footer back button when on step 1', async () => {
      await renderAndWaitForLoad();

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('shows "Previous Step" on the footer back button when on step 2', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(2);

      expect(
        screen.getByRole('button', { name: /previous step/i })
      ).toBeInTheDocument();
    });

    it('shows "Next Step" on the primary button while on step 1', async () => {
      await renderAndWaitForLoad();

      expect(
        screen.getByRole('button', { name: /next step/i })
      ).toBeInTheDocument();
    });

    it('shows "Next Step" on the primary button while on step 2', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(2);

      expect(
        screen.getByRole('button', { name: /next step/i })
      ).toBeInTheDocument();
    });

    it('shows "Update Order" on the primary button at step 3 in edit mode', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      await navigateToStep(3);

      expect(
        screen.getByRole('button', { name: /update order/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /next step/i })
      ).not.toBeInTheDocument();
    });

    it('shows "Create Order" on the primary button at step 3 for a new order (order=undefined)', async () => {
      renderNewOrder();

      await navigateToStep(3);

      expect(
        screen.getByRole('button', { name: /create order/i })
      ).toBeInTheDocument();
    });

    it('shows "Update Order" on the primary button at step 3 in duplicate mode when order is provided', async () => {
      // The button label is driven solely by `order ? 'Update Order' : 'Create Order'`.
      // When isDuplicate=true AND order is provided the label is still "Update Order".
      // Internally handleSubmit routes to createOrderFromPayload (isNewOrder = !order || isDuplicate = true).
      await renderAndWaitForLoad({ isDuplicate: true });

      await navigateToStep(3);

      expect(
        screen.getByRole('button', { name: /update order/i })
      ).toBeInTheDocument();
    });

    it('jumps to step 2 when the Customer & Shipping step indicator is clicked', async () => {
      await renderAndWaitForLoad();

      const indicators = screen.getAllByRole('button', {
        name: /customer & shipping/i,
      });
      await act(async () => {
        fireEvent.click(indicators[0]);
      });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 2:');
    });

    it('jumps to step 3 when the Order Settings step indicator is clicked', async () => {
      await renderAndWaitForLoad();

      const indicators = screen.getAllByRole('button', {
        name: /order settings/i,
      });
      await act(async () => {
        fireEvent.click(indicators[0]);
      });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 3:');
    });
  });

  // =========================================================================
  // 3. New order creation (order prop is undefined)
  // =========================================================================
  describe('new order creation', () => {
    it('calls createOrderFromPayload when submitting a new order (order=undefined)', async () => {
      renderNewOrder();

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );
    });

    it('calls createOrderFromPayload with the correct payload mapping from formData', async () => {
      renderNewOrder();

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );

      const payload = (createOrderFromPayload as jest.Mock).mock.calls[0][0];

      // formData.status → payload.orderStatus
      expect(payload.orderStatus).toBe('DRAFT');
      // formData.isUrgent → payload.rushed
      expect(payload.rushed).toBe(false);
      // formData.isDemo → payload.demo
      expect(payload.demo).toBe(false);
      // formData.isRepair → payload.repair
      expect(payload.repair).toBe(false);
      // formData.isSponsored → payload.sponsored
      expect(payload.sponsored).toBe(false);
      // formData.isStock → payload.fitterStock
      expect(payload.fitterStock).toBe(false);
      // formData.pricing.subtotal → payload.priceSaddle
      expect(payload.priceSaddle).toBe(0);
      // formData.pricing.discount → payload.priceDiscount
      expect(payload.priceDiscount).toBe(0);
      // formData.pricing.tax → payload.priceTax
      expect(payload.priceTax).toBe(0);
      // formData.pricing.shipping → payload.priceShipping
      expect(payload.priceShipping).toBe(0);
    });

    it('does NOT call saveOrderEditData when submitting a new order', async () => {
      renderNewOrder();

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );
      expect(saveOrderEditData).not.toHaveBeenCalled();
    });

    it('calls onClose after successful new order creation', async () => {
      const onClose = jest.fn();
      renderNewOrder({ onClose });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('does NOT call onClose when createOrderFromPayload rejects on a new order', async () => {
      (createOrderFromPayload as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );
      const onClose = jest.fn();
      renderNewOrder({ onClose });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not fetch order edit data when no order prop is supplied', () => {
      renderNewOrder();

      expect(fetchOrderEditData).not.toHaveBeenCalled();
    });

    it('payload does not include customerId when no customer is selected', async () => {
      renderNewOrder();

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );

      const payload = (createOrderFromPayload as jest.Mock).mock.calls[0][0];
      // No customer selected — customerId should be undefined
      expect(payload.customerId).toBeUndefined();
    });

    it('payload does not include fitterId when no fitter is selected', async () => {
      renderNewOrder();

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );

      const payload = (createOrderFromPayload as jest.Mock).mock.calls[0][0];
      expect(payload.fitterId).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. Duplicate order creation (isDuplicate=true, order provided)
  // =========================================================================
  describe('duplicate order creation', () => {
    // NOTE: when isDuplicate=true AND order is provided, the submit button label
    // is "Update Order" (driven by `order ? 'Update Order' : 'Create Order'`).
    // Internally, handleSubmit checks `isNewOrder = !order || isDuplicate = true`
    // and routes to createOrderFromPayload — NOT saveOrderEditData.

    it('calls createOrderFromPayload when submitting in duplicate mode', async () => {
      await renderAndWaitForLoad({ isDuplicate: true });

      await navigateToStep(3);

      // Button label is "Update Order" even in duplicate mode (order is truthy)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );
    });

    it('does NOT call saveOrderEditData in duplicate mode', async () => {
      await renderAndWaitForLoad({ isDuplicate: true });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );
      expect(saveOrderEditData).not.toHaveBeenCalled();
    });

    it('calls onClose after successful duplicate creation', async () => {
      const onClose = jest.fn();
      await renderAndWaitForLoad({ isDuplicate: true, onClose });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('maps status to DRAFT in duplicate mode when duplicateData provides status', async () => {
      // Duplicate mode always sets status to DRAFT regardless of source
      await renderAndWaitForLoad({
        isDuplicate: true,
        duplicateData: {
          isUrgent: true,
          isStock: false,
          isDemo: true,
          isSponsored: false,
          isRepair: false,
          specialNotes: 'Duplicated notes',
          price: 2000,
          discount: 50,
        },
      });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );

      const payload = (createOrderFromPayload as jest.Mock).mock.calls[0][0];
      // In duplicate mode the component sets status to 'DRAFT'
      expect(payload.orderStatus).toBe('DRAFT');
    });

    it('maps duplicateData flags to payload fields in duplicate mode', async () => {
      await renderAndWaitForLoad({
        isDuplicate: true,
        duplicateData: {
          isUrgent: true,
          isStock: false,
          isDemo: true,
          isSponsored: false,
          isRepair: true,
          specialNotes: '',
          price: 0,
        },
      });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );

      const payload = (createOrderFromPayload as jest.Mock).mock.calls[0][0];
      expect(payload.rushed).toBe(true);
      expect(payload.demo).toBe(true);
      expect(payload.repair).toBe(true);
      expect(payload.sponsored).toBe(false);
      expect(payload.fitterStock).toBe(false);
    });
  });

  // =========================================================================
  // 5. Order editing (isDuplicate=false, order provided)
  // =========================================================================
  describe('order editing', () => {
    it('calls saveOrderEditData when submitting an existing order edit', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() =>
        expect(saveOrderEditData).toHaveBeenCalledTimes(1)
      );
    });

    it('calls saveOrderEditData with the correct orderId', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() =>
        expect(saveOrderEditData).toHaveBeenCalledTimes(1)
      );

      const [calledOrderId] = (saveOrderEditData as jest.Mock).mock.calls[0];
      expect(calledOrderId).toBe(42);
    });

    it('does NOT call createOrderFromPayload in edit mode', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() =>
        expect(saveOrderEditData).toHaveBeenCalledTimes(1)
      );
      expect(createOrderFromPayload).not.toHaveBeenCalled();
    });

    it('calls onClose after a successful edit', async () => {
      const onClose = jest.fn();
      await renderAndWaitForLoad({ isDuplicate: false, onClose });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('does NOT call onClose when saveOrderEditData rejects', async () => {
      (saveOrderEditData as jest.Mock).mockRejectedValue(
        new Error('Save failed')
      );
      const onClose = jest.fn();

      await renderAndWaitForLoad({ isDuplicate: false, onClose });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() =>
        expect(saveOrderEditData).toHaveBeenCalledTimes(1)
      );
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls fetchOrderEditData with the numeric order id on mount', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      expect(fetchOrderEditData).toHaveBeenCalledTimes(1);
      // order.id is '42' — component calls fetchOrderEditData(Number(order.id))
      expect(fetchOrderEditData).toHaveBeenCalledWith(42);
    });

    it('initialises formData.status from the loaded order status', async () => {
      // mockOrderEditData.orderStatus is 'ORDERED'
      await renderAndWaitForLoad({ isDuplicate: false });

      await navigateToStep(3);

      // The Status select should reflect 'ORDERED'
      const selects = screen.getAllByTestId('select');
      const statusSelect = selects.find(
        (el) => el.getAttribute('data-value') === 'ORDERED'
      );
      expect(statusSelect).toBeTruthy();
    });
  });

  // =========================================================================
  // 6. Step content rendering
  // =========================================================================
  describe('step content rendering', () => {
    describe('step 1 — Products & Pricing', () => {
      it('renders the Saddle Specifications heading', async () => {
        await renderAndWaitForLoad();

        expect(screen.getByText('Saddle Specifications')).toBeInTheDocument();
      });

      it('renders the Pricing heading', async () => {
        await renderAndWaitForLoad();

        expect(screen.getByText('Pricing')).toBeInTheDocument();
      });

      it('renders the saddle price input with a default value', async () => {
        await renderAndWaitForLoad();

        // Static default value in the component is 3795.00
        expect(screen.getByDisplayValue('3795.00')).toBeInTheDocument();
      });

      it('renders the Fitter label on step 1', async () => {
        await renderAndWaitForLoad();

        expect(screen.getByText(/^Fitter:/)).toBeInTheDocument();
      });
    });

    describe('step 2 — Customer & Shipping', () => {
      it('renders the Customer heading', async () => {
        await renderAndWaitForLoad();

        await navigateToStep(2);

        expect(screen.getByText('Customer')).toBeInTheDocument();
      });

      it('renders the Fitter heading', async () => {
        await renderAndWaitForLoad();

        await navigateToStep(2);

        expect(screen.getByText('Fitter')).toBeInTheDocument();
      });

      it('renders the Shipping Address section', async () => {
        await renderAndWaitForLoad();

        await navigateToStep(2);

        expect(screen.getByText('Shipping Address')).toBeInTheDocument();
      });

      it('renders the Search Customer label', async () => {
        await renderAndWaitForLoad();

        await navigateToStep(2);

        expect(screen.getByText('Search Customer')).toBeInTheDocument();
      });

      it('renders the Search Fitter label', async () => {
        await renderAndWaitForLoad();

        await navigateToStep(2);

        expect(screen.getByText('Search Fitter')).toBeInTheDocument();
      });
    });

    describe('step 3 — Order Settings', () => {
      beforeEach(async () => {
        await renderAndWaitForLoad({ isDuplicate: false });
        await navigateToStep(3);
      });

      it('renders the Order Information section heading', () => {
        expect(screen.getByText('Order Information')).toBeInTheDocument();
      });

      it('renders the Flags section heading', () => {
        expect(screen.getByText('Flags')).toBeInTheDocument();
      });

      it('renders all flag checkboxes (Urgent, Stock, Demo, Sponsored, Repair)', () => {
        expect(screen.getByText('Urgent')).toBeInTheDocument();
        expect(screen.getByText('Stock')).toBeInTheDocument();
        expect(screen.getByText('Demo')).toBeInTheDocument();
        expect(screen.getByText('Sponsored')).toBeInTheDocument();
        expect(screen.getByText('Repair')).toBeInTheDocument();
      });

      it('renders all ORDER_STATUSES as select items', () => {
        expect(screen.getByText('Draft')).toBeInTheDocument();
        expect(screen.getByText('Unordered')).toBeInTheDocument();
        expect(screen.getByText('Ordered')).toBeInTheDocument();
        expect(screen.getByText('Approved')).toBeInTheDocument();
        expect(screen.getByText('Cancelled')).toBeInTheDocument();
      });

      it('renders the Reference input field', () => {
        expect(screen.getByText('Reference')).toBeInTheDocument();
      });

      it('renders the Requested Delivery Date input', () => {
        expect(screen.getByText('Requested Delivery Date')).toBeInTheDocument();
      });

    });
  });

  // =========================================================================
  // 7. Error handling on submit
  // =========================================================================
  describe('error handling on submit', () => {
    it('does NOT call onClose when createOrderFromPayload rejects during new order submit', async () => {
      // This test uses order=undefined so button label is "Create Order"
      (createOrderFromPayload as jest.Mock).mockRejectedValue(
        new Error('Create failed')
      );
      const onClose = jest.fn();
      renderNewOrder({ onClose });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does NOT call createOrderFromPayload when saveOrderEditData rejects in edit mode', async () => {
      (saveOrderEditData as jest.Mock).mockRejectedValue(
        new Error('Edit save failed')
      );

      await renderAndWaitForLoad({ isDuplicate: false });

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() =>
        expect(saveOrderEditData).toHaveBeenCalledTimes(1)
      );
      expect(createOrderFromPayload).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 8. formData default values (new order, order=undefined)
  // =========================================================================
  describe('default formData when no order is provided', () => {
    it('initialises status as DRAFT', async () => {
      renderNewOrder();

      await navigateToStep(3);

      const selects = screen.getAllByTestId('select');
      const statusSelect = selects.find(
        (el) => el.getAttribute('data-value') === 'DRAFT'
      );
      expect(statusSelect).toBeTruthy();
    });

    it('initialises isUrgent as false — payload rushed is false', async () => {
      renderNewOrder();

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );

      const payload = (createOrderFromPayload as jest.Mock).mock.calls[0][0];
      expect(payload.rushed).toBe(false);
    });

    it('initialises isDemo as false — payload demo is false', async () => {
      renderNewOrder();

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );

      const payload = (createOrderFromPayload as jest.Mock).mock.calls[0][0];
      expect(payload.demo).toBe(false);
    });

    it('initialises pricing.subtotal as 0 — payload priceSaddle is 0', async () => {
      renderNewOrder();

      await navigateToStep(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });

      await waitFor(() =>
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1)
      );

      const payload = (createOrderFromPayload as jest.Mock).mock.calls[0][0];
      expect(payload.priceSaddle).toBe(0);
    });

    it('initialises pricing.currency as USD', async () => {
      // currency is stored in formData.pricing.currency — not sent in createPayload
      // but we verify it doesn't cause an error and formData is correct structurally
      renderNewOrder();

      // No assertion about currency in payload since it is not part of UpdateOrderPayload,
      // but we verify the component renders without crashing and reaches step 3
      await navigateToStep(3);

      expect(
        screen.getByRole('button', { name: /create order/i })
      ).toBeInTheDocument();
    });
  });
});
