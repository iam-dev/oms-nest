import React from 'react';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
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
  Checkbox: ({ onCheckedChange, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { onCheckedChange?: (checked: boolean) => void }) => (
    <input type="checkbox" {...props} onChange={(e) => onCheckedChange?.(e.target.checked)} />
  ),
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
// Helper: Fitter and Brand & Model are always required on Step 1 (legacy
// parity validation, 2026-09-17). Most pre-existing tests don't care about
// product selection at all, so this minimal fixture — installed as the
// default `global.fetch` mock for `fetchEditOptions` — and `completeStep1()`
// let them satisfy the gate and reach later steps without each test building
// out a full options fixture. Describes that need real product data (option
// rows, presets, leathers, …) override `global.fetch` in their own
// `beforeEach`, which runs after this one.
// ---------------------------------------------------------------------------

const minimalStep1Options = {
  fitters: [{ id: 1, username: 'testfitter', fullName: 'Test Fitter', active: true }],
  saddles: [{ id: 1, brand: 'Test', modelName: 'Model', displayName: 'Test Model' }],
  leatherTypes: [],
  options: [],
  optionItems: [],
  optionLeathers: [],
  presets: [],
  presetItems: [],
  statuses: [],
};

function mockMinimalStep1Options() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(minimalStep1Options),
  }) as unknown as typeof fetch;
}

async function completeStep1() {
  await waitFor(() => expect(screen.getByText('Test Fitter')).toBeInTheDocument());
  await act(async () => { fireEvent.click(screen.getByText('Test Fitter')); });
  await act(async () => { fireEvent.click(screen.getByText('Test Model')); });
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
    mockMinimalStep1Options();
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

      await completeStep1();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next step/i }));
      });

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        'Step 2: Customer & Shipping'
      );
    });

    it('advances to step 3 when Next Step is clicked twice', async () => {
      await renderAndWaitForLoad();

      await completeStep1();

      await navigateToStep(3);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        'Step 3: Order Settings'
      );
    });

    it('goes back from step 2 to step 1 when Previous Step is clicked', async () => {
      await renderAndWaitForLoad();

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

      await navigateToStep(2);

      expect(
        screen.getByRole('button', { name: /next step/i })
      ).toBeInTheDocument();
    });

    it('shows "Update Order" on the primary button at step 3 in edit mode', async () => {
      await renderAndWaitForLoad({ isDuplicate: false });

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

      await navigateToStep(3);

      expect(
        screen.getByRole('button', { name: /update order/i })
      ).toBeInTheDocument();
    });

    it('jumps to step 2 when the Customer & Shipping step indicator is clicked', async () => {
      await renderAndWaitForLoad();

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

    it('blocks Next Step and never calls createOrderFromPayload when no fitter is selected', async () => {
      // Fitter is a red-asterisk Step-1 field (legacy parity validation, Task 13) —
      // reaching Step 3 without one is no longer possible, so payload.fitterId can
      // never be sent unset. Assert the stronger, still-true contract: no fitter
      // means the submission never happens at all.
      const { toast } = jest.requireMock('sonner') as { toast: { error: jest.Mock } };
      renderNewOrder();
      await waitFor(() => expect(screen.getByText('Test Model')).toBeInTheDocument());
      await act(async () => { fireEvent.click(screen.getByText('Test Model')); });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /next step/i }));
      });

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Fitter'));
      expect(createOrderFromPayload).not.toHaveBeenCalled();
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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

        // Saddle price defaults to 0.00 until a Leathertype is chosen (Task 13).
        expect(screen.getByLabelText('Saddle price:')).toHaveValue(0);
      });

      it('renders the Fitter label on step 1', async () => {
        await renderAndWaitForLoad();

        expect(screen.getByText(/^Fitter:/)).toBeInTheDocument();
      });
    });

    describe('step 2 — Customer & Shipping', () => {
      it('renders the Customer heading', async () => {
        await renderAndWaitForLoad();

        await completeStep1();

        await navigateToStep(2);

        expect(screen.getByText('Customer')).toBeInTheDocument();
      });

      it('renders the Fitter heading', async () => {
        await renderAndWaitForLoad();

        await completeStep1();

        await navigateToStep(2);

        expect(screen.getByText('Fitter')).toBeInTheDocument();
      });

      it('renders the Shipping Address section', async () => {
        await renderAndWaitForLoad();

        await completeStep1();

        await navigateToStep(2);

        expect(screen.getByText('Shipping Address')).toBeInTheDocument();
      });

      it('renders the Search Customer label', async () => {
        await renderAndWaitForLoad();

        await completeStep1();

        await navigateToStep(2);

        expect(screen.getByText('Search Customer')).toBeInTheDocument();
      });

      it('renders the Search Fitter label', async () => {
        await renderAndWaitForLoad();

        await completeStep1();

        await navigateToStep(2);

        expect(screen.getByText('Search Fitter')).toBeInTheDocument();
      });
    });

    describe('step 3 — Order Settings', () => {
      beforeEach(async () => {
        await renderAndWaitForLoad({ isDuplicate: false });
        await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

      await navigateToStep(3);

      const selects = screen.getAllByTestId('select');
      const statusSelect = selects.find(
        (el) => el.getAttribute('data-value') === 'DRAFT'
      );
      expect(statusSelect).toBeTruthy();
    });

    it('initialises isUrgent as false — payload rushed is false', async () => {
      renderNewOrder();

      await completeStep1();

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

      await completeStep1();

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

      await completeStep1();

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
      await completeStep1();

      await navigateToStep(3);

      expect(
        screen.getByRole('button', { name: /create order/i })
      ).toBeInTheDocument();
    });
  });

  describe('multiple rows of one option (legacy clone_number)', () => {
    const OPTION_CANTLE = 4;
    const editOptions = {
      fitters: [{ id: 1, username: 'multirowfitter', fullName: 'Multi Row Fitter', active: true }],
      saddles: [{ id: 10, brand: 'Premium', modelName: 'Classic', displayName: 'Premium Classic' }],
      leatherTypes: [{ id: 3, name: 'Italian Leather', price1: 0 }],
      presets: [{ id: 1, name: 'Aviar preset' }],
      presetItems: [{ presetId: 1, optionId: OPTION_CANTLE, itemId: 401 }],
      options: [
        { optionId: OPTION_CANTLE, optionName: 'CANTLE Option', sequence: 1, group: 'CANTLE', type: 0, price1: 0, extraAllowed: 20 },
      ],
      optionItems: [
        { id: 401, name: '2 cm cut of cantle', optionId: OPTION_CANTLE, price1: 0 },
        { id: 402, name: 'Inlaid cantle', optionId: OPTION_CANTLE, price1: 0 },
      ],
      statuses: [],
    };
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(editOptions) });
      (createOrderFromPayload as jest.Mock).mockResolvedValue({ success: true, orderId: 1 });
    });
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('adds a second CANTLE Option row and sends it with cloneNumber 1', async () => {
      renderNewOrder();
      await waitFor(() => expect(screen.getByText('Premium Classic')).toBeInTheDocument());

      // Fitter and Brand & Model first — picking the model resets preset/option
      // selections, so it must happen before the preset and CANTLE Option picks below.
      await act(async () => { fireEvent.click(screen.getByText('Multi Row Fitter')); });
      await act(async () => { fireEvent.click(screen.getByText('Premium Classic')); });
      await waitFor(() => expect(screen.getByText('Aviar preset')).toBeInTheDocument());

      // Options only render once a preset is chosen; the preset picks item 401 for slot 0
      await act(async () => {
        fireEvent.click(screen.getByText('Aviar preset'));
      });
      expect(screen.getByText('CANTLE Option:')).toBeInTheDocument();

      // Leathertype — required once a preset is selected (Task 13 validation).
      await act(async () => { fireEvent.click(screen.getByText('Italian Leather')); });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '+ Add another CANTLE Option' }));
      });
      expect(screen.getByText('CANTLE Option (2):')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getAllByText('Inlaid cantle')[1]);
      });

      await navigateToStep(3);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create order/i }));
      });
      await waitFor(() => expect(createOrderFromPayload).toHaveBeenCalledTimes(1));

      const payload = (createOrderFromPayload as jest.Mock).mock.calls[0][0];
      expect(payload.saddleOptions).toEqual([
        { optionId: OPTION_CANTLE, optionItemId: 401, cloneNumber: 0, custom: '', color: '', leatherType: '' },
        { optionId: OPTION_CANTLE, optionItemId: 402, cloneNumber: 1, custom: '', color: '', leatherType: '' },
      ]);
    });

    it('removes an added row again', async () => {
      renderNewOrder();
      await waitFor(() => expect(screen.getByText('Aviar preset')).toBeInTheDocument());
      await act(async () => {
        fireEvent.click(screen.getByText('Aviar preset'));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '+ Add another CANTLE Option' }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Remove CANTLE Option (2)' }));
      });

      expect(screen.queryByText('CANTLE Option (2):')).not.toBeInTheDocument();
    });
  });

  describe('per-model dropdown lists', () => {
    // edit-options?saddleId= returns only what Models > Manage Options ticked
    // for the model: optionItems for custom options, optionLeathers for leather
    // options (type 1), leatherTypes for the base leather. The form must read
    // leather options from optionLeathers, not the base leather list.
    const OPTION_SEAT_LEATHER = 11;
    const OPTION_AVIAR_KNEE_ROLL_LEATHER = 48;
    const editOptions = {
      fitters: [],
      saddles: [{ id: 100, brand: 'Aviar', modelName: 'Ace Jump', displayName: 'Aviar Ace Jump' }],
      leatherTypes: [{ id: 3, name: 'Italian Leather', price1: 0 }],
      presets: [{ id: 1, name: 'Aviar preset' }],
      presetItems: [],
      options: [
        { optionId: OPTION_SEAT_LEATHER, optionName: 'Seat Leather', sequence: 1, group: 'SEAT', type: 1, price1: 0, extraAllowed: 0 },
        { optionId: OPTION_AVIAR_KNEE_ROLL_LEATHER, optionName: 'AVIAR Knee Roll Leather', sequence: 2, group: null, type: 1, price1: 0, extraAllowed: 0 },
      ],
      optionItems: [],
      optionLeathers: [
        { optionId: OPTION_SEAT_LEATHER, leatherId: 48, name: 'Aviar Smooth Black' },
        { optionId: OPTION_AVIAR_KNEE_ROLL_LEATHER, leatherId: 63, name: 'Aviar Buffalo Black' },
      ],
      statuses: [],
    };
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(editOptions) });
    });
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('offers a leather option only the leathers ticked for the model', async () => {
      renderNewOrder();
      await waitFor(() => expect(screen.getByText('Aviar preset')).toBeInTheDocument());
      await act(async () => {
        fireEvent.click(screen.getByText('Aviar preset'));
      });

      expect(screen.getByText('Seat Leather:')).toBeInTheDocument();
      expect(screen.getByText('Aviar Smooth Black')).toBeInTheDocument();
      // The base leather list is only the top-level Leathertype dropdown
      expect(screen.getAllByText('Italian Leather')).toHaveLength(1);
    });

    it('treats every type-1 option as a leather option, not just a fixed id list', async () => {
      renderNewOrder();
      await waitFor(() => expect(screen.getByText('Aviar preset')).toBeInTheDocument());
      await act(async () => {
        fireEvent.click(screen.getByText('Aviar preset'));
      });

      expect(screen.getByText('AVIAR Knee Roll Leather:')).toBeInTheDocument();
      expect(screen.getByText('Aviar Buffalo Black')).toBeInTheDocument();
    });
  });

  describe('legacy parity — Step 1 (2026-09-17)', () => {
    // Aviar Rook 2.0 (97) with fitter Aiken Shop (currency 1 = USD), preset
    // AVIAR SMOOTH Black (24), as captured from production.
    const OPT_SEAT_SIZE = 1, OPT_SEAT_SHAPE = 41, OPT_FLAP = 8, OPT_SEAT_OPTION = 34, OPT_SEAT_LEATHER = 11;
    const rookOptions = {
      fitters: [{ id: 28, username: 'aikenshop123', fullName: 'Aiken Shop', active: true, currency: 1 }],
      saddles: [{ id: 97, brand: 'Aviar', modelName: 'Rook 2.0 (K644B)', displayName: 'Aviar Rook 2.0 (K644B)', active: 1 }],
      leatherTypes: [{ id: 48, name: 'ASBLV - Aviar SMOOTH Black Vienna', price1: 6595, price2: 5095, price7: 5695 }],
      options: [
        { optionId: OPT_SEAT_SIZE, optionName: 'Seat Size', sequence: 1, group: null, type: 0, price1: 0, extraAllowed: 0 },
        { optionId: OPT_SEAT_SHAPE, optionName: 'AVIAR Seat Shape', sequence: 2, group: null, type: 0, price1: 0, extraAllowed: 0 },
        { optionId: OPT_FLAP, optionName: 'Flap Length', sequence: 7, group: null, type: 0, price1: 0, extraAllowed: 0 },
        { optionId: OPT_SEAT_LEATHER, optionName: 'Seat Leather', sequence: 20, group: 'SEAT', type: 1, price1: 0, extraAllowed: 0 },
        { optionId: OPT_SEAT_OPTION, optionName: 'SEAT Option', sequence: 25, group: null, type: 0, price1: 0, extraAllowed: 0 },
        { optionId: 23, optionName: 'Complete Re-Flock', sequence: 100, group: null, type: 2, price1: 250, extraAllowed: 0 },
      ],
      optionItems: [
        { id: 4, name: '16.5', optionId: OPT_SEAT_SIZE, price1: 0 },
        { id: 6150, name: 'X-SLEEK(spacer fabric)', optionId: OPT_SEAT_SHAPE, price1: 0 },
        { id: 69, name: '16', optionId: OPT_FLAP, price1: 0 },
        { id: 4660, name: 'Aviar STD Inlaid (Full Wrap) Match Leather', optionId: OPT_SEAT_OPTION, price1: 120, userColor: 1, userLeather: 0 },
      ],
      optionLeathers: [
        { optionId: OPT_SEAT_LEATHER, leatherId: 48, name: 'ASBLV - Aviar SMOOTH Black Vienna' },
        { optionId: OPT_SEAT_LEATHER, leatherId: 3, name: 'SBL - SMOOTH BLACK' },
      ],
      statuses: [{ id: 0, name: 'Unordered' }, { id: 1, name: 'Ordered' }],
      presets: [{ id: 24, name: 'AVIAR SMOOTH Black', sequence: 1 }],
      presetItems: [
        { presetId: 24, optionId: OPT_FLAP, itemId: 69 },
        { presetId: 24, optionId: OPT_SEAT_OPTION, itemId: 4660 },
        { presetId: 24, optionId: OPT_SEAT_SHAPE, itemId: 5430 }, // not offered on Rook 2.0
        { presetId: 24, optionId: OPT_SEAT_SIZE, itemId: 0 },     // legacy junk row
      ],
    };
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    beforeEach(() => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(rookOptions) });
      global.fetch = fetchMock;
    });
    afterEach(() => { global.fetch = originalFetch; });

    async function chooseModelAndPreset() {
      renderNewOrder();
      await waitFor(() => expect(screen.getByText('Aviar Rook 2.0 (K644B)')).toBeInTheDocument());
      await act(async () => { fireEvent.click(screen.getByText('Aiken Shop')); });
      await act(async () => { fireEvent.click(screen.getByText('Aviar Rook 2.0 (K644B)')); });
      await act(async () => { fireEvent.click(screen.getByText('AVIAR SMOOTH Black')); });
    }

    it('requests active models only (no includeDiscontinued)', async () => {
      renderNewOrder();
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(String(fetchMock.mock.calls[0][0])).not.toContain('includeDiscontinued');
    });

    it('ends every option select with "Customized by fitter" and shows plain item labels', async () => {
      await chooseModelAndPreset();
      expect(screen.getAllByText('Customized by fitter').length).toBeGreaterThanOrEqual(5);
      expect(screen.getByText('Aviar STD Inlaid (Full Wrap) Match Leather')).toBeInTheDocument();
      expect(screen.queryByText(/\+\$120/)).not.toBeInTheDocument();
      expect(screen.getByText('Complete Re-Flock')).toBeInTheDocument();
      expect(screen.queryByText(/\+\$250/)).not.toBeInTheDocument();
    });

    it('applies the preset only for offered items and shows "Specify color" for a user_color item', async () => {
      await chooseModelAndPreset();
      expect(screen.getByLabelText('Specify color:')).toBeInTheDocument(); // SEAT Option 4660 asks for a colour
      const selects = screen.getAllByTestId('select');
      const seatShape = selects.find(s => s.textContent?.includes('X-SLEEK'));
      expect(seatShape).not.toHaveAttribute('data-value', '5430');
      const seatSize = selects.find(s => s.textContent?.includes('16.5'));
      expect(seatSize).not.toHaveAttribute('data-value', '0');
    });

    it('shows "Please specify" when Customized by fitter is chosen and sends the texts in the payload', async () => {
      await chooseModelAndPreset();
      // pick "Customized by fitter" for Seat Size (first select containing 16.5)
      const seatSizeSelect = screen.getAllByTestId('select').find(s => s.textContent?.includes('16.5'))!;
      await act(async () => { fireEvent.click(within(seatSizeSelect).getByText('Customized by fitter')); });
      fireEvent.change(screen.getByLabelText('Please specify:'), { target: { value: '17.25' } });
      fireEvent.change(screen.getByLabelText('Specify color:'), { target: { value: 'Black' } });
      // Complete Step 1 so the Task 13 validation lets us reach Step 3: pick AVIAR Seat
      // Shape (its only offered item), keep the Seat Leather pick, and choose the top
      // Leathertype. "ASBLV - Aviar SMOOTH Black Vienna" appears in both the top
      // Leathertype select and the Seat Leather option row (a type-1 option using the
      // same leatherTypes name) — scope to the Seat Leather row (identified by its
      // sibling "SBL - SMOOTH BLACK" item).
      const seatShapeSelect = screen.getAllByTestId('select').find(s => s.textContent?.includes('X-SLEEK(spacer fabric)'))!;
      await act(async () => { fireEvent.click(within(seatShapeSelect).getByText('X-SLEEK(spacer fabric)')); });
      const seatLeatherSelect = screen.getAllByTestId('select').find(s => s.textContent?.includes('SBL - SMOOTH BLACK'))!;
      await act(async () => { fireEvent.click(within(seatLeatherSelect).getByText('ASBLV - Aviar SMOOTH Black Vienna')); });
      // The top Leathertype select is the first select rendering "ASBLV …" in DOM order.
      const leatherTypeSelect = screen.getAllByTestId('select').find(s => s.textContent?.includes('ASBLV - Aviar SMOOTH Black Vienna'))!;
      await act(async () => { fireEvent.click(within(leatherTypeSelect).getByText('ASBLV - Aviar SMOOTH Black Vienna')); });
      await navigateToStep(3);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /create order/i })); });
      const payload = createOrderFromPayload.mock.calls[0][0];
      expect(payload.saddleOptions).toContainEqual(expect.objectContaining({ optionId: OPT_SEAT_SIZE, optionItemId: 0, custom: '17.25' }));
      expect(payload.saddleOptions).toContainEqual(expect.objectContaining({ optionId: OPT_SEAT_OPTION, optionItemId: 4660, color: 'Black' }));
    });

    it('fills the saddle price from saddle_leathers in the fitter currency when the leather is chosen', async () => {
      await chooseModelAndPreset();
      expect(screen.getByText('Total (USD):')).toBeInTheDocument();
      expect(screen.getByLabelText('Saddle price:')).toHaveValue(0);
      // "ASBLV - Aviar SMOOTH Black Vienna" appears in both the top Leathertype select
      // and the Seat Leather option row (a type-1 option using the same leatherTypes
      // name); the Leathertype select renders first in the DOM.
      await act(async () => { fireEvent.click(screen.getAllByText('ASBLV - Aviar SMOOTH Black Vienna')[0]); });
      expect(screen.getByLabelText('Saddle price:')).toHaveValue(6595);
      expect(screen.getByText('6595.00')).toBeInTheDocument(); // total
    });

    it('totals like legacy and sends every price field', async () => {
      await chooseModelAndPreset();
      await act(async () => { fireEvent.click(screen.getAllByText('ASBLV - Aviar SMOOTH Black Vienna')[0]); });
      fireEvent.change(screen.getByLabelText(/^Deposit:/), { target: { value: '500' } });
      fireEvent.change(screen.getByLabelText(/^Additional costs:/), { target: { value: '290' } });
      expect(screen.getByText('6385.00')).toBeInTheDocument();
      // Complete the rest of Step 1's red-asterisk option rows (Task 13's validation
      // gate) so Next Step isn't blocked: Seat Size, AVIAR Seat Shape, and Seat Leather
      // have no preset value on this model, so they still need an explicit pick.
      await act(async () => { fireEvent.click(screen.getByText('16.5')); });
      await act(async () => { fireEvent.click(screen.getByText('X-SLEEK(spacer fabric)')); });
      const seatLeatherSelect = screen.getAllByTestId('select').find(s => s.textContent?.includes('SBL - SMOOTH BLACK'))!;
      await act(async () => { fireEvent.click(within(seatLeatherSelect).getByText('ASBLV - Aviar SMOOTH Black Vienna')); });
      // SEAT Option's preset item (4660) is a user_color item — its color is required too.
      fireEvent.change(screen.getByLabelText('Specify color:'), { target: { value: 'Black' } });
      await navigateToStep(3);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /create order/i })); });
      expect(createOrderFromPayload.mock.calls[0][0]).toMatchObject({
        priceSaddle: 6595, priceTradein: 0, priceDeposit: 500, priceDiscount: 0,
        priceFittingeval: 0, priceCallfee: 0, priceGirth: 0, priceAdditional: 290, priceShipping: 0, priceTax: 0,
      });
    });

    // Step 3 is unreachable without a fitter via BOTH Next Step and the step
    // indicator (the indicator has its own gate — see the test below).
    it('blocks Next Step until the red-asterisk fields are filled', async () => {
      const { toast } = jest.requireMock('sonner') as { toast: { error: jest.Mock } };
      await chooseModelAndPreset();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /next step/i })); });
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Leathertype'));
      expect(screen.getByText(/Step 1/)).toBeInTheDocument();
    });

    it('blocks the step indicator from jumping to Step 3 until the red-asterisk fields are filled', async () => {
      const { toast } = jest.requireMock('sonner') as { toast: { error: jest.Mock } };
      renderNewOrder();
      await waitFor(() => expect(screen.getByText('Aviar Rook 2.0 (K644B)')).toBeInTheDocument());
      // Nothing selected — clicking the "Order Settings" indicator must not
      // bypass the Step 1 gate the way it used to.
      const indicators = screen.getAllByRole('button', { name: /order settings/i });
      await act(async () => { fireEvent.click(indicators[0]); });
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Fitter'));
      expect(screen.getByText(/Step 1/)).toBeInTheDocument();
      expect(createOrderFromPayload).not.toHaveBeenCalled();
    });
  });
});
