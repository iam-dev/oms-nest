import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Reports from '@/components/Reports';
import { AuthTestProvider } from '../utils/AuthTestProvider';

// Mock URL.createObjectURL / revokeObjectURL (not available in jsdom)
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock the API services
jest.mock('@/services/enrichedOrders', () => ({
  fetchEnrichedOrders: jest.fn(),
  getEnrichedOrders: jest.fn().mockResolvedValue({
    'hydra:member': [],
    'hydra:totalItems': 0,
  }),
  getFilterOptions: jest.fn().mockResolvedValue({
    fitters: ['Jane Fitter', 'Bob Fitter'],
    customers: ['John Customer', 'Alice Customer'],
    saddles: ['Brand A - Model X', 'Brand B - Model Y'],
    customerCountries: ['USA', 'UK', 'Germany'],
    fitterCountries: ['France', 'Netherlands'],
    kneeRolls: ['Standard', 'Extended', 'Short'],
    leatherTypes: ['Calfskin', 'Pigskin', 'Buffalo'],
    factories: ['Factory Alpha', 'Factory Beta'],
  }),
}));

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
  },
  fetchEntities: jest.fn().mockResolvedValue({
    'hydra:member': [],
    'hydra:totalItems': 0,
  }),
}));

// Mock generate-pdf to avoid jsPDF ESM import issues in Jest
jest.mock('@/lib/generate-pdf', () => ({
  generateOrderPDF: jest.fn(),
  generateLabelPDF: jest.fn(),
}));

// Mock exportXlsx to avoid exceljs/uuid ESM import issues in Jest
jest.mock('@/utils/exportXlsx', () => ({
  exportToXlsx: jest.fn(),
}));

// Mock OrdersTable component
jest.mock('@/components/shared/OrdersTable', () => ({
  OrdersTable: ({
    searchTerm,
    onSearch,
    headerFilters,
    onFilterChange,
    dateFrom,
    dateTo,
    orders,
    pagination,
    loading,
    error,
  }: any) => (
    <div data-testid="orders-table">
      <input
        data-testid="search-input"
        value={searchTerm}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search orders..."
      />
      <div data-testid="filter-status">
        Status: {headerFilters?.status || 'all'}
      </div>
      <div data-testid="filter-fitter">
        Fitter: {headerFilters?.fitter || 'all'}
      </div>
      <div data-testid="filter-customer">
        Customer: {headerFilters?.customer || 'all'}
      </div>
      <div data-testid="filter-supplier">
        Supplier: {headerFilters?.supplier || 'all'}
      </div>
      <div data-testid="filter-urgent">
        Urgent: {headerFilters?.urgent || 'all'}
      </div>
      <div data-testid="date-from">
        From: {dateFrom || 'none'}
      </div>
      <div data-testid="date-to">
        To: {dateTo || 'none'}
      </div>
      <div data-testid="orders-count">
        Orders: {orders?.length || 0}
      </div>
      <div data-testid="loading-state">
        Loading: {loading ? 'true' : 'false'}
      </div>
      <div data-testid="total-items">
        Total: {pagination?.totalItems ?? 0}
      </div>
      <div data-testid="items-per-page">
        PerPage: {pagination?.itemsPerPage ?? 0}
      </div>
      <div data-testid="total-pages">
        Pages: {pagination?.totalPages ?? 0}
      </div>
      {error && (
        <div data-testid="error-state">
          Error: {error}
        </div>
      )}
    </div>
  ),
}));

// Mock MultiSelectFilter component
jest.mock('@/components/shared/MultiSelectFilter', () => ({
  MultiSelectFilter: ({ label, options, selected, onChangeSelected }: any) => (
    <div data-testid={`multi-select-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <label>{label}</label>
      <div data-testid={`multi-select-options-count-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        {options?.length || 0} options
      </div>
      <div data-testid={`multi-select-selected-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        {selected?.join(',') || 'none'}
      </div>
      <button
        data-testid={`multi-select-add-${label.toLowerCase().replace(/\s+/g, '-')}`}
        onClick={() => {
          if (options?.length > 0) {
            onChangeSelected([...selected, options[0].value]);
          }
        }}
      >
        Add first
      </button>
      <button
        data-testid={`multi-select-clear-${label.toLowerCase().replace(/\s+/g, '-')}`}
        onClick={() => onChangeSelected([])}
      >
        Clear
      </button>
    </div>
  ),
}));

// Mock dropdown components with comprehensive options
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => {
    return (
      <div data-testid="select-component">
        <select
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          data-testid="select-input"
        >
          {children}
        </select>
      </div>
    );
  },
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

// Mock calendar component
jest.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect, selected }: any) => (
    <div data-testid="calendar">
      <button onClick={() => onSelect(new Date('2024-01-15'))}>
        Select Date
      </button>
      <div>Selected: {selected?.toISOString() || 'none'}</div>
    </div>
  ),
}));

// Mock popover for date picker
jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
  PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
}));

const mockOrders = [
  {
    id: 1,
    orderId: 101,
    orderNumber: 'ORD-001',
    customer: { id: 1, name: 'John Customer' },
    fitter: { id: 1, name: 'Jane Fitter' },
    supplier: { id: 1, name: 'Acme Supplier' },
    fitter_name: 'Jane Fitter',
    customer_name: 'John Customer',
    brand_name: 'Brand A',
    model_name: 'Model X',
    customer_country: 'USA',
    fitter_country: 'France',
    knee_roll: 'Standard',
    leather_name: 'Calfskin',
    status: 'pending',
    orderStatus: 'pending',
    urgent: false,
    demo: false,
    sponsored: false,
    repair: false,
    createdAt: '2024-01-15T10:00:00Z',
    completedAt: null,
  },
  {
    id: 2,
    orderId: 102,
    orderNumber: 'ORD-002',
    customer: { id: 2, name: 'Alice Customer' },
    fitter: { id: 2, name: 'Bob Fitter' },
    supplier: { id: 2, name: 'Beta Supplier' },
    fitter_name: 'Bob Fitter',
    customer_name: 'Alice Customer',
    brand_name: 'Brand B',
    model_name: 'Model Y',
    customer_country: 'UK',
    fitter_country: 'Netherlands',
    knee_roll: 'Extended',
    leather_name: 'Pigskin',
    status: 'completed',
    orderStatus: 'completed',
    urgent: true,
    demo: false,
    sponsored: false,
    repair: false,
    createdAt: '2024-01-16T11:00:00Z',
    completedAt: '2024-01-20T15:00:00Z',
  },
];

const mockGetEnrichedOrders = require('@/services/enrichedOrders').getEnrichedOrders;
const mockGetFilterOptions = require('@/services/enrichedOrders').getFilterOptions;

const renderWithAuth = (ui: React.ReactElement, userRole = 'admin') => {
  return render(
    <AuthTestProvider role={userRole}>
      {ui}
    </AuthTestProvider>
  );
};

describe('Reports Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEnrichedOrders.mockResolvedValue({
      data: mockOrders,
      total: 150,
      pages: 3,
    });
  });

  describe('Initial Rendering', () => {
    it('renders reports page with all filter components', async () => {
      renderWithAuth(<Reports />);

      expect(screen.getByText('Order Reports')).toBeInTheDocument();
      expect(screen.getByText('Ordered from')).toBeInTheDocument();
      expect(screen.getByText('Date from')).toBeInTheDocument();
      expect(screen.getByText('Payment from')).toBeInTheDocument();
      expect(screen.getByText('Fitters')).toBeInTheDocument();
      expect(screen.getByText('Order statuses')).toBeInTheDocument();
      expect(screen.getByText('Saletypes')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });
    });

    it('renders all multi-select filter labels', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      // All multi-select filter labels should be visible
      expect(screen.getByText('Fitters')).toBeInTheDocument();
      expect(screen.getByText('Order statuses')).toBeInTheDocument();
      expect(screen.getByText('Saletypes')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Factories')).toBeInTheDocument();
      expect(screen.getByText('Saddles')).toBeInTheDocument();
      expect(screen.getByText('Customer Countries')).toBeInTheDocument();
      expect(screen.getByText('Fitter Countries')).toBeInTheDocument();
      expect(screen.getByText('Seatsizes')).toBeInTheDocument();
      expect(screen.getByText('Knee Roll')).toBeInTheDocument();
      expect(screen.getByText('Leather Type')).toBeInTheDocument();
    });

    it('loads orders on mount', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(mockGetEnrichedOrders).toHaveBeenCalled();
        expect(screen.getByTestId('orders-count')).toHaveTextContent('Orders: 2');
      });
    });

    it('shows loading state initially', () => {
      renderWithAuth(<Reports />);

      expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading: true');
    });
  });

  describe('Filter Options Loading', () => {
    it('calls getFilterOptions on mount', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(mockGetFilterOptions).toHaveBeenCalledTimes(1);
      });
    });

    it('populates fitters from filter options', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        const fitterSelect = screen.getByTestId('multi-select-fitters');
        expect(fitterSelect).toBeInTheDocument();
        expect(screen.getByTestId('multi-select-options-count-fitters')).toHaveTextContent('2 options');
      });
    });

    it('populates factories from filter options', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('multi-select-options-count-factories')).toHaveTextContent('2 options');
      });
    });

    it('populates customer countries from filter options', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('multi-select-options-count-customer-countries')).toHaveTextContent('3 options');
      });
    });

    it('populates knee roll options from filter options', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('multi-select-options-count-knee-roll')).toHaveTextContent('3 options');
      });
    });

    it('populates leather type options from filter options', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('multi-select-options-count-leather-type')).toHaveTextContent('3 options');
      });
    });

    it('gracefully falls back when getFilterOptions fails', async () => {
      mockGetFilterOptions.mockRejectedValueOnce(new Error('Network error'));

      renderWithAuth(<Reports />);

      // Should still render and load orders
      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
        expect(mockGetEnrichedOrders).toHaveBeenCalled();
      });
    });
  });

  describe('API Call Parameters', () => {
    it('sends orderBy and orderDirection on initial load', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(mockGetEnrichedOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
            partial: true,
            filters: {},
            orderBy: 'orderId',
            order: 'desc',
          })
        );
      });
    });

    it('always sends orderBy orderId with filters', async () => {
      const user = userEvent.setup();
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      // Add a fitter filter via the multi-select mock
      const addFitterBtn = screen.getByTestId('multi-select-add-fitters');
      await user.click(addFitterBtn);

      // The API call should include orderBy: 'orderId' along with the filter
      await waitFor(() => {
        const lastCall = mockGetEnrichedOrders.mock.calls[mockGetEnrichedOrders.mock.calls.length - 1][0];
        expect(lastCall.orderBy).toBe('orderId');
        expect(lastCall.order).toBe('desc');
        expect(lastCall.filters.fitterName).toBeDefined();
      });
    });
  });

  describe('Response Format Handling', () => {
    it('handles data.data response format', async () => {
      mockGetEnrichedOrders.mockResolvedValue({
        data: mockOrders,
        total: 150,
        pages: 3,
      });

      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-count')).toHaveTextContent('Orders: 2');
        expect(screen.getByTestId('total-items')).toHaveTextContent('Total: 150');
        expect(screen.getByTestId('total-pages')).toHaveTextContent('Pages: 3');
      });
    });

    it('handles hydra:member response format', async () => {
      mockGetEnrichedOrders.mockResolvedValue({
        'hydra:member': mockOrders,
        'hydra:totalItems': 200,
      });

      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-count')).toHaveTextContent('Orders: 2');
        expect(screen.getByTestId('total-items')).toHaveTextContent('Total: 200');
      });
    });

    it('handles array response format', async () => {
      mockGetEnrichedOrders.mockResolvedValue(mockOrders);

      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-count')).toHaveTextContent('Orders: 2');
      });
    });

    it('uses server total for pagination, not client count', async () => {
      mockGetEnrichedOrders.mockResolvedValue({
        data: mockOrders, // only 2 orders on this page
        total: 500, // but 500 total on server
        pages: 10,
      });

      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('total-items')).toHaveTextContent('Total: 500');
        expect(screen.getByTestId('total-pages')).toHaveTextContent('Pages: 10');
        expect(screen.getByTestId('items-per-page')).toHaveTextContent('PerPage: 50');
      });
    });

    it('calculates totalPages from serverTotal when pages not provided', async () => {
      mockGetEnrichedOrders.mockResolvedValue({
        data: mockOrders,
        total: 200,
        // no pages field
      });

      renderWithAuth(<Reports />);

      await waitFor(() => {
        // Math.ceil(200 / 50) = 4
        expect(screen.getByTestId('total-pages')).toHaveTextContent('Pages: 4');
      });
    });
  });

  describe('Multi-Select Filter Interactions', () => {
    it('applies fitter filter to API call', async () => {
      const user = userEvent.setup();
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      const addBtn = screen.getByTestId('multi-select-add-fitters');
      await user.click(addBtn);

      await waitFor(() => {
        const lastCall = mockGetEnrichedOrders.mock.calls[mockGetEnrichedOrders.mock.calls.length - 1][0];
        expect(lastCall.filters.fitterName).toBeDefined();
      });
    });

    it('applies customer filter to API call', async () => {
      const user = userEvent.setup();
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      const addBtn = screen.getByTestId('multi-select-add-customers');
      await user.click(addBtn);

      await waitFor(() => {
        const lastCall = mockGetEnrichedOrders.mock.calls[mockGetEnrichedOrders.mock.calls.length - 1][0];
        expect(lastCall.filters.customerName).toBeDefined();
      });
    });

    it('applies factory filter to API call', async () => {
      const user = userEvent.setup();
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      const addBtn = screen.getByTestId('multi-select-add-factories');
      await user.click(addBtn);

      await waitFor(() => {
        const lastCall = mockGetEnrichedOrders.mock.calls[mockGetEnrichedOrders.mock.calls.length - 1][0];
        expect(lastCall.filters.supplierName).toBeDefined();
      });
    });

    it('applies sale type filter to API call', async () => {
      const user = userEvent.setup();
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      const addBtn = screen.getByTestId('multi-select-add-saletypes');
      await user.click(addBtn);

      await waitFor(() => {
        const lastCall = mockGetEnrichedOrders.mock.calls[mockGetEnrichedOrders.mock.calls.length - 1][0];
        expect(lastCall.filters.saleType).toBeDefined();
      });
    });

    it('resets page to 1 when filter is applied', async () => {
      const user = userEvent.setup();
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      const addBtn = screen.getByTestId('multi-select-add-fitters');
      await user.click(addBtn);

      await waitFor(() => {
        const lastCall = mockGetEnrichedOrders.mock.calls[mockGetEnrichedOrders.mock.calls.length - 1][0];
        expect(lastCall.page).toBe(1);
      });
    });
  });

  describe('Status Filter', () => {
    it('renders status filter dropdown', async () => {
      renderWithAuth(<Reports />);

      const statusFilter = screen.getByTestId('multi-select-order-statuses');
      expect(statusFilter).toBeInTheDocument();
    });

    it('renders status filter label', async () => {
      renderWithAuth(<Reports />);

      expect(screen.getByText('Order statuses')).toBeInTheDocument();
    });
  });

  describe('Urgent Filter', () => {
    it('renders urgent filter', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      const urgentLabels = screen.getAllByText('Urgent');
      expect(urgentLabels.length).toBeGreaterThan(0);
    });

    it('has urgent filter dropdown structure', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      const urgentElements = screen.getAllByText('Urgent');
      expect(urgentElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Date Range Filtering', () => {
    it('renders date range selection', async () => {
      renderWithAuth(<Reports />);

      expect(screen.getByText('Ordered from')).toBeInTheDocument();
      expect(screen.getByText('Date from')).toBeInTheDocument();
      expect(screen.getByText('Payment from')).toBeInTheDocument();
    });

    it('renders calendar date pickers', async () => {
      renderWithAuth(<Reports />);

      const calendarButtons = screen.getAllByText('Select date');
      expect(calendarButtons.length).toBe(6); // 3 date ranges × 2 (from/to)
    });
  });

  describe('Search Functionality', () => {
    it('renders search input in orders table', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('placeholder', 'Search orders...');
    });
  });

  describe('Export Functionality', () => {
    it('renders export button', async () => {
      renderWithAuth(<Reports />);

      expect(screen.getByText('Export report')).toBeInTheDocument();
    });

    it('triggers export when button is clicked', async () => {
      const user = userEvent.setup();
      const { exportToXlsx } = require('@/utils/exportXlsx');
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export report');
      await user.click(exportButton);

      expect(exportToXlsx).toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    it('passes pagination with server total to OrdersTable', async () => {
      mockGetEnrichedOrders.mockResolvedValue({
        data: mockOrders,
        total: 150,
        pages: 3,
      });

      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('total-items')).toHaveTextContent('Total: 150');
        expect(screen.getByTestId('total-pages')).toHaveTextContent('Pages: 3');
        expect(screen.getByTestId('items-per-page')).toHaveTextContent('PerPage: 50');
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when data fetch fails', async () => {
      mockGetEnrichedOrders.mockRejectedValue(new Error('API Error'));

      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByText('Error: Failed to load orders from API')).toBeInTheDocument();
      });
    });

    it('handles empty data.data gracefully', async () => {
      mockGetEnrichedOrders.mockResolvedValue({
        data: [],
        total: 0,
        pages: 0,
      });

      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-count')).toHaveTextContent('Orders: 0');
      });
    });

    it('handles empty hydra:member gracefully', async () => {
      mockGetEnrichedOrders.mockResolvedValue({
        'hydra:member': [],
        'hydra:totalItems': 0,
      });

      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-count')).toHaveTextContent('Orders: 0');
      });
    });
  });

  describe('Filter Reset', () => {
    it('does not show reset button when no filters applied', async () => {
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      expect(screen.queryByText('Reset All Filters')).not.toBeInTheDocument();
    });

    it('shows reset button when filters are applied', async () => {
      const user = userEvent.setup();
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      // Apply a filter
      const addBtn = screen.getByTestId('multi-select-add-fitters');
      await user.click(addBtn);

      await waitFor(() => {
        expect(screen.getByText('Reset All Filters')).toBeInTheDocument();
      });
    });

    it('clears all filters when reset button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<Reports />);

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });

      // Apply a filter
      const addBtn = screen.getByTestId('multi-select-add-fitters');
      await user.click(addBtn);

      await waitFor(() => {
        expect(screen.getByText('Reset All Filters')).toBeInTheDocument();
      });

      // Click reset
      const resetBtn = screen.getByText('Reset All Filters');
      await user.click(resetBtn);

      await waitFor(() => {
        // After reset, the API should be called with empty filters
        const lastCall = mockGetEnrichedOrders.mock.calls[mockGetEnrichedOrders.mock.calls.length - 1][0];
        expect(lastCall.filters).toEqual({});
      });
    });
  });

  describe('Role-based Access', () => {
    it('renders reports for admin users', async () => {
      renderWithAuth(<Reports />, 'admin');

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });
    });

    it('renders reports for manager users', async () => {
      renderWithAuth(<Reports />, 'manager');

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });
    });

    it('renders reports for fitter users', async () => {
      renderWithAuth(<Reports />, 'fitter');

      await waitFor(() => {
        expect(screen.getByTestId('orders-table')).toBeInTheDocument();
      });
    });
  });
});
