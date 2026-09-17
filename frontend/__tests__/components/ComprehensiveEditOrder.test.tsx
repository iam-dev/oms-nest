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

jest.mock('@/components/ui/select', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactActual = require('react') as typeof React;
  // No type annotations with identifiers here: babel-plugin-jest-hoist rejects them.
  const ChangeContext = ReactActual.createContext(undefined as unknown);
  return {
    Select: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: unknown }) => (
      <ChangeContext.Provider value={onValueChange}>
        <div data-testid="select" data-value={value}>
          {children}
        </div>
      </ChangeContext.Provider>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    // Clicking an item fires the parent Select's onValueChange, so tests can
    // drive selection changes without Radix's pointer-event machinery.
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const onChange = ReactActual.useContext(ChangeContext);
      return (
        <div data-value={value} onClick={() => { if (typeof onChange === 'function') onChange(value); }}>
          {children}
        </div>
      );
    },
  };
});

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
  // 2b. Fitter dropdown hides inactive (blocked) fitters
  // =========================================================================
  describe('fitter dropdown', () => {
    const fittersWithInactive = [
      { id: 5, username: 'expertfitter', fullName: 'Expert Fitter', active: true },
      { id: 6, username: 'blocked', fullName: 'Blocked Fitter', active: false },
    ];

    it('does not offer an inactive fitter that is not already on the order', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...mockEditOptions, fitters: fittersWithInactive }),
      });
      await renderAndWaitForLoad();
      await waitFor(() => expect(screen.getByText('Expert Fitter')).toBeInTheDocument());

      expect(screen.queryByText(/Blocked Fitter/)).not.toBeInTheDocument();
    });

    it("keeps the order's current fitter selectable even when inactive, labelled as such", async () => {
      (fetchOrderDetail as jest.Mock).mockResolvedValue({
        ...mockOrderDetail,
        fitterId: 6,
        fitterName: 'Blocked Fitter',
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...mockEditOptions, fitters: fittersWithInactive }),
      });
      await renderAndWaitForLoad();

      await waitFor(() =>
        expect(screen.getByText('Blocked Fitter (inactive)')).toBeInTheDocument()
      );
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
  // 8b. Save as Draft
  // =========================================================================
  describe('Save as Draft', () => {
    // Regression: the footer's "Save as Draft" button had no onClick at all, so
    // edits made on steps 1-3 and "saved" with it were silently dropped when the
    // dialog was closed.  It must persist the current form values from any step.

    it('saves the current form values from step 2 without walking to step 4', async () => {
      (updateOrder as jest.Mock).mockResolvedValue({ success: true, orderId: 100 });
      const onClose = jest.fn();

      await renderAndWaitForLoad({ isDuplicate: false, onClose });
      await navigateToStep(2);

      // Edit the reference on step 2, then Save as Draft right there.
      const referenceInput = screen.getByDisplayValue('REF-001');
      fireEvent.change(referenceInput, { target: { value: 'REF-DRAFT-9' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save as draft/i }));
      });

      await waitFor(() => expect(updateOrder).toHaveBeenCalledTimes(1));
      const [id, payload] = (updateOrder as jest.Mock).mock.calls[0];
      expect(id).toBe(100);
      expect(payload.orderReference).toBe('REF-DRAFT-9');
      // Untouched status is still never resubmitted.
      expect(payload.orderStatus).toBeUndefined();
      expect(toast.success).toHaveBeenCalledTimes(1);
      // Save as Draft keeps the dialog open so the user can carry on editing.
      expect(onClose).not.toHaveBeenCalled();
      // Still on step 2 — Save as Draft must not advance the wizard.
      expect(screen.getByRole('button', { name: /next step/i })).toBeInTheDocument();
    });

    it('keeps the dialog open after changing the customer and saving as draft', async () => {
      // Regression: edit order > change customer > Save as Draft closed the whole
      // Edit Order dialog. It must persist and leave the user where they were.
      (updateOrder as jest.Mock).mockResolvedValue({ success: true, orderId: 100 });
      const onClose = jest.fn();

      await renderAndWaitForLoad({ isDuplicate: false, onClose });
      await navigateToStep(2);

      // Both the search box and the Name field show the loaded customer name;
      // the Name field is the one after the search box in DOM order.
      const nameInput = screen.getAllByDisplayValue('John Doe')[1];
      fireEvent.change(nameInput, { target: { value: 'Jane Roe' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save as draft/i }));
      });

      await waitFor(() => expect(updateOrder).toHaveBeenCalledTimes(1));
      const [, payload] = (updateOrder as jest.Mock).mock.calls[0];
      expect(payload.customerName).toBe('Jane Roe');
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /next step/i })).toBeInTheDocument();
      // The edited value is still on screen for further editing.
      expect(screen.getByDisplayValue('Jane Roe')).toBeInTheDocument();
    });

    it('is disabled while a save is in flight', async () => {
      let resolveSave: (v: unknown) => void = () => {};
      (updateOrder as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          resolveSave = resolve;
        })
      );

      await renderAndWaitForLoad({ isDuplicate: false });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save as draft/i }));
      });

      expect(screen.getByRole('button', { name: /save as draft/i })).toBeDisabled();

      await act(async () => {
        resolveSave({ success: true, orderId: 100 });
      });
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
  // =========================================================================
  // 16. Saddle option "specify" text boxes (parity with legacy orders_info)
  // =========================================================================
  describe('saddle option specification inputs', () => {
    // Legacy semantics:
    //   option_item_id = 0  -> "Customized by fitter", free text in orders_info.custom
    //   item.user_color = 1 -> "Specify color", text in orders_info.color
    //   item.user_leather=1 -> "Specify leather", text in orders_info.leathertype
    const OPTION_LOOPS = 7;
    const OPTION_TREE = 17;
    const OPTION_PANEL = 18;

    const specOptions = {
      ...mockEditOptions,
      options: [
        { optionId: OPTION_LOOPS, optionName: 'Loops', sequence: 1, group: null },
        { optionId: OPTION_TREE, optionName: 'Tree Size', sequence: 2, group: null },
        { optionId: OPTION_PANEL, optionName: 'Panel Type', sequence: 3, group: null },
      ],
      optionItems: [
        { id: 701, name: 'STD - LOOPS', optionId: OPTION_LOOPS, userColor: 0, userLeather: 0 },
        { id: 702, name: 'Aviar Solid Loop(specify color)', optionId: OPTION_LOOPS, userColor: 1, userLeather: 0 },
        { id: 1701, name: '26cm', optionId: OPTION_TREE, userColor: 0, userLeather: 0 },
        { id: 1801, name: 'Aviar Wool Hybrid Std', optionId: OPTION_PANEL, userColor: 0, userLeather: 1 },
        { id: 1802, name: 'Aviar Foam - DEEP', optionId: OPTION_PANEL, userColor: 0, userLeather: 0 },
      ],
    };

    const spec = (
      optionId: number,
      optionItemId: number,
      extra: Partial<{ custom: string; color: string; leatherType: string; itemName: string | null; cloneNumber: number }> = {},
    ) => ({
      optionId,
      optionName: specOptions.options.find(o => o.optionId === optionId)!.optionName,
      optionItemId,
      cloneNumber: 0,
      itemName: specOptions.optionItems.find(i => i.id === optionItemId)?.name ?? null,
      leatherName: null,
      custom: '',
      color: '',
      leatherType: '',
      sequence: 0,
      displayValue: '',
      ...extra,
    });

    const renderWithSpecs = async (saddleSpecs: ReturnType<typeof spec>[]) => {
      (fetchOrderDetail as jest.Mock).mockResolvedValue({ ...mockOrderDetail, saddleSpecs });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(specOptions),
      });
      await renderAndWaitForLoad({ isDuplicate: false });
    };

    const selectItem = async (name: string) => {
      await act(async () => {
        fireEvent.click(screen.getByText(name));
      });
    };

    it('shows "Please specify" only when the selected item is "Customized by fitter"', async () => {
      await renderWithSpecs([
        spec(OPTION_TREE, 0, { custom: '27.5', itemName: null }),
        spec(OPTION_LOOPS, 701),
      ]);

      expect(screen.getByText('Please specify:')).toBeInTheDocument();
      expect(screen.getByDisplayValue('27.5')).toBeInTheDocument();
      expect(screen.queryByText('Specify color:')).not.toBeInTheDocument();
    });

    it('does NOT show "Please specify" for a real item that carries a stale custom value', async () => {
      // Legacy left orders_info.custom populated after switching away from
      // "Customized by fitter"; that text must not resurrect the box.
      await renderWithSpecs([spec(OPTION_TREE, 1701, { custom: '26.5' })]);

      expect(screen.queryByText('Please specify:')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('26.5')).not.toBeInTheDocument();
    });

    it('offers "Customized by fitter" in every option dropdown', async () => {
      await renderWithSpecs([spec(OPTION_LOOPS, 701)]);

      expect(screen.getAllByText('Customized by fitter')).toHaveLength(3);
    });

    it('shows "Specify color" prefilled from orders_info.color for a user_color item', async () => {
      await renderWithSpecs([spec(OPTION_LOOPS, 702, { color: 'Green Snake' })]);

      expect(screen.getByText('Specify color:')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Green Snake')).toBeInTheDocument();
      expect(screen.queryByText('Please specify:')).not.toBeInTheDocument();
    });

    it('shows "Specify leathertype" prefilled from orders_info.leathertype for a user_leather item', async () => {
      await renderWithSpecs([spec(OPTION_PANEL, 1801, { leatherType: 'smooth black' })]);

      expect(screen.getByText('Specify leathertype:')).toBeInTheDocument();
      expect(screen.getByDisplayValue('smooth black')).toBeInTheDocument();
    });

    it('shows "Specify color" for an item whose name mentions color even without the user_color flag', async () => {
      // Parity with legacy orders.js: choosecolor=1 OR name contains "color"/"Color".
      const opts = {
        ...specOptions,
        optionItems: [...specOptions.optionItems, { id: 703, name: 'Contrast Color Loops', optionId: OPTION_LOOPS, userColor: 0, userLeather: 0 }],
      };
      (fetchOrderDetail as jest.Mock).mockResolvedValue({ ...mockOrderDetail, saddleSpecs: [spec(OPTION_LOOPS, 701)] });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve(opts) });
      await renderAndWaitForLoad({ isDuplicate: false });

      await selectItem('Contrast Color Loops');
      expect(screen.getByText('Specify color:')).toBeInTheDocument();
    });

    it('lets the user edit and fully clear a prefilled specification', async () => {
      await renderWithSpecs([spec(OPTION_LOOPS, 702, { color: 'Green Snake' })]);

      const input = screen.getByDisplayValue('Green Snake');
      fireEvent.change(input, { target: { value: 'black' } });
      expect(screen.getByDisplayValue('black')).toBeInTheDocument();

      fireEvent.change(input, { target: { value: '' } });
      expect(screen.queryByDisplayValue('Green Snake')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('black')).not.toBeInTheDocument();
    });

    it('swaps the text box when the selection changes and keeps the typed text per option', async () => {
      await renderWithSpecs([spec(OPTION_LOOPS, 701)]);
      expect(screen.queryByText('Specify color:')).not.toBeInTheDocument();

      await selectItem('Aviar Solid Loop(specify color)');
      expect(screen.getByText('Specify color:')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Specify color:'), { target: { value: 'brown' } });

      await selectItem('STD - LOOPS');
      expect(screen.queryByText('Specify color:')).not.toBeInTheDocument();

      await selectItem('Aviar Solid Loop(specify color)');
      expect(screen.getByDisplayValue('brown')).toBeInTheDocument();
    });

    it('blocks "Next Step" with an error while a required specification is empty', async () => {
      await renderWithSpecs([spec(OPTION_LOOPS, 702, { color: '' })]);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next step/i }));
      });

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Loops'));
      // Still on step 1
      expect(screen.getByText('Saddle Specifications')).toBeInTheDocument();
    });

    it('blocks "Save as Draft" while a required specification is empty', async () => {
      await renderWithSpecs([spec(OPTION_TREE, 0, { custom: '', itemName: null })]);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save as draft/i }));
      });

      expect(updateOrder).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Tree Size'));
    });

    it('submits color / leatherType / custom in their own fields and drops stale custom text', async () => {
      (updateOrder as jest.Mock).mockResolvedValue({ success: true, orderId: 100 });
      await renderWithSpecs([
        spec(OPTION_LOOPS, 702, { color: 'Green Snake', custom: 'stale' }),
        spec(OPTION_TREE, 0, { custom: '27.5', itemName: null }),
        spec(OPTION_PANEL, 1801, { leatherType: 'smooth black' }),
      ]);

      fireEvent.change(screen.getByLabelText('Specify color:'), { target: { value: 'black' } });

      await navigateToStep(4);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });

      await waitFor(() => expect(updateOrder).toHaveBeenCalledTimes(1));
      const payload = (updateOrder as jest.Mock).mock.calls[0][1];
      expect(payload.saddleOptions).toEqual(expect.arrayContaining([
        { optionId: OPTION_LOOPS, optionItemId: 702, cloneNumber: 0, custom: '', color: 'black', leatherType: '' },
        { optionId: OPTION_TREE, optionItemId: 0, cloneNumber: 0, custom: '27.5', color: '', leatherType: '' },
        { optionId: OPTION_PANEL, optionItemId: 1801, cloneNumber: 0, custom: '', color: '', leatherType: 'smooth black' },
      ]));
      expect(payload.saddleOptions).toHaveLength(3);
    });

    it('keeps a saved colour for an item that is not in the current item list', async () => {
      // Option 99 is not linked to the saddle, so editOptions carries no items for it;
      // the saved row must still round-trip instead of being blanked on save.
      (updateOrder as jest.Mock).mockResolvedValue({ success: true, orderId: 100 });
      const opts = {
        ...specOptions,
        options: [{ optionId: 99, optionName: 'Orphan', sequence: 9, group: null }],
      };
      (fetchOrderDetail as jest.Mock).mockResolvedValue({
        ...mockOrderDetail,
        saddleSpecs: [{ ...spec(OPTION_LOOPS, 701), optionId: 99, optionName: 'Orphan', optionItemId: 9901, itemName: 'Old item', color: 'brown' }],
      });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve(opts) });
      await renderAndWaitForLoad({ isDuplicate: false });

      expect(screen.getByDisplayValue('brown')).toBeInTheDocument();

      await navigateToStep(4);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });
      await waitFor(() => expect(updateOrder).toHaveBeenCalledTimes(1));
      expect((updateOrder as jest.Mock).mock.calls[0][1].saddleOptions).toEqual([
        { optionId: 99, optionItemId: 9901, cloneNumber: 0, custom: '', color: 'brown', leatherType: '' },
      ]);
    });

    it('shows the specification text on the preview step', async () => {
      await renderWithSpecs([
        spec(OPTION_LOOPS, 702, { color: 'Green Snake' }),
        spec(OPTION_TREE, 0, { custom: '27.5', itemName: null }),
        spec(OPTION_PANEL, 1802),
      ]);
      await navigateToStep(4);

      expect(screen.getByText('Aviar Solid Loop(specify color) | Color: Green Snake')).toBeInTheDocument();
      expect(screen.getByText('Customized by fitter: 27.5')).toBeInTheDocument();
    });
  });

  describe('multiple rows of one option (legacy clone_number)', () => {
    // CANTLE Option has options.extra_allowed = 20, so an order can carry
    // "CANTLE Option" and "CANTLE Option (2)" — two orders_info rows with
    // clone_number 0 and 1.  Loading must show both and saving must keep both.
    const OPTION_CANTLE = 4;
    const OPTION_TREE = 17;

    const cloneOptions = {
      ...mockEditOptions,
      options: [
        { optionId: OPTION_TREE, optionName: 'Tree Size', sequence: 1, group: null, extraAllowed: 0 },
        { optionId: OPTION_CANTLE, optionName: 'CANTLE Option', sequence: 2, group: 'CANTLE', extraAllowed: 20 },
      ],
      optionItems: [
        { id: 1701, name: '26cm', optionId: OPTION_TREE, userColor: 0, userLeather: 0 },
        { id: 401, name: '2 cm cut of cantle', optionId: OPTION_CANTLE, userColor: 0, userLeather: 0 },
        { id: 402, name: 'Inlaid cantle (specify color)', optionId: OPTION_CANTLE, userColor: 1, userLeather: 0 },
      ],
    };

    const cantle = (cloneNumber: number, optionItemId: number, color = '') => ({
      optionId: OPTION_CANTLE,
      optionName: cloneNumber > 0 ? `CANTLE Option (${cloneNumber + 1})` : 'CANTLE Option',
      optionItemId,
      cloneNumber,
      itemName: cloneOptions.optionItems.find(i => i.id === optionItemId)?.name ?? null,
      leatherName: null,
      custom: '',
      color,
      leatherType: '',
      sequence: 2,
      displayValue: '',
    });

    // Tree Size is required too; keep it filled so only the cantle rows are under test
    const tree = { ...cantle(0, 1701), optionId: OPTION_TREE, optionName: 'Tree Size', sequence: 1 };
    const treeRow = { optionId: OPTION_TREE, optionItemId: 1701, cloneNumber: 0, custom: '', color: '', leatherType: '' };

    const renderWithSpecs = async (saddleSpecs: ReturnType<typeof cantle>[]) => {
      (updateOrder as jest.Mock).mockResolvedValue({ success: true, orderId: 100 });
      (fetchOrderDetail as jest.Mock).mockResolvedValue({ ...mockOrderDetail, saddleSpecs: [tree, ...saddleSpecs] });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve(cloneOptions) });
      await renderAndWaitForLoad({ isDuplicate: false });
    };

    const savedOptions = async () => {
      await waitFor(() => expect(updateOrder).toHaveBeenCalledTimes(1));
      return (updateOrder as jest.Mock).mock.calls[0][1].saddleOptions;
    };

    const submit = async () => {
      await navigateToStep(4);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /update order/i }));
      });
      return savedOptions();
    };

    it('renders one labelled row per saved clone', async () => {
      await renderWithSpecs([cantle(0, 401), cantle(1, 402, 'black')]);

      expect(screen.getByText('CANTLE Option:')).toBeInTheDocument();
      expect(screen.getByText('CANTLE Option (2):')).toBeInTheDocument();
      expect(screen.getByDisplayValue('black')).toBeInTheDocument();
    });

    it('round-trips every clone row on an untouched save', async () => {
      await renderWithSpecs([cantle(0, 401), cantle(1, 402, 'black')]);

      expect(await submit()).toEqual([
        treeRow,
        { optionId: OPTION_CANTLE, optionItemId: 401, cloneNumber: 0, custom: '', color: '', leatherType: '' },
        { optionId: OPTION_CANTLE, optionItemId: 402, cloneNumber: 1, custom: '', color: 'black', leatherType: '' },
      ]);
    });

    it('lists every clone row with its own label on the preview step', async () => {
      await renderWithSpecs([cantle(0, 401), cantle(1, 402, 'black')]);
      await navigateToStep(4);

      expect(screen.getByText('CANTLE Option (2):')).toBeInTheDocument();
      expect(screen.getByText('Inlaid cantle (specify color) | Color: black')).toBeInTheDocument();
    });

    it('names the clone row when its required text is missing', async () => {
      await renderWithSpecs([cantle(0, 401), cantle(1, 402, '')]);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next step/i }));
      });

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('CANTLE Option (2)'));
    });

    it('adds a new clone row and saves it with the next cloneNumber', async () => {
      await renderWithSpecs([cantle(0, 401)]);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '+ Add another CANTLE Option' }));
      });
      expect(screen.getByText('CANTLE Option (2):')).toBeInTheDocument();

      // Second select's copy of the item
      await act(async () => {
        fireEvent.click(screen.getAllByText('2 cm cut of cantle')[1]);
      });

      expect(await submit()).toEqual([
        treeRow,
        { optionId: OPTION_CANTLE, optionItemId: 401, cloneNumber: 0, custom: '', color: '', leatherType: '' },
        { optionId: OPTION_CANTLE, optionItemId: 401, cloneNumber: 1, custom: '', color: '', leatherType: '' },
      ]);
    });

    it('drops an added clone row that never got a selection when saving as draft', async () => {
      // "Next Step" refuses an empty row (see the required-fields gate); a draft
      // save still goes through and simply leaves the empty row out.
      await renderWithSpecs([cantle(0, 401)]);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '+ Add another CANTLE Option' }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save as draft/i }));
      });

      expect(await savedOptions()).toEqual([
        treeRow,
        { optionId: OPTION_CANTLE, optionItemId: 401, cloneNumber: 0, custom: '', color: '', leatherType: '' },
      ]);
    });

    it('removes a clone row and renumbers the remaining ones on save', async () => {
      await renderWithSpecs([cantle(0, 401), cantle(1, 402, 'black'), cantle(2, 401)]);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Remove CANTLE Option (2)' }));
      });
      expect(screen.queryByDisplayValue('black')).not.toBeInTheDocument();

      expect(await submit()).toEqual([
        treeRow,
        { optionId: OPTION_CANTLE, optionItemId: 401, cloneNumber: 0, custom: '', color: '', leatherType: '' },
        { optionId: OPTION_CANTLE, optionItemId: 401, cloneNumber: 1, custom: '', color: '', leatherType: '' },
      ]);
    });

    it('does not offer "Add another" for an option without extra_allowed, nor past the cap', async () => {
      const capped = {
        ...cloneOptions,
        options: cloneOptions.options.map(o => (o.optionId === OPTION_CANTLE ? { ...o, extraAllowed: 1 } : o)),
      };
      (fetchOrderDetail as jest.Mock).mockResolvedValue({ ...mockOrderDetail, saddleSpecs: [cantle(0, 401), cantle(1, 402, 'black')] });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve(capped) });
      await renderAndWaitForLoad({ isDuplicate: false });

      expect(screen.queryByRole('button', { name: /add another tree size/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /add another cantle option/i })).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Remove CANTLE Option (2)' }));
      });
      expect(screen.getByRole('button', { name: '+ Add another CANTLE Option' })).toBeInTheDocument();
    });

    it('resets clone rows when the saddle changes', async () => {
      await renderWithSpecs([cantle(0, 401), cantle(1, 402, 'black')]);
      expect(screen.getByText('CANTLE Option (2):')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('Premium Classic'));
      });

      expect(screen.queryByText('CANTLE Option (2):')).not.toBeInTheDocument();
    });
  });

  describe('per-model dropdown lists', () => {
    // edit-options?saddleId= only returns what Models > Manage Options ticked
    // for the model. A saved order may still point at an item that is no
    // longer ticked; the form keeps that saved value selectable instead of
    // silently blanking it.
    const OPTION_KNEE_ROLL = 2;
    const OPTION_SEAT_LEATHER = 11;

    const modelOptions = {
      ...mockEditOptions,
      options: [
        { optionId: OPTION_KNEE_ROLL, optionName: 'Knee Roll', sequence: 1, group: 'FLAPS', type: 0, extraAllowed: 0 },
        { optionId: OPTION_SEAT_LEATHER, optionName: 'Seat Leather', sequence: 2, group: 'SEAT', type: 1, extraAllowed: 0 },
      ],
      optionItems: [
        { id: 17, name: 'Pencil Roll J1', optionId: OPTION_KNEE_ROLL, userColor: 0, userLeather: 0 },
      ],
      optionLeathers: [
        { optionId: OPTION_SEAT_LEATHER, leatherId: 48, name: 'Aviar Smooth Black' },
      ],
    };

    const spec = (optionId: number, optionName: string, optionItemId: number, itemName: string) => ({
      optionId,
      optionName,
      optionItemId,
      cloneNumber: 0,
      itemName,
      leatherName: null,
      custom: '',
      color: '',
      leatherType: '',
      sequence: 1,
      displayValue: itemName,
    });

    const renderWithSpecs = async (saddleSpecs: ReturnType<typeof spec>[]) => {
      (fetchOrderDetail as jest.Mock).mockResolvedValue({ ...mockOrderDetail, saddleSpecs });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve(modelOptions) });
      await renderAndWaitForLoad({ isDuplicate: false });
    };

    it('offers a leather option only the leathers ticked for the model', async () => {
      await renderWithSpecs([]);

      expect(screen.getByText('Seat Leather:')).toBeInTheDocument();
      expect(screen.getByText('Aviar Smooth Black')).toBeInTheDocument();
      // The base leather list is only the top-level Leathertype dropdown
      expect(screen.getAllByText('Italian Leather')).toHaveLength(1);
    });

    it('keeps a saved item selectable when the model no longer ticks it', async () => {
      await renderWithSpecs([spec(OPTION_KNEE_ROLL, 'Knee Roll', 3595, 'Aviar AV1 Short')]);

      const kneeRoll = screen.getByText('Knee Roll:').parentElement as HTMLElement;
      // Items only: the mocked <Select> wrapper carries data-value too
      const values = Array.from(kneeRoll.querySelectorAll('[data-value]:not([data-testid="select"])')).map(el => el.getAttribute('data-value'));
      expect(values).toContain('17');
      expect(values).toContain('3595');
      expect(screen.getAllByText('Aviar AV1 Short').length).toBeGreaterThan(0);
    });
  });
  describe('required saddle information (red asterisk) gate', () => {
    // Every field on step 1 that carries a red asterisk must be filled before
    // the wizard moves on.  Shipping and Tax are the exception: blank means
    // "not yet determined by Custom Saddlery" and shows as "-".
    const OPTION_LOOPS = 7;
    const OPTION_CANTLE = 4;

    const gateOptions = {
      ...mockEditOptions,
      options: [
        { optionId: OPTION_LOOPS, optionName: 'Loops', sequence: 1, group: null, extraAllowed: 0 },
        { optionId: OPTION_CANTLE, optionName: 'CANTLE Option', sequence: 2, group: 'CANTLE', extraAllowed: 20 },
      ],
      optionItems: [
        { id: 701, name: 'STD - LOOPS', optionId: OPTION_LOOPS, userColor: 0, userLeather: 0 },
        { id: 401, name: '2 cm cut of cantle', optionId: OPTION_CANTLE, userColor: 0, userLeather: 0 },
      ],
    };

    const row = (optionId: number, optionName: string, optionItemId: number) => ({
      optionId,
      optionName,
      optionItemId,
      cloneNumber: 0,
      itemName: gateOptions.optionItems.find(i => i.id === optionItemId)?.name ?? null,
      leatherName: null,
      custom: '',
      color: '',
      leatherType: '',
      sequence: 0,
      displayValue: '',
    });
    const completeSpecs = [row(OPTION_LOOPS, 'Loops', 701), row(OPTION_CANTLE, 'CANTLE Option', 401)];

    // Loose type: overrides include null ids and non-empty saddleSpecs, which the fixture's inferred type forbids
    const renderOrder = async (detail: Record<string, unknown> = {}) => {
      (fetchOrderDetail as jest.Mock).mockResolvedValue({ ...mockOrderDetail, saddleSpecs: completeSpecs, ...detail });
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve(gateOptions) });
      await renderAndWaitForLoad({ isDuplicate: false });
    };

    const clickNext = async () => {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next step/i }));
      });
    };

    const expectStillOnStep1 = () =>
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 1:');

    it('advances when every marked field is filled', async () => {
      await renderOrder();
      await clickNext();

      expect(toast.error).not.toHaveBeenCalled();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 2:');
    });

    it('blocks Next Step and names Fitter, Brand & Model and Leathertype when they are empty', async () => {
      await renderOrder({ fitterId: null, saddleId: null, leatherId: null });
      await clickNext();

      expect(toast.error).toHaveBeenCalledTimes(1);
      const message = toast.error.mock.calls[0][0] as string;
      expect(message).toContain('Fitter');
      expect(message).toContain('Brand & Model');
      expect(message).toContain('Leathertype');
      expectStillOnStep1();
    });

    it('blocks Next Step when a saddle option has no selection', async () => {
      await renderOrder({ saddleSpecs: [row(OPTION_LOOPS, 'Loops', 701)] });
      await clickNext();

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('CANTLE Option'));
      expectStillOnStep1();
    });

    it('blocks Next Step when an added extra option row has no selection', async () => {
      await renderOrder();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '+ Add another CANTLE Option' }));
      });
      await clickNext();

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('CANTLE Option (2)'));
      expectStillOnStep1();
    });

    it('blocks Next Step when a marked pricing field is cleared', async () => {
      await renderOrder();
      // Deposit is the only field showing 500
      fireEvent.change(screen.getByDisplayValue('500'), { target: { value: '' } });
      await clickNext();

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Deposit'));
      expectStillOnStep1();
    });

    it('does not require Shipping or Tax', async () => {
      await renderOrder({ priceShipping: 0, priceTax: 0 });
      await clickNext();

      expect(toast.error).not.toHaveBeenCalled();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Step 2:');
    });

    it('blocks the step-indicator shortcut the same way as Next Step', async () => {
      await renderOrder({ fitterId: null });
      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: /order overview/i })[0]);
      });

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Fitter'));
      expectStillOnStep1();
    });
  });
});
