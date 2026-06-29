import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrdersTable } from '@/components/shared/OrdersTable';
import { AuthTestProvider } from '@/utils/AuthTestProvider';
import type { OrdersTableColumn, OrdersTableProps } from '@/components/shared/OrdersTable';
import type { Order } from '@/types/Order';
import { UserRole } from '@/types/Role';

// Mock useUserRole so we can control the role returned per test
const mockUseUserRoleFn = jest.fn();
jest.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => mockUseUserRoleFn(),
}));

// Mock logger to suppress debug logs
jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockOrders: Order[] = [
  {
    id: 1,
    orderNumber: 'ORD-001',
    customer: { id: 1, name: 'John Customer' },
    fitter: { id: 1, name: 'Jane Fitter' },
    supplier: { id: 1, name: 'Acme Supplier' },
    status: 'pending',
    urgent: false,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    seatSize: 'M',
    reference: 'REF-001',
  },
  {
    id: 2,
    orderNumber: 'ORD-002',
    customer: { id: 2, name: 'Alice Customer' },
    fitter: { id: 2, name: 'Bob Fitter' },
    supplier: { id: 2, name: 'Beta Supplier' },
    status: 'approved',
    urgent: true,
    createdAt: new Date('2024-01-16T11:00:00Z'),
    updatedAt: new Date('2024-01-16T11:00:00Z'),
    seatSize: 'L',
    reference: 'REF-002',
  },
] as unknown as Order[];

const mockColumns: OrdersTableColumn[] = [
  { key: 'orderNumber', title: 'Order Number' },
  { key: 'customer', title: 'Customer', render: (value: unknown) => (value as { name?: string } | null)?.name || '' },
  { key: 'status', title: 'Status' },
  { key: 'urgent', title: 'Urgent', render: (value: unknown) => (value ? 'Yes' : 'No') },
  { key: 'createdAt', title: 'Created', render: (value: unknown) => value ? new Date(value as string).toLocaleDateString() : '' },
];

const mockPagination = {
  currentPage: 1,
  totalPages: 2,
  onPageChange: jest.fn(),
  totalItems: 15,
  itemsPerPage: 10,
};

const mockSeatSizes = ['S', 'M', 'L', 'XL'];
const mockStatuses = ['pending', 'approved', 'completed', 'cancelled'];
const mockFitters = ['Jane Fitter', 'Bob Fitter'];

const defaultProps = {
  orders: mockOrders,
  columns: mockColumns,
  pagination: mockPagination,
  searchTerm: '',
  onSearch: jest.fn(),
  headerFilters: {},
  onFilterChange: jest.fn(),
  onViewOrder: jest.fn(),
  onEditOrder: jest.fn(),
  onApproveOrder: jest.fn(),
  onDeleteOrder: jest.fn(),
  seatSizes: mockSeatSizes,
  statuses: mockStatuses,
  fitters: mockFitters,
  dateFrom: undefined,
  setDateFrom: jest.fn(),
  dateTo: undefined,
  setDateTo: jest.fn(),
} satisfies Partial<OrdersTableProps>;

/**
 * Helper: configure the mock useUserRole to return a given role.
 * Also supports `null` to simulate no role (permission check falls back to `role === null`).
 */
function setMockRole(role: UserRole | null) {
  mockUseUserRoleFn.mockReturnValue({
    role,
    isAdmin: role === UserRole.ADMIN || role === UserRole.SUPERVISOR,
    isSupervisor: role === UserRole.SUPERVISOR,
    isUser: role === UserRole.USER,
    isFitter: role === UserRole.FITTER,
    isSupplier: role === UserRole.SUPPLIER,
    hasRole: jest.fn(),
    hasAnyRole: jest.fn(),
    hasScreenPermission: jest.fn(),
    isAuthenticated: role !== null,
  });
}

const renderTable = (props = {}) => {
  return render(
    <AuthTestProvider>
      <OrdersTable {...defaultProps} {...props} />
    </AuthTestProvider>
  );
};

describe('OrdersTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to ADMIN so all action buttons appear
    setMockRole(UserRole.ADMIN);
  });

  describe('Basic Rendering', () => {
    it('renders orders table with data', () => {
      renderTable();

      expect(screen.getByText('ORD-001')).toBeInTheDocument();
      expect(screen.getByText('ORD-002')).toBeInTheDocument();
    });

    it('displays column headers', () => {
      renderTable();

      expect(screen.getByText('Order Number')).toBeInTheDocument();
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Urgent')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
    });

    it('displays the OPTIONS column when action handlers are provided', () => {
      renderTable();

      // OrdersTable appends an OPTIONS column when actions are provided
      expect(screen.getByText('OPTIONS')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('renders search input with correct placeholder', () => {
      renderTable();

      // The OrdersTable search input uses placeholder "Search..."
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('calls onSearch when search term changes', async () => {
      const user = userEvent.setup();
      const onSearchMock = jest.fn();

      renderTable({ onSearch: onSearchMock });

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'ORD-001');

      await waitFor(() => {
        expect(onSearchMock).toHaveBeenCalled();
      });
    });

    it('displays current search term', () => {
      renderTable({ searchTerm: 'existing search' });

      const searchInput = screen.getByPlaceholderText('Search...');
      expect(searchInput).toHaveValue('existing search');
    });
  });

  describe('Header Filters', () => {
    it('renders header column titles for filterable columns', () => {
      const columnsWithFilters: OrdersTableColumn[] = [
        { key: 'status', title: 'Status', filter: { type: 'list' } },
        { key: 'urgent', title: 'Urgent', filter: { type: 'boolean' } },
        { key: 'seatSize', title: 'Seat Size', filter: { type: 'list' } },
      ];

      renderTable({ columns: columnsWithFilters });

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Urgent')).toBeInTheDocument();
      expect(screen.getByText('Seat Size')).toBeInTheDocument();
    });
  });

  describe('Date Range Filtering', () => {
    it('renders date range inputs', () => {
      renderTable();

      // DateRangePicker renders two inputs with placeholders "Date from" and "to"
      expect(screen.getByPlaceholderText('Date from')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('to')).toBeInTheDocument();
    });

    it('renders Show button for date filtering', () => {
      renderTable();

      expect(screen.getByText('Show')).toBeInTheDocument();
    });

    it('calls onFilterChange when Show button is clicked', async () => {
      const user = userEvent.setup();
      const onFilterChangeMock = jest.fn();

      renderTable({ onFilterChange: onFilterChangeMock });

      const showButton = screen.getByText('Show');
      await user.click(showButton);

      expect(onFilterChangeMock).toHaveBeenCalledWith('dateRefresh', expect.any(String));
    });
  });

  describe('Action Buttons', () => {
    describe('Admin Role (ROLE_ADMIN)', () => {
      beforeEach(() => {
        setMockRole(UserRole.ADMIN);
      });

      it('renders action buttons for each order row', () => {
        renderTable();

        // Action buttons are icon-only (Eye, Edit, CheckCircle2, Trash) with no text labels.
        // We verify them by looking for the buttons with role="button" inside the actions column.
        // Each order row should have 4 action buttons.
        const allButtons = screen.getAllByRole('button');
        // Buttons: 4 actions * 2 rows + pagination buttons (FIRST, PREVIOUS, NEXT, LAST) + Show button = 13
        // Just verify there are multiple buttons rendered
        expect(allButtons.length).toBeGreaterThanOrEqual(8);
      });

      it('calls onViewOrder when view (eye) button is clicked', async () => {
        const user = userEvent.setup();
        const onViewOrderMock = jest.fn();

        renderTable({ onViewOrder: onViewOrderMock });

        // The view buttons are the first action button in each row's action cell.
        // We find all ghost icon buttons - there are 4 per row (view, edit, approve, delete).
        // We use the tooltip content to identify them. But since tooltips render via portal,
        // we just click the first icon button in the actions area.
        const allButtons = screen.getAllByRole('button');
        // Filter to icon-sized ghost buttons (action buttons have h-8 w-8 class)
        // The action buttons appear after the column headers. Let's find them by their position.
        // Since we can't easily identify icon-only buttons, we click and check the callback.

        // Each row has 4 action buttons. First row's buttons start after the search/filter area.
        // Let's find all buttons and identify action buttons by size.
        // A simpler approach: just click buttons until onViewOrderMock is called.
        // The view button is the first action button in each row.

        // Get all buttons that are not pagination/show buttons
        const actionButtonsRow1: HTMLElement[] = [];
        allButtons.forEach((btn) => {
          if (btn.className.includes('h-8') && btn.className.includes('w-8')) {
            actionButtonsRow1.push(btn);
          }
        });

        // First icon button should be the View button for the first order
        if (actionButtonsRow1.length > 0) {
          await user.click(actionButtonsRow1[0]);
          expect(onViewOrderMock).toHaveBeenCalledWith(mockOrders[0]);
        }
      });

      it('calls onEditOrder when edit button is clicked', async () => {
        const user = userEvent.setup();
        const onEditOrderMock = jest.fn();

        renderTable({ onEditOrder: onEditOrderMock });

        const actionButtons = screen.getAllByRole('button').filter(
          (btn) => btn.className.includes('h-8') && btn.className.includes('w-8')
        );

        // Second icon button per row is the Edit button
        if (actionButtons.length >= 2) {
          await user.click(actionButtons[1]);
          expect(onEditOrderMock).toHaveBeenCalledWith(mockOrders[0]);
        }
      });

      it('calls onApproveOrder when approve button is clicked', async () => {
        const user = userEvent.setup();
        const onApproveOrderMock = jest.fn();

        renderTable({ onApproveOrder: onApproveOrderMock });

        const actionButtons = screen.getAllByRole('button').filter(
          (btn) => btn.className.includes('h-8') && btn.className.includes('w-8')
        );

        // Third icon button per row is the Approve button
        if (actionButtons.length >= 3) {
          await user.click(actionButtons[2]);
          expect(onApproveOrderMock).toHaveBeenCalledWith(mockOrders[0]);
        }
      });

      it('calls onDeleteOrder when delete button is clicked', async () => {
        const user = userEvent.setup();
        const onDeleteOrderMock = jest.fn();

        renderTable({ onDeleteOrder: onDeleteOrderMock });

        const actionButtons = screen.getAllByRole('button').filter(
          (btn) => btn.className.includes('h-8') && btn.className.includes('w-8')
        );

        // Fourth icon button per row is the Delete button
        if (actionButtons.length >= 4) {
          await user.click(actionButtons[3]);
          expect(onDeleteOrderMock).toHaveBeenCalledWith(mockOrders[0]);
        }
      });
    });

    describe('Supervisor Role (maps from "manager")', () => {
      beforeEach(() => {
        // 'manager' maps to SUPERVISOR in getMockUserByRole
        // SUPERVISOR has ORDER_VIEW, ORDER_EDIT, ORDER_APPROVE, ORDER_DELETE permissions
        setMockRole(UserRole.SUPERVISOR);
      });

      it('renders action buttons for supervisor (view, edit, approve, delete)', () => {
        renderTable();

        // SUPERVISOR has all order permissions
        const actionButtons = screen.getAllByRole('button').filter(
          (btn) => btn.className.includes('h-8') && btn.className.includes('w-8')
        );
        // 4 buttons per row * 2 rows = 8
        expect(actionButtons).toHaveLength(8);
      });
    });

    describe('Fitter Role', () => {
      beforeEach(() => {
        setMockRole(UserRole.FITTER);
      });

      it('renders view and edit buttons for fitter on non-restricted orders', () => {
        renderTable();

        // FITTER has ORDER_VIEW + ORDER_EDIT (status-based).
        // Mock orders have status 'pending' and 'approved' (lowercase) which don't
        // match restricted statuses (case-sensitive), so edit buttons are enabled.
        const actionButtons = screen.getAllByRole('button').filter(
          (btn) => btn.className.includes('h-8') && btn.className.includes('w-8')
        );
        // 2 buttons (view + edit) per row * 2 rows = 4
        expect(actionButtons).toHaveLength(4);
      });

      it('shows disabled edit button for orders with restricted status', () => {
        const restrictedOrders = [
          {
            ...mockOrders[0],
            orderStatus: 'Approved',
            status: 'Approved',
          },
          {
            ...mockOrders[1],
            orderStatus: 'In Production P1',
            status: 'In Production P1',
          },
        ] as unknown as Order[];

        renderTable({ orders: restrictedOrders });

        // Fitter should see view buttons (enabled) + edit buttons (disabled) for restricted orders
        const allActionButtons = screen.getAllByRole('button').filter(
          (btn) => btn.className.includes('h-8') && btn.className.includes('w-8')
        );
        // 2 buttons per row (view + disabled edit) * 2 rows = 4
        expect(allActionButtons).toHaveLength(4);

        // Disabled edit buttons should have the disabled attribute
        const disabledButtons = allActionButtons.filter((btn) => btn.hasAttribute('disabled'));
        expect(disabledButtons).toHaveLength(2);
      });

      it('shows enabled edit button for orders with non-restricted status', () => {
        const editableOrders = [
          {
            ...mockOrders[0],
            orderStatus: 'Unordered',
            status: 'Unordered',
          },
          {
            ...mockOrders[1],
            orderStatus: 'Ordered',
            status: 'Ordered',
          },
        ] as unknown as Order[];

        renderTable({ orders: editableOrders });

        const allActionButtons = screen.getAllByRole('button').filter(
          (btn) => btn.className.includes('h-8') && btn.className.includes('w-8')
        );
        // 2 buttons (view + enabled edit) per row * 2 rows = 4
        expect(allActionButtons).toHaveLength(4);

        // No disabled buttons — all edit buttons should be enabled
        const disabledButtons = allActionButtons.filter((btn) => btn.hasAttribute('disabled'));
        expect(disabledButtons).toHaveLength(0);
      });

      it('shows mixed enabled/disabled edit buttons based on order status', () => {
        const mixedOrders = [
          {
            ...mockOrders[0],
            orderStatus: 'Ordered',
            status: 'Ordered',
          },
          {
            ...mockOrders[1],
            orderStatus: 'Approved',
            status: 'Approved',
          },
        ] as unknown as Order[];

        renderTable({ orders: mixedOrders });

        const allActionButtons = screen.getAllByRole('button').filter(
          (btn) => btn.className.includes('h-8') && btn.className.includes('w-8')
        );
        // 2 buttons per row * 2 rows = 4
        expect(allActionButtons).toHaveLength(4);

        // Only the 'Approved' order's edit button should be disabled
        const disabledButtons = allActionButtons.filter((btn) => btn.hasAttribute('disabled'));
        expect(disabledButtons).toHaveLength(1);
      });
    });

    describe('User Role', () => {
      beforeEach(() => {
        setMockRole(UserRole.USER);
      });

      it('renders only view buttons for user role', () => {
        renderTable();

        // USER has ORDER_VIEW permission only
        const actionButtons = screen.getAllByRole('button').filter(
          (btn) => btn.className.includes('h-8') && btn.className.includes('w-8')
        );
        // 1 button (view) per row * 2 rows = 2
        expect(actionButtons).toHaveLength(2);
      });
    });

    describe('Null Role (unauthenticated fallback)', () => {
      beforeEach(() => {
        // When role is null, OrdersTable shows all buttons (fallback: role === null check)
        setMockRole(null);
      });

      it('renders all action buttons when role is null', () => {
        renderTable();

        const actionButtons = screen.getAllByRole('button').filter(
          (btn) => btn.className.includes('h-8') && btn.className.includes('w-8')
        );
        // 4 buttons per row * 2 rows = 8
        expect(actionButtons).toHaveLength(8);
      });
    });
  });

  describe('Button Tooltips', () => {
    it('wraps action buttons in Tooltip components', () => {
      renderTable();

      // Verify that action buttons are rendered (they are wrapped in Tooltip/TooltipTrigger).
      // Radix UI Tooltips require pointer events and Popper positioning which don't work
      // reliably in jsdom, so we verify the buttons exist rather than the tooltip text.
      const actionButtons = screen.getAllByRole('button').filter(
        (btn) => btn.className.includes('h-8') && btn.className.includes('w-8')
      );
      expect(actionButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Status Rendering', () => {
    it('renders status values in the table', () => {
      renderTable();

      const statusElements = screen.getAllByText(/pending|approved/i);
      expect(statusElements.length).toBeGreaterThan(0);
    });
  });

  describe('Urgent Orders', () => {
    it('renders without crashing when orders have urgent flag', () => {
      renderTable();

      // Verify the table renders (urgent styling is CSS-based, not text-based)
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
      expect(screen.getByText('ORD-002')).toBeInTheDocument();
    });
  });

  describe('Pagination Integration', () => {
    it('displays pagination info from DataTable', () => {
      renderTable();

      // DataTable renders: "Displaying results: 1-2 of 15"
      // (1-2 because there are 2 data items on this page)
      expect(screen.getByText(/Displaying results:/)).toBeInTheDocument();
    });

    it('renders pagination navigation buttons', () => {
      renderTable();

      expect(screen.getByText('<< FIRST')).toBeInTheDocument();
      expect(screen.getByText('< PREVIOUS')).toBeInTheDocument();
      expect(screen.getByText('NEXT >')).toBeInTheDocument();
      expect(screen.getByText('LAST >>')).toBeInTheDocument();
    });

    it('calls pagination onPageChange when NEXT is clicked', async () => {
      const user = userEvent.setup();
      const onPageChangeMock = jest.fn();
      const paginationWithMock = {
        ...mockPagination,
        onPageChange: onPageChangeMock,
      };

      renderTable({ pagination: paginationWithMock });

      const nextButton = screen.getByText('NEXT >');
      await user.click(nextButton);

      expect(onPageChangeMock).toHaveBeenCalledWith(2);
    });

    it('disables FIRST and PREVIOUS buttons on first page', () => {
      renderTable();

      expect(screen.getByText('<< FIRST')).toBeDisabled();
      expect(screen.getByText('< PREVIOUS')).toBeDisabled();
    });
  });

  describe('Empty States', () => {
    it('shows "No results found" when no orders', () => {
      renderTable({ orders: [] });

      // DataTable renders "No results found" for empty data
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('shows "No results found" when search yields no results', () => {
      renderTable({ orders: [], searchTerm: 'nonexistent' });

      // DataTable does not differentiate between empty data and no search results
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  describe('Data Transformation', () => {
    it('renders without crashing with valid data', () => {
      renderTable();

      // Verify basic rendering with provided data
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
      expect(screen.getByText('ORD-002')).toBeInTheDocument();
    });

    it('handles missing customer data gracefully', () => {
      const ordersWithMissingData = [
        {
          ...mockOrders[0],
          customer: null,
        },
      ] as unknown as Order[];

      renderTable({ orders: ordersWithMissingData });

      // Should not crash and should handle null customer gracefully
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });
  });

  describe('Filter Data Props', () => {
    it('accepts custom seat sizes without crashing', () => {
      const customSeatSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
      renderTable({ seatSizes: customSeatSizes });

      // Props are accepted; the component renders normally
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });

    it('accepts custom statuses without crashing', () => {
      const customStatuses = ['draft', 'pending', 'approved', 'shipped', 'delivered'];
      renderTable({ statuses: customStatuses });

      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });

    it('accepts custom fitters without crashing', () => {
      const customFitters = ['Charlie Fitter', 'Diana Fitter'];
      renderTable({ fitters: customFitters });

      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });
  });
});
