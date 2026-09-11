import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { ComprehensiveEditOrder } from '@/components/ComprehensiveEditOrder';
import * as enrichedOrdersModule from '@/services/enrichedOrders';
import * as sonnerModule from 'sonner';

// ---------------------------------------------------------------------------
// Service mocks
// ---------------------------------------------------------------------------

jest.mock('@/services/enrichedOrders', () => ({
  fetchOrderDetail: jest.fn(),
  updateOrder: jest.fn(),
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
  ClipboardList: () => <span />,
}));

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------

global.fetch = jest.fn();

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockOrderDetail = {
  id: 100,
  orderId: 100,
  orderTime: '2024-01-15T10:00:00Z',
  urgent: false,
  specialNotes: 'Test notes',
  serialNumber: 'SN-001',
  customOrder: false,
  repair: false,
  demo: false,
  sponsored: false,
  fitterStock: false,
  orderStep: null,
  currency: 'USD',
  fitterReference: 'REF-001',
  orderData: null,
  orderName: null,
  horseName: 'Thunder',
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
  priceSaddle: 2500,
  priceTradein: 0,
  priceDeposit: 500,
  priceDiscount: 0,
  priceFittingeval: 0,
  priceCallfee: 0,
  priceGirth: 0,
  priceShipping: 150,
  priceTax: 0,
  priceAdditional: 0,
  totalPrice: 2150,
  orderStatus: 'Pending',
  statusId: 1,
  customerId: 1,
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  customerAddress: '123 Main St',
  customerCity: 'Springfield',
  customerState: 'IL',
  customerZipcode: '62701',
  customerCountry: 'US',
  customerPhone: '555-1234',
  customerCell: null,
  fitterId: 5,
  fitterName: 'Expert Fitter',
  fitterUsername: 'expertfitter',
  fitterEmail: 'fitter@example.com',
  fitterAddress: '456 Oak Ave',
  fitterCity: 'Portland',
  fitterState: 'OR',
  fitterZipcode: '97201',
  fitterCountry: 'US',
  fitterPhone: '555-5678',
  fitterCell: null,
  fitterCurrency: 'USD',
  factoryId: 1,
  factoryName: 'Premium Factory',
  factoryUsername: 'factory1',
  saddleId: 10,
  brandName: 'Premium',
  modelName: 'Classic',
  saddleType: 'Dressage',
  leatherId: 3,
  leatherName: 'Italian Leather',
  saddleSpecs: [],
  comments: [],
  logEntries: [],
};

const mockEditOptions = {
  fitters: [{ id: 5, username: 'expertfitter', fullName: 'Expert Fitter' }],
  saddles: [
    {
      id: 10,
      brand: 'Premium',
      modelName: 'Classic',
      displayName: 'Premium Classic',
    },
  ],
  leatherTypes: [{ id: 3, name: 'Italian Leather' }],
  options: [],
  optionItems: [],
  statuses: [
    { id: 1, name: 'Pending' },
    { id: 2, name: 'Approved' },
  ],
};

// ---------------------------------------------------------------------------
// Typed references to mocked modules (resolved after jest.mock hoisting)
// ---------------------------------------------------------------------------

const fetchOrderDetail = enrichedOrdersModule.fetchOrderDetail as jest.Mock;
const updateOrder = enrichedOrdersModule.updateOrder as jest.Mock;
const createOrderFromPayload = enrichedOrdersModule.createOrderFromPayload as jest.Mock;

const toast = sonnerModule.toast as unknown as { success: jest.Mock; error: jest.Mock };

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultOrder = { id: '100', orderId: 100 };

// ---------------------------------------------------------------------------
// Helper: render the component and wait for the loading state to clear
// ---------------------------------------------------------------------------

async function renderAndWaitForLoad(
  props: Partial<React.ComponentProps<typeof ComprehensiveEditOrder>> = {}
) {
  const merged = {
    order: defaultOrder,
    onClose: jest.fn(),
    ...props,
  };
  render(<ComprehensiveEditOrder {...merged} />);
  await waitFor(() =>
    expect(screen.queryByText('Loading order data...')).not.toBeInTheDocument()
  );
}

// ---------------------------------------------------------------------------
// Helper: advance the form to a specific step by clicking "Next Step"
// ---------------------------------------------------------------------------

async function navigateToStep(targetStep: 2 | 3 | 4) {
  for (let step = 1; step < targetStep; step++) {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    });
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ComprehensiveEditOrder component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchOrderDetail as jest.Mock).mockResolvedValue(mockOrderDetail);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEditOptions),
    });
  });

  // =========================================================================
  // 1. Loading state
  // =========================================================================
  describe('loading state', () => {
    it('shows "Loading order data..." while fetchOrderDetail is pending', () => {
      // fetchOrderDetail never resolves — component stays in loading state
      (fetchOrderDetail as jest.Mock).mockReturnValue(new Promise(() => {}));

      render(
        <ComprehensiveEditOrder
          order={defaultOrder}
          isDuplicate={false}
          onClose={jest.fn()}
        />
      );

      expect(screen.getByText('Loading order data...')).toBeInTheDocument();
    });

    it('clears the loading indicator once data resolves', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      expect(screen.queryByText('Loading order data...')).not.toBeInTheDocument();
    });

    it('shows loading state when the isLoading prop is true', () => {
      render(
        <ComprehensiveEditOrder
          order={defaultOrder}
          isDuplicate={false}
          isLoading={true}
          onClose={jest.fn()}
        />
      );

      expect(screen.getByText('Loading order data...')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Title rendering
  // =========================================================================
  describe('dialog title', () => {
    it('shows "Edit Order" in the header when isDuplicate is false', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Edit Order #100');
    });

    it('shows "Duplicate Order" in the header when isDuplicate is true', async () => {
      await renderAndWaitForLoad({ isDuplicate: true });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('New Order #100 (from #100)');
    });

    it('includes the current step number and step name in the title', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveTextContent('Step 1:');
      expect(title).toHaveTextContent('Saddle Information');
    });

    it('updates the title step label after navigating to step 2', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      await navigateToStep(2);

      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveTextContent('Step 2:');
      expect(title).toHaveTextContent('Customer Information');
    });

    it('updates the title step label after navigating to step 3', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      await navigateToStep(3);

      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveTextContent('Step 3:');
      expect(title).toHaveTextContent('Order overview');
    });
  });

  // =========================================================================
  // 3. Data fetching on mount
  // =========================================================================
  describe('data fetching on mount', () => {
    it('calls fetchOrderDetail with the numeric orderId on mount', async () => {
      await renderAndWaitForLoad();

      expect(fetchOrderDetail).toHaveBeenCalledTimes(1);
      expect(fetchOrderDetail).toHaveBeenCalledWith(100);
    });

    it('calls the edit-options endpoint with the saddleId from the loaded order', async () => {
      await renderAndWaitForLoad();

      // saddleId from mockOrderDetail is 10; includeDiscontinued is always
      // set so repair orders can pick legacy/discontinued saddles.
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/enriched_orders/edit-options?includeDiscontinued=true&saddleId=10',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('uses order.orderId when both id and orderId are provided', async () => {
      render(
        <ComprehensiveEditOrder
          order={{ id: '999', orderId: 42 }}
          onClose={jest.fn()}
        />
      );

      await waitFor(() =>
        expect(fetchOrderDetail).toHaveBeenCalledWith(42)
      );
    });

    it('falls back to Number(order.id) when orderId is falsy', async () => {
      render(
        <ComprehensiveEditOrder
          order={{ id: '77', orderId: 0 }}
          onClose={jest.fn()}
        />
      );

      await waitFor(() =>
        expect(fetchOrderDetail).toHaveBeenCalledWith(77)
      );
    });
  });

  // =========================================================================
  // 4. Step navigation via Next Step button
  // =========================================================================
  describe('step navigation via Next Step button', () => {
    it('shows "Next Step" on the primary action button while on step 1', async () => {
      await renderAndWaitForLoad();

      expect(screen.getByRole('button', { name: /next step/i })).toBeInTheDocument();
    });

    it('advances to step 2 (Customer Information) when Next Step is clicked', async () => {
      await renderAndWaitForLoad();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next step/i }));
      });

      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveTextContent('Step 2:');
      expect(title).toHaveTextContent('Customer Information');
    });

    it('advances to step 3 (Order overview) after clicking Next Step twice', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(3);

      const title = screen.getByTestId('dialog-title');
      expect(title).toHaveTextContent('Step 3:');
      expect(title).toHaveTextContent('Order overview');
    });

    it('shows "Update Order" on the primary button at step 4 in edit mode', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      await navigateToStep(4);

      expect(screen.getByRole('button', { name: /update order/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /next step/i })).not.toBeInTheDocument();
    });

    it('shows "Duplicate Order" on the primary button at step 4 in duplicate mode', async () => {
      await renderAndWaitForLoad({ isDuplicate: true });

      await navigateToStep(4);

      expect(
        screen.getByRole('button', { name: /duplicate order/i })
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /next step/i })).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. Step navigation via step indicator
  // =========================================================================
  describe('step navigation via step indicator buttons', () => {
    it('renders all four step title labels in the step indicator', async () => {
      await renderAndWaitForLoad();

      expect(screen.getAllByText('Saddle Information').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Customer Information').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Order overview').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Preview & Submit').length).toBeGreaterThanOrEqual(1);
    });

    it('jumps to step 2 when the Customer Information indicator button is clicked', async () => {
      await renderAndWaitForLoad();

      // The step indicator renders each step as a <button> containing the title
      const indicators = screen.getAllByRole('button', { name: /customer information/i });
      await act(async () => {
        fireEvent.click(indicators[0]);
      });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 2:');
    });

    it('jumps to step 3 when the Order overview indicator button is clicked', async () => {
      await renderAndWaitForLoad();

      const indicators = screen.getAllByRole('button', { name: /order overview/i });
      await act(async () => {
        fireEvent.click(indicators[0]);
      });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 3:');
    });
  });

  // =========================================================================
  // 6. handleBack behaviour
  // =========================================================================
  describe('handleBack behaviour', () => {
    it('goes back from step 2 to step 1 when Previous Step is clicked', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(2);
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 2:');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /previous step/i }));
      });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 1:');
    });

    it('goes back from step 3 to step 2 when Previous Step is clicked', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(3);
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 3:');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /previous step/i }));
      });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 2:');
    });

    it('shows "Cancel" on the footer back button when on step 1', async () => {
      await renderAndWaitForLoad();

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('shows "Previous Step" on the footer back button when on step 2', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(2);

      expect(screen.getByRole('button', { name: /previous step/i })).toBeInTheDocument();
    });

    it('calls onClose when the Cancel footer button is clicked on step 1 (no onBack prop)', async () => {
      const onClose = jest.fn();
      await renderAndWaitForLoad({ onClose });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onBack (not onClose) when onBack is provided and back is triggered on step 1', async () => {
      const onBack = jest.fn();
      const onClose = jest.fn();
      await renderAndWaitForLoad({ onBack, onClose });

      // Header "Back to Orders" arrow button also triggers handleBack on step 1
      const backBtns = screen.getAllByRole('button', { name: /back to orders/i });
      fireEvent.click(backBtns[0]);

      expect(onBack).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 7. Submit in edit mode (isDuplicate = false)
  // =========================================================================
  describe('submit in edit mode', () => {
    it('calls updateOrder with the correct orderId at step 4', async () => {
      (updateOrder as jest.Mock).mockResolvedValue({ success: true, orderId: 100 });
      const onClose = jest.fn();

      await renderAndWaitForLoad({ isDuplicate: false, onClose });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(updateOrder).toHaveBeenCalledTimes(1));
      expect(updateOrder).toHaveBeenCalledWith(100, expect.any(Object));
    });

    it('does NOT call createOrderFromPayload in edit mode', async () => {
      (updateOrder as jest.Mock).mockResolvedValue({ success: true, orderId: 100 });

      await renderAndWaitForLoad({ isDuplicate: false });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(updateOrder).toHaveBeenCalledTimes(1));
      expect(createOrderFromPayload).not.toHaveBeenCalled();
    });

    it('shows toast.success containing the orderId after a successful update', async () => {
      (updateOrder as jest.Mock).mockResolvedValue({ success: true, orderId: 100 });

      await renderAndWaitForLoad({ isDuplicate: false });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('100'));
    });

    it('calls onClose after a successful update', async () => {
      (updateOrder as jest.Mock).mockResolvedValue({ success: true, orderId: 100 });
      const onClose = jest.fn();

      await renderAndWaitForLoad({ isDuplicate: false, onClose });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('passes pricing values as numbers in the payload', async () => {
      (updateOrder as jest.Mock).mockResolvedValue({ success: true, orderId: 100 });

      await renderAndWaitForLoad({ isDuplicate: false });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(updateOrder).toHaveBeenCalledTimes(1));
      const [, payload] = (updateOrder as jest.Mock).mock.calls[0];
      expect(typeof payload.priceSaddle).toBe('number');
      // priceSaddle from fixture is 2500
      expect(payload.priceSaddle).toBe(2500);
    });
  });

  // =========================================================================
  // 8. Submit in duplicate mode (isDuplicate = true)
  // =========================================================================
  describe('submit in duplicate mode', () => {
    it('calls createOrderFromPayload at step 4 in duplicate mode', async () => {
      (createOrderFromPayload as jest.Mock).mockResolvedValue({
        success: true,
        orderId: 201,
      });
      const onClose = jest.fn();

      await renderAndWaitForLoad({ isDuplicate: true, onClose });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /duplicate order/i }));
      });

      await waitFor(() => expect(createOrderFromPayload).toHaveBeenCalledTimes(1));
      expect(createOrderFromPayload).toHaveBeenCalledWith(expect.any(Object));
    });

    it('does NOT call updateOrder in duplicate mode', async () => {
      (createOrderFromPayload as jest.Mock).mockResolvedValue({
        success: true,
        orderId: 201,
      });

      await renderAndWaitForLoad({ isDuplicate: true });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /duplicate order/i }));
      });

      await waitFor(() => expect(createOrderFromPayload).toHaveBeenCalledTimes(1));
      expect(updateOrder).not.toHaveBeenCalled();
    });

    it('shows toast.success with the new orderId returned by createOrderFromPayload', async () => {
      (createOrderFromPayload as jest.Mock).mockResolvedValue({
        success: true,
        orderId: 201,
      });

      await renderAndWaitForLoad({ isDuplicate: true });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /duplicate order/i }));
      });

      await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('201'));
    });

    it('calls onClose after a successful duplicate', async () => {
      (createOrderFromPayload as jest.Mock).mockResolvedValue({
        success: true,
        orderId: 201,
      });
      const onClose = jest.fn();

      await renderAndWaitForLoad({ isDuplicate: true, onClose });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /duplicate order/i }));
      });

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  // =========================================================================
  // 9. Error handling on submit
  // =========================================================================
  describe('error handling on submit', () => {
    it('shows toast.error with the error message when updateOrder rejects with an Error', async () => {
      (updateOrder as jest.Mock).mockRejectedValue(
        new Error('Server rejected the payload')
      );
      const onClose = jest.fn();

      await renderAndWaitForLoad({ isDuplicate: false, onClose });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      expect(toast.error).toHaveBeenCalledWith('Server rejected the payload');
    });

    it('does not resubmit an untouched status, and shows a reload prompt on 409', async () => {
      // Regression (P2 / issue 9): the form used to resubmit the status it loaded
      // with on every save, silently reverting a status another user had changed.
      const conflict = new Error(
        "Order 46550 is no longer in status 'Inventory Aiken'"
      );
      conflict.name = 'OrderStatusConflictError';
      (updateOrder as jest.Mock).mockRejectedValue(conflict);

      await renderAndWaitForLoad({ isDuplicate: false });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      // The status control was never touched, so no status is sent at all.
      const [, payload] = (updateOrder as jest.Mock).mock.calls[0];
      expect(payload.orderStatus).toBeUndefined();
      expect(payload.expectedStatus).toBeUndefined();

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('changed by someone else')
      );
    });

    it('shows toast.error with generic message when updateOrder rejects with a non-Error value', async () => {
      (updateOrder as jest.Mock).mockRejectedValue('unexpected string');

      await renderAndWaitForLoad({ isDuplicate: false });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      expect(toast.error).toHaveBeenCalledWith('Failed to save order');
    });

    it('shows toast.error when createOrderFromPayload rejects in duplicate mode', async () => {
      (createOrderFromPayload as jest.Mock).mockRejectedValue(
        new Error('Duplicate failed: conflict')
      );
      const onClose = jest.fn();

      await renderAndWaitForLoad({ isDuplicate: true, onClose });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /duplicate order/i }));
      });

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      expect(toast.error).toHaveBeenCalledWith('Duplicate failed: conflict');
    });

    it('does NOT call onClose when the submit throws', async () => {
      (updateOrder as jest.Mock).mockRejectedValue(new Error('Failure'));
      const onClose = jest.fn();

      await renderAndWaitForLoad({ isDuplicate: false, onClose });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does NOT call toast.success when the submit throws', async () => {
      (updateOrder as jest.Mock).mockRejectedValue(new Error('Failure'));

      await renderAndWaitForLoad({ isDuplicate: false });
      await navigateToStep(4);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 10. Error state when fetchOrderDetail fails
  // =========================================================================
  describe('error state when fetchOrderDetail fails', () => {
    it('shows "Error loading order data" heading when fetchOrderDetail rejects', async () => {
      (fetchOrderDetail as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      render(<ComprehensiveEditOrder order={defaultOrder} onClose={jest.fn()} />);

      await waitFor(() =>
        expect(screen.getByText('Error loading order data')).toBeInTheDocument()
      );
    });

    it('displays the specific error message from the rejected fetch', async () => {
      (fetchOrderDetail as jest.Mock).mockRejectedValue(
        new Error('Failed to fetch order detail: 404 Not Found')
      );

      render(<ComprehensiveEditOrder order={defaultOrder} onClose={jest.fn()} />);

      await waitFor(() =>
        expect(
          screen.getByText('Failed to fetch order detail: 404 Not Found')
        ).toBeInTheDocument()
      );
    });

    it('shows a Retry button when order detail loading fails', async () => {
      (fetchOrderDetail as jest.Mock).mockRejectedValue(new Error('Fetch error'));

      render(<ComprehensiveEditOrder order={defaultOrder} onClose={jest.fn()} />);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      );
    });

    it('retries the fetch when the Retry button is clicked', async () => {
      // First call fails, second call succeeds
      (fetchOrderDetail as jest.Mock)
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue(mockOrderDetail);

      render(<ComprehensiveEditOrder order={defaultOrder} onClose={jest.fn()} />);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /retry/i }));
      });

      await waitFor(() => expect(fetchOrderDetail).toHaveBeenCalledTimes(2));
    });
  });

  // =========================================================================
  // 11. error prop from parent
  // =========================================================================
  describe('error prop from parent', () => {
    it('displays the error prop string in the error section', async () => {
      render(
        <ComprehensiveEditOrder
          order={defaultOrder}
          onClose={jest.fn()}
          error="Something went wrong externally"
        />
      );

      await waitFor(() =>
        expect(
          screen.getByText('Something went wrong externally')
        ).toBeInTheDocument()
      );
    });

    it('shows "Error loading order data" heading when error prop is set', async () => {
      render(
        <ComprehensiveEditOrder
          order={defaultOrder}
          onClose={jest.fn()}
          error="External error"
        />
      );

      await waitFor(() =>
        expect(screen.getByText('Error loading order data')).toBeInTheDocument()
      );
    });
  });

  // =========================================================================
  // 12. Duplicate mode field resets
  // =========================================================================
  describe('duplicate mode data initialisation', () => {
    it('resets priceTradein and priceDeposit to 0.00 when isDuplicate is true', async () => {
      // Use non-zero tradein/deposit in fixture to prove the reset
      (fetchOrderDetail as jest.Mock).mockResolvedValue({
        ...mockOrderDetail,
        priceTradein: 999,
        priceDeposit: 888,
      });

      await renderAndWaitForLoad({ isDuplicate: true });

      // Step 1 pricing section renders number inputs; tradein and deposit must be '0.00'
      const numberInputs = screen.getAllByRole('spinbutton');
      const values = numberInputs.map((el) => (el as HTMLInputElement).value);
      expect(values).toContain('0.00');
    });

    it('sets orderStatus to "Unordered" instead of the original status', async () => {
      await renderAndWaitForLoad({ isDuplicate: true });

      // orderStatus Select is rendered on step 1 (right column sidebar)
      const selects = screen.getAllByTestId('select');
      const statusSelect = selects.find(
        (el) => el.getAttribute('data-value') === 'Unordered'
      );
      expect(statusSelect).toBeTruthy();
    });

    it('clears the orderReference in duplicate mode (not copied from fitterReference)', async () => {
      await renderAndWaitForLoad({ isDuplicate: true });

      await navigateToStep(2);

      // In duplicate mode, orderReference is set to '' — the input should be empty
      // Step 2 contains the "Your reference" input
      expect(screen.getByText('Your order reference')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 13. Step 1 content (Saddle Information)
  // =========================================================================
  describe('step 1 content', () => {
    it('renders the Saddle Specifications heading', async () => {
      await renderAndWaitForLoad();

      expect(screen.getByText('Saddle Specifications')).toBeInTheDocument();
    });

    it('renders the Pricing heading', async () => {
      await renderAndWaitForLoad();

      expect(screen.getByText('Pricing')).toBeInTheDocument();
    });

    it('pre-populates the saddle price from the order detail', async () => {
      await renderAndWaitForLoad();

      // priceSaddle from fixture: 2500
      expect(screen.getByDisplayValue('2500')).toBeInTheDocument();
    });

    it('pre-populates the special notes from the order detail', async () => {
      await renderAndWaitForLoad();

      // specialNotes from fixture: 'Test notes'
      expect(screen.getByDisplayValue('Test notes')).toBeInTheDocument();
    });

    it('renders the fitter name from the loaded edit options', async () => {
      await renderAndWaitForLoad();

      expect(screen.getByText('Expert Fitter')).toBeInTheDocument();
    });

    it('renders the leather type from the loaded edit options', async () => {
      await renderAndWaitForLoad();

      expect(screen.getByText('Italian Leather')).toBeInTheDocument();
    });

    it('renders hardcoded order status options in the sidebar', async () => {
      await renderAndWaitForLoad();

      // The orderStatus Select on step 1 uses hardcoded values
      expect(screen.getByText('Unordered')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 14. Step 2 content (Customer Information)
  // =========================================================================
  describe('step 2 content', () => {
    it('renders the "Select Customer" heading', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(2);

      expect(screen.getByText('Select Customer')).toBeInTheDocument();
    });

    it('renders the Shipping address section', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(2);

      expect(screen.getByText('Shipping address')).toBeInTheDocument();
    });

    it('pre-populates the customer search input with the loaded customer name', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(2);

      // customerSearchTerm is set to customerName on data load: 'John Doe'
      // Multiple inputs may have this value (search input + name field)
      const matches = screen.getAllByDisplayValue('John Doe');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('renders the Your order reference section', async () => {
      await renderAndWaitForLoad();

      await navigateToStep(2);

      expect(screen.getByText('Your order reference')).toBeInTheDocument();
    });

    it('populates customer search results from the paginated { data } response', async () => {
      await renderAndWaitForLoad();
      await navigateToStep(2);

      // Backend GET /api/v1/customers returns { data, total, pages } (not Hydra).
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/customers?search=')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: [{ id: 42, name: 'Jane Smith', email: 'jane@example.com' }],
                total: 1,
                pages: 1,
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEditOptions) });
      });

      const searchInput = screen.getByPlaceholderText('Type customer name or email...');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Jane' } });
      });

      // Debounced 300 ms, so wait for the result row to render.
      await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument());
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/customers?search=Jane'),
        expect.anything()
      );
    });

    it('selects a customer from the search results and fills the customer fields', async () => {
      await renderAndWaitForLoad();
      await navigateToStep(2);

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/v1/customers?search=')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: [{ id: 42, name: 'Jane Smith', email: 'jane@example.com', city: 'Austin' }],
                total: 1,
                pages: 1,
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEditOptions) });
      });

      const searchInput = screen.getByPlaceholderText('Type customer name or email...');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Jane' } });
      });
      const resultRow = await screen.findByText('Jane Smith');

      await act(async () => {
        fireEvent.click(resultRow);
      });

      // Result list collapses and the selected customer's details populate the form.
      expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Austin')).toBeInTheDocument();
      expect(screen.getAllByDisplayValue('Jane Smith').length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 15. Step 3 content (Order overview)
  // =========================================================================
  describe('step 3 content', () => {
    beforeEach(async () => {
      await renderAndWaitForLoad({ isDuplicate: false });
      await navigateToStep(3);
    });

    it('renders the "Order Information" section heading', () => {
      expect(screen.getByText('Order Information')).toBeInTheDocument();
    });

    it('renders the "Flags" section heading', () => {
      expect(screen.getByText('Flags')).toBeInTheDocument();
    });

    it('renders the "Special Notes" section heading', () => {
      expect(screen.getByText('Special Notes')).toBeInTheDocument();
    });
  });
});
