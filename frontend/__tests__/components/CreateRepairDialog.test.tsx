import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { CreateRepairDialog } from '@/components/CreateRepairDialog';

// ---------------------------------------------------------------------------
// External service mocks
// ---------------------------------------------------------------------------

jest.mock('@/services/enrichedOrders', () => ({
  fetchOrderDetail: jest.fn(),
  createOrderFromPayload: jest.fn(),
  getEnrichedOrders: jest.fn(),
}));

jest.mock('@/services/api-config', () => ({
  API_URL: 'http://localhost:3001',
}));

// ---------------------------------------------------------------------------
// UI component mocks
// ---------------------------------------------------------------------------

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size} className={className}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ placeholder, value, onChange, type, step, className, autoFocus }: {
    placeholder?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    step?: string;
    className?: string;
    autoFocus?: boolean;
  }) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      type={type}
      step={step}
      className={className}
      autoFocus={autoFocus}
      data-testid={placeholder ? `input-${placeholder.slice(0, 20)}` : 'input'}
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: () => void }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => onCheckedChange()}
      data-testid="checkbox"
    />
  ),
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Search: () => <span data-testid="icon-search" />,
  Wrench: () => <span data-testid="icon-wrench" />,
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const { fetchOrderDetail, createOrderFromPayload, getEnrichedOrders } =
  require('@/services/enrichedOrders');

const { toast } = require('sonner');

const mockOrderDetail = {
  id: 42,
  orderId: 50925,
  orderTime: '2024-03-15T10:00:00Z',
  urgent: false,
  specialNotes: 'Original order notes',
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
  repairSourceOrderId: null,
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
    {
      optionId: 2,
      optionName: 'Knee Roll',
      optionItemId: 10,
      itemName: 'Standard',
      leatherName: null,
      custom: '',
      sequence: 2,
      displayValue: 'Standard',
    },
    {
      optionId: 3,
      optionName: 'Flap Length',
      optionItemId: 15,
      itemName: 'Regular',
      leatherName: null,
      custom: 'Custom trim',
      sequence: 3,
      displayValue: 'Regular',
    },
  ],
  comments: [],
  logEntries: [],
};

const mockSearchResults = {
  'hydra:member': [
    {
      id: 42,
      orderId: 50925,
      saddleBrand: 'Custom Saddlery',
      saddleModel: 'Elegance',
      customerName: 'Jane Rider',
      name: 'Jane Rider',
      fitterName: 'Bob Fitter',
      orderTime: '2024-03-15T10:00:00Z',
      orderStatus: 'Ordered',
    },
  ],
  'hydra:totalItems': 1,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateRepairDialog component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Phase 1: Search
  // -------------------------------------------------------------------------
  describe('Phase 1: Search', () => {
    it('renders search phase by default when no sourceOrderId', () => {
      render(<CreateRepairDialog onClose={jest.fn()} />);

      expect(
        screen.getByText('Create Repair — Select Original Order'),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/Enter order ID, customer name/),
      ).toBeInTheDocument();
    });

    it('uses orderId filter for numeric search input', async () => {
      getEnrichedOrders.mockResolvedValue({
        'hydra:member': [],
        'hydra:totalItems': 0,
      });

      render(<CreateRepairDialog onClose={jest.fn()} />);

      const input = screen.getByPlaceholderText(/Enter order ID, customer name/);
      fireEvent.change(input, { target: { value: '50925' } });

      // Advance debounce timer
      act(() => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(getEnrichedOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            filters: { orderId: '50925' },
            page: 1,
          }),
        );
      });

      // Should NOT have been called with searchTerm
      const calls = getEnrichedOrders.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.searchTerm).toBeUndefined();
    });

    it('uses searchTerm for text search input', async () => {
      getEnrichedOrders.mockResolvedValue({
        'hydra:member': [],
        'hydra:totalItems': 0,
      });

      render(<CreateRepairDialog onClose={jest.fn()} />);

      const input = screen.getByPlaceholderText(/Enter order ID, customer name/);
      fireEvent.change(input, { target: { value: 'Christine' } });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(getEnrichedOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            searchTerm: 'Christine',
            page: 1,
            filters: {},
          }),
        );
      });
    });

    it('displays search results in a table', async () => {
      getEnrichedOrders.mockResolvedValue(mockSearchResults);

      render(<CreateRepairDialog onClose={jest.fn()} />);

      const input = screen.getByPlaceholderText(/Enter order ID, customer name/);
      fireEvent.change(input, { target: { value: '50925' } });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getByText('50925')).toBeInTheDocument();
        expect(screen.getByText('Jane Rider')).toBeInTheDocument();
        expect(screen.getByText('Bob Fitter')).toBeInTheDocument();
      });
    });

    it('shows no results message when search returns empty', async () => {
      getEnrichedOrders.mockResolvedValue({
        'hydra:member': [],
        'hydra:totalItems': 0,
      });

      render(<CreateRepairDialog onClose={jest.fn()} />);

      const input = screen.getByPlaceholderText(/Enter order ID, customer name/);
      fireEvent.change(input, { target: { value: 'nonexistent' } });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getByText(/No orders found matching/)).toBeInTheDocument();
      });
    });

    it('does not search when input is less than 2 chars', () => {
      render(<CreateRepairDialog onClose={jest.fn()} />);

      const input = screen.getByPlaceholderText(/Enter order ID, customer name/);
      fireEvent.change(input, { target: { value: 'x' } });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(getEnrichedOrders).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Phase 2: Repair Form
  // -------------------------------------------------------------------------
  describe('Phase 2: Repair Form', () => {
    it('loads detail and renders checkboxes when sourceOrderId is provided', async () => {
      fetchOrderDetail.mockResolvedValue(mockOrderDetail);

      render(
        <CreateRepairDialog
          sourceOrderId={42}
          sourceDisplayOrderId={50925}
          onClose={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(fetchOrderDetail).toHaveBeenCalledWith(42);
      });

      await waitFor(() => {
        expect(screen.getByText('Seat Size:')).toBeInTheDocument();
        expect(screen.getByText('Knee Roll:')).toBeInTheDocument();
        expect(screen.getByText('Flap Length:')).toBeInTheDocument();
      });
    });

    it('transitions from search to form when order is selected', async () => {
      getEnrichedOrders.mockResolvedValue(mockSearchResults);
      fetchOrderDetail.mockResolvedValue(mockOrderDetail);

      render(<CreateRepairDialog onClose={jest.fn()} />);

      // Search
      const input = screen.getByPlaceholderText(/Enter order ID, customer name/);
      fireEvent.change(input, { target: { value: '50925' } });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Click on the search result row
      await waitFor(() => {
        expect(screen.getByText('50925')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Jane Rider'));

      await waitFor(() => {
        expect(fetchOrderDetail).toHaveBeenCalledWith(42);
      });

      await waitFor(() => {
        expect(screen.getByText('Parts to Repair')).toBeInTheDocument();
      });
    });

    it('shows all options unchecked initially', async () => {
      fetchOrderDetail.mockResolvedValue(mockOrderDetail);

      render(
        <CreateRepairDialog
          sourceOrderId={42}
          sourceDisplayOrderId={50925}
          onClose={jest.fn()}
        />,
      );

      await waitFor(() => {
        const checkboxes = screen.getAllByTestId('checkbox');
        expect(checkboxes).toHaveLength(3);
        checkboxes.forEach((cb) => {
          expect(cb).not.toBeChecked();
        });
      });
    });

    it('toggles checkbox when clicked', async () => {
      fetchOrderDetail.mockResolvedValue(mockOrderDetail);

      render(
        <CreateRepairDialog
          sourceOrderId={42}
          sourceDisplayOrderId={50925}
          onClose={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getAllByTestId('checkbox')).toHaveLength(3);
      });

      // Click the first checkbox label (parent label element triggers onCheckedChange)
      const checkboxes = screen.getAllByTestId('checkbox');
      fireEvent.click(checkboxes[0]);

      // Verify the "1 part selected" text appears
      await waitFor(() => {
        expect(screen.getByText(/1 part selected for repair/)).toBeInTheDocument();
      });
    });

    it('disables submit button when no parts are selected', async () => {
      fetchOrderDetail.mockResolvedValue(mockOrderDetail);

      render(
        <CreateRepairDialog
          sourceOrderId={42}
          sourceDisplayOrderId={50925}
          onClose={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Create Repair Order')).toBeInTheDocument();
      });

      const submitBtn = screen.getByText('Create Repair Order');
      expect(submitBtn).toBeDisabled();
    });

    it('shows select all / deselect all toggle', async () => {
      fetchOrderDetail.mockResolvedValue(mockOrderDetail);

      render(
        <CreateRepairDialog
          sourceOrderId={42}
          sourceDisplayOrderId={50925}
          onClose={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Select all')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------
  describe('Submit', () => {
    it('submits with repair=true, repairSourceOrderId, and only checked options', async () => {
      fetchOrderDetail.mockResolvedValue(mockOrderDetail);
      createOrderFromPayload.mockResolvedValue({ success: true, orderId: 99999 });

      const onClose = jest.fn();
      render(
        <CreateRepairDialog
          sourceOrderId={42}
          sourceDisplayOrderId={50925}
          onClose={onClose}
        />,
      );

      // Wait for detail to load
      await waitFor(() => {
        expect(screen.getAllByTestId('checkbox')).toHaveLength(3);
      });

      // Check only the first option (Seat Size)
      const checkboxes = screen.getAllByTestId('checkbox');
      fireEvent.click(checkboxes[0]);

      // Wait for button to be enabled
      await waitFor(() => {
        expect(screen.getByText('Create Repair Order')).not.toBeDisabled();
      });

      // Submit
      fireEvent.click(screen.getByText('Create Repair Order'));

      await waitFor(() => {
        expect(createOrderFromPayload).toHaveBeenCalledTimes(1);
      });

      const payload = createOrderFromPayload.mock.calls[0][0];

      // Verify repair-specific fields
      expect(payload.repair).toBe(true);
      expect(payload.repairSourceOrderId).toBe(42);

      // Verify only the checked option (Seat Size, optionId=1) is included
      expect(payload.saddleOptions).toHaveLength(1);
      expect(payload.saddleOptions[0].optionId).toBe(1);
      expect(payload.saddleOptions[0].optionItemId).toBe(5);

      // Verify prices are zeroed except priceSaddle
      expect(payload.priceTradein).toBe(0);
      expect(payload.priceDeposit).toBe(0);

      // Verify success toast and dialog close
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('99999'),
      );
      expect(onClose).toHaveBeenCalled();
    });

    it('shows error toast on submit failure', async () => {
      fetchOrderDetail.mockResolvedValue(mockOrderDetail);
      createOrderFromPayload.mockRejectedValue(new Error('Server error'));

      render(
        <CreateRepairDialog
          sourceOrderId={42}
          sourceDisplayOrderId={50925}
          onClose={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getAllByTestId('checkbox')).toHaveLength(3);
      });

      // Check first option
      fireEvent.click(screen.getAllByTestId('checkbox')[0]);

      await waitFor(() => {
        expect(screen.getByText('Create Repair Order')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByText('Create Repair Order'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Server error');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Loading and Error states
  // -------------------------------------------------------------------------
  describe('Loading and Error states', () => {
    it('shows loading spinner when fetching order detail', () => {
      fetchOrderDetail.mockReturnValue(new Promise(() => {}));

      render(
        <CreateRepairDialog
          sourceOrderId={42}
          sourceDisplayOrderId={50925}
          onClose={jest.fn()}
        />,
      );

      expect(screen.getByText('Loading order details...')).toBeInTheDocument();
    });

    it('shows error message and retry button on fetch failure', async () => {
      fetchOrderDetail.mockRejectedValue(new Error('Network error'));

      render(
        <CreateRepairDialog
          sourceOrderId={42}
          sourceDisplayOrderId={50925}
          onClose={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading order')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Cancel / Close
  // -------------------------------------------------------------------------
  describe('Cancel / Close', () => {
    it('calls onClose when Cancel button is clicked in search phase', () => {
      const onClose = jest.fn();
      render(<CreateRepairDialog onClose={onClose} />);

      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked in form phase', async () => {
      fetchOrderDetail.mockResolvedValue(mockOrderDetail);
      const onClose = jest.fn();

      render(
        <CreateRepairDialog
          sourceOrderId={42}
          sourceDisplayOrderId={50925}
          onClose={onClose}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Parts to Repair')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
