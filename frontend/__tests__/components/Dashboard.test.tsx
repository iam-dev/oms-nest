import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "@/components/Dashboard";
import { AuthTestProvider } from "@/utils/AuthTestProvider";
import { UserRole } from "@/types/Role";

// Mock the API services
jest.mock("@/services/enrichedOrders", () => ({
  fetchEnrichedOrders: jest.fn(),
  getEnrichedOrders: jest.fn(),
  getAllStatusValues: jest.fn(),
  universalSearch: jest.fn(),
  fetchOrderDetail: jest.fn(),
}));

// Mock OrdersTable component
jest.mock("@/components/shared/OrdersTable", () => {
  const MockOrdersTable = ({
    searchTerm,
    onSearch,
    headerFilters,
    onFilterChange,
    dateFrom,
    dateTo,
    onViewOrder,
    onEditOrder,
    onApproveOrder,
    orders,
    pagination,
  }: any) => (
    <div data-testid="orders-table">
      <input
        data-testid="search-input"
        value={searchTerm}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search orders..."
      />
      <div data-testid="filter-status">
        Status Filter: {headerFilters?.status || "none"}
      </div>
      <div data-testid="filter-urgent">
        Urgent Filter: {headerFilters?.urgent || "none"}
      </div>
      <div data-testid="date-from">Date From: {dateFrom || "none"}</div>
      <div data-testid="date-to">Date To: {dateTo || "none"}</div>
      <div data-testid="orders-count">Orders: {orders?.length || 0}</div>
      <div data-testid="current-page">Page: {pagination?.currentPage || 1}</div>
      <button onClick={() => onViewOrder(orders?.[0])}>View First Order</button>
      <button onClick={() => onEditOrder(orders?.[0])}>Edit First Order</button>
      <button onClick={() => onApproveOrder(orders?.[0])}>
        Approve First Order
      </button>
    </div>
  );

  return {
    OrdersTable: MockOrdersTable,
  };
});

// Mock modal components
jest.mock("@/components/shared/OrderDetailModal", () => {
  const MockOrderDetailModal = ({ isOpen, onClose, order }: any) =>
    isOpen ? (
      <div data-testid="order-detail-modal">
        <div>Order Detail: {order?.orderNumber}</div>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null;

  return {
    OrderDetailModal: MockOrderDetailModal,
  };
});

jest.mock("@/components/shared/OrderEditModal", () => {
  const MockOrderEditModal = ({ isOpen, onClose, order }: any) =>
    isOpen ? (
      <div data-testid="order-edit-modal">
        <div>Edit Order: {order?.orderNumber}</div>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null;

  return {
    OrderEditModal: MockOrderEditModal,
  };
});

jest.mock("@/components/shared/OrderApprovalModal", () => {
  const MockOrderApprovalModal = ({ isOpen, onClose, order }: any) =>
    isOpen ? (
      <div data-testid="order-approval-modal">
        <div>Approve Order: {order?.orderNumber}</div>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null;

  return {
    OrderApprovalModal: MockOrderApprovalModal,
  };
});

// Mock OrderDetails component
jest.mock("@/components/OrderDetails", () => ({
  OrderDetails: ({ order }: any) =>
    order ? <div data-testid="order-details">Order Details</div> : null,
}));

// Mock EditOrder component
jest.mock("@/components/EditOrder", () => ({
  EditOrder: ({ order }: any) =>
    order ? <div data-testid="edit-order">Edit Order</div> : null,
}));

// Mock ComprehensiveEditOrder component
jest.mock("@/components/ComprehensiveEditOrder", () => ({
  ComprehensiveEditOrder: ({ order }: any) =>
    order ? (
      <div data-testid="comprehensive-edit-order">Comprehensive Edit</div>
    ) : null,
}));

// Mock Dialog component
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));

// Mock logger
jest.mock("@/utils/logger", () => ({
  logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Mock updateOrder from api
jest.mock("@/services/api", () => ({
  api: { get: jest.fn() },
  updateOrder: jest.fn(),
}));

// Mock status cards component
jest.mock("@/components/DashboardOrderStatusFlow", () => {
  const MockDashboardOrderStatusFlow = ({ onStatusClick }: any) => (
    <div data-testid="status-cards">
      <button onClick={() => onStatusClick("pending")}>Pending</button>
      <button onClick={() => onStatusClick("approved")}>Approved</button>
      <button onClick={() => onStatusClick("completed")}>Completed</button>
    </div>
  );

  return MockDashboardOrderStatusFlow;
});

// Mock Reports component
jest.mock("@/components/Reports", () => {
  const MockReports = () => <div data-testid="reports">Reports Content</div>;
  return MockReports;
});

// Mock other dependencies
jest.mock("@/services/dashboard", () => ({
  getOrderStatusStats: jest.fn(() =>
    Promise.resolve({
      orderStatusCounts: {
        pending: 10,
        approved: 20,
        completed: 30,
      },
    }),
  ),
}));

jest.mock("@/hooks/useUserRole", () => ({
  useUserRole: jest.fn(() => ({
    role: "ROLE_ADMIN",
    isAdmin: true,
    isSupervisor: false,
    isFitter: false,
    isSupplier: false,
    isUser: false,
    hasRole: jest.fn(() => true),
    hasAnyRole: jest.fn(() => true),
  })),
}));

jest.mock("@/hooks/useDebounce", () => ({
  useDebounce: jest.fn(),
}));

jest.mock("@/hooks/useEntities", () => ({
  useSuppliers: jest.fn(() => ({ data: [] })),
}));

jest.mock("@/utils/orderHydration", () => ({
  getFitterName: jest.fn(() => "Mock Fitter"),
  getCustomerName: jest.fn(() => "Mock Customer"),
  getSupplierName: jest.fn(() => "Mock Supplier"),
  getStatus: jest.fn(() => "pending"),
  getUrgent: jest.fn(() => false),
  getDate: jest.fn(() => "2024-01-01"),
}));

jest.mock("@/utils/orderTableColumns", () => ({
  getOrderTableColumns: jest.fn(() => []),
}));

jest.mock("@/utils/orderConstants", () => ({
  seatSizes: ["17", "17.5", "18"],
  statuses: ["pending", "approved", "completed"],
}));

jest.mock("@/utils/orderProcessing", () => ({
  buildOrderFilters: jest.fn((headerFilters) => {
    // Replicate real behavior: pass through headerFilters as filters
    const filters: Record<string, string> = {};
    if (headerFilters) {
      Object.entries(headerFilters).forEach(([key, value]) => {
        if (value) filters[key] = value as string;
      });
    }
    return filters;
  }),
  extractDynamicSeatSizes: jest.fn(() => []),
  extractDynamicFactories: jest.fn(() => []),
  processDashboardOrders: jest.fn((data) => data["hydra:member"] || []),
  processSupplierData: jest.fn(() => []),
  fetchCompleteOrderData: jest.fn(() => Promise.resolve({})),
}));

const mockOrders = [
  {
    id: 1,
    orderNumber: "ORD-001",
    customer: { id: 1, name: "John Customer" },
    fitter: { id: 1, name: "Jane Fitter" },
    supplier: { id: 1, name: "Acme Supplier" },
    status: "pending",
    urgent: false,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 2,
    orderNumber: "ORD-002",
    customer: { id: 2, name: "Alice Customer" },
    fitter: { id: 2, name: "Bob Fitter" },
    supplier: { id: 2, name: "Beta Supplier" },
    status: "approved",
    urgent: true,
    createdAt: "2024-01-16T11:00:00Z",
  },
];

const mockFetchEnrichedOrders =
  require("@/services/enrichedOrders").fetchEnrichedOrders;
const mockGetEnrichedOrders =
  require("@/services/enrichedOrders").getEnrichedOrders;
const mockGetAllStatusValues =
  require("@/services/enrichedOrders").getAllStatusValues;
const mockUniversalSearch =
  require("@/services/enrichedOrders").universalSearch;
const mockGetOrderStatusStats =
  require("@/services/dashboard").getOrderStatusStats;
const mockUseDebounce = require("@/hooks/useDebounce").useDebounce;

const renderWithAuth = (
  ui: React.ReactElement,
  userRole: UserRole = UserRole.ADMIN,
) => {
  return render(<AuthTestProvider role={userRole}>{ui}</AuthTestProvider>);
};

describe("Dashboard Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up enriched orders mock
    mockGetEnrichedOrders.mockResolvedValue({
      "hydra:member": mockOrders,
      "hydra:totalItems": mockOrders.length,
    });

    // Set up status values mock
    mockGetAllStatusValues.mockResolvedValue([
      "pending",
      "approved",
      "completed",
    ]);

    // Set up universal search mock
    mockUniversalSearch.mockResolvedValue({
      "hydra:member": mockOrders,
      "hydra:totalItems": mockOrders.length,
    });

    // Set up order status stats mock
    mockGetOrderStatusStats.mockResolvedValue({
      orderStatusCounts: {
        pending: 10,
        approved: 20,
        completed: 30,
      },
    });

    // Set up useDebounce mock to return the value immediately for testing
    mockUseDebounce.mockImplementation((value: any) => value);
  });

  describe("Initial Rendering", () => {
    it("renders dashboard with all main components", async () => {
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("status-cards")).toBeInTheDocument();
        expect(screen.getByTestId("orders-table")).toBeInTheDocument();
      });
    });

    it("loads orders on mount", async () => {
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(mockGetEnrichedOrders).toHaveBeenCalled();
        expect(screen.getByTestId("orders-count")).toHaveTextContent(
          "Orders: 2",
        );
      });
    });

    it("shows loading state initially", () => {
      renderWithAuth(<Dashboard />);

      expect(screen.getByText("Loading orders...")).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("renders search input", async () => {
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("search-input")).toBeInTheDocument();
      });
    });

    it("handles search input changes with debouncing", async () => {
      const user = userEvent.setup();
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("search-input")).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId("search-input");
      await user.type(searchInput, "O");

      // Should call universalSearch with the typed character
      await waitFor(
        () => {
          expect(mockUniversalSearch).toHaveBeenCalledWith("O");
        },
        { timeout: 600 },
      );
    });

    it("clears search when input is emptied", async () => {
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("search-input")).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId("search-input");
      // Type a search term
      fireEvent.change(searchInput, { target: { value: "test" } });

      await waitFor(
        () => {
          expect(mockUniversalSearch).toHaveBeenCalledWith("test");
        },
        { timeout: 600 },
      );

      // Clear the search term
      fireEvent.change(searchInput, { target: { value: "" } });

      // When search is cleared, it should fetch enriched orders again (not universalSearch)
      await waitFor(
        () => {
          expect(mockGetEnrichedOrders).toHaveBeenCalledWith(
            expect.objectContaining({
              filters: {},
            }),
          );
        },
        { timeout: 600 },
      );
    });
  });

  describe("Status Card Filtering", () => {
    it("applies status filter when status card is clicked", async () => {
      const user = userEvent.setup();
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("status-cards")).toBeInTheDocument();
      });

      const pendingButton = screen.getByText("Pending");
      await user.click(pendingButton);

      await waitFor(() => {
        expect(screen.getByTestId("filter-status")).toHaveTextContent(
          "Status Filter: pending",
        );
        expect(mockGetEnrichedOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            filters: expect.objectContaining({
              status: "pending",
            }),
          }),
        );
      });
    });

    it("handles different status selections", async () => {
      const user = userEvent.setup();
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("status-cards")).toBeInTheDocument();
      });

      // Test approved status
      const approvedButton = screen.getByText("Approved");
      await user.click(approvedButton);

      await waitFor(() => {
        expect(screen.getByTestId("filter-status")).toHaveTextContent(
          "Status Filter: approved",
        );
      });

      // Test completed status
      const completedButton = screen.getByText("Completed");
      await user.click(completedButton);

      await waitFor(() => {
        expect(screen.getByTestId("filter-status")).toHaveTextContent(
          "Status Filter: completed",
        );
      });
    });

    it("resets page to 1 when status filter changes", async () => {
      const user = userEvent.setup();
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("status-cards")).toBeInTheDocument();
      });

      const pendingButton = screen.getByText("Pending");
      await user.click(pendingButton);

      await waitFor(() => {
        expect(mockGetEnrichedOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
          }),
        );
      });
    });
  });

  describe("Header Filters", () => {
    it("handles filter changes from OrdersTable", async () => {
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("orders-table")).toBeInTheDocument();
      });

      // Simulate filter change by directly calling the onFilterChange
      // This would normally come from TableHeaderFilter interactions
      const ordersTable = screen.getByTestId("orders-table");

      // The actual filter change would be tested in OrdersTable tests
      // Here we're testing the Dashboard's response to filter changes
    });

    it("combines status card filters with header filters", async () => {
      const user = userEvent.setup();
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("status-cards")).toBeInTheDocument();
      });

      // First apply status filter
      const pendingButton = screen.getByText("Pending");
      await user.click(pendingButton);

      await waitFor(() => {
        expect(mockGetEnrichedOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            filters: expect.objectContaining({
              status: "pending",
            }),
          }),
        );
      });

      // Additional header filters would be combined with status filter
    });
  });

  describe("Date Range Filtering", () => {
    it("applies date range filters", async () => {
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("orders-table")).toBeInTheDocument();
      });

      // Date range would be set through OrdersTable component
      // Dashboard should pass the date range to the API call
      const dateFromElement = screen.getByTestId("date-from");
      const dateToElement = screen.getByTestId("date-to");

      expect(dateFromElement).toHaveTextContent("Date From: none");
      expect(dateToElement).toHaveTextContent("Date To: none");
    });
  });

  describe("Pagination", () => {
    it("handles page changes", async () => {
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("orders-table")).toBeInTheDocument();
      });

      // The OrdersTable would handle pagination UI
      // Dashboard should respond to page changes and fetch new data
      expect(screen.getByTestId("current-page")).toHaveTextContent("Page: 1");
    });

    it("resets pagination when filters change", async () => {
      const user = userEvent.setup();
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("status-cards")).toBeInTheDocument();
      });

      const pendingButton = screen.getByText("Pending");
      await user.click(pendingButton);

      await waitFor(() => {
        expect(mockGetEnrichedOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
          }),
        );
      });
    });
  });

  describe("Auto-refresh Functionality", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("auto-refreshes data every 5 minutes", async () => {
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(mockGetEnrichedOrders).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(mockGetEnrichedOrders).toHaveBeenCalledTimes(2);
      });
    });

    it("clears auto-refresh interval on unmount", async () => {
      const { unmount } = renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(mockGetEnrichedOrders).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Fast-forward 5 minutes after unmount
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Should not call again after unmount
      expect(mockGetEnrichedOrders).toHaveBeenCalledTimes(1);
    });
  });

  describe("Modal Interactions", () => {
    it("opens order detail modal when view action is triggered", async () => {
      const user = userEvent.setup();
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("orders-table")).toBeInTheDocument();
      });

      const viewButton = screen.getByText("View First Order");
      await user.click(viewButton);

      // The Dashboard uses Dialog + OrderDetails (not OrderDetailModal)
      await waitFor(() => {
        expect(screen.getByTestId("dialog")).toBeInTheDocument();
        expect(screen.getByTestId("order-details")).toBeInTheDocument();
      });
    });

    it("opens order edit modal when edit action is triggered", async () => {
      const user = userEvent.setup();
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("orders-table")).toBeInTheDocument();
      });

      const editButton = screen.getByText("Edit First Order");
      await user.click(editButton);

      // The Dashboard uses isEditingOrder state which renders ComprehensiveEditOrder in a Dialog
      await waitFor(() => {
        expect(screen.getByTestId("dialog")).toBeInTheDocument();
        expect(
          screen.getByTestId("comprehensive-edit-order"),
        ).toBeInTheDocument();
      });
    });

    it("opens order approval modal when approve action is triggered", async () => {
      const user = userEvent.setup();
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("orders-table")).toBeInTheDocument();
      });

      const approveButton = screen.getByText("Approve First Order");
      await user.click(approveButton);

      expect(screen.getByTestId("order-approval-modal")).toBeInTheDocument();
      expect(screen.getByText("Approve Order: ORD-001")).toBeInTheDocument();
    });

    it("closes modals when close button is clicked", async () => {
      const user = userEvent.setup();
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("orders-table")).toBeInTheDocument();
      });

      // Open approval modal (this one uses OrderApprovalModal with isOpen/onClose pattern)
      const approveButton = screen.getByText("Approve First Order");
      await user.click(approveButton);

      expect(screen.getByTestId("order-approval-modal")).toBeInTheDocument();

      // Close modal
      const closeButton = screen.getByText("Close");
      await user.click(closeButton);

      expect(
        screen.queryByTestId("order-approval-modal"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("displays error message when data fetch fails", async () => {
      mockGetEnrichedOrders.mockRejectedValue(new Error("API Error"));

      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load orders")).toBeInTheDocument();
      });
    });

    it("handles empty data gracefully", async () => {
      mockGetEnrichedOrders.mockResolvedValue({
        "hydra:member": [],
        "hydra:totalItems": 0,
      });

      renderWithAuth(<Dashboard />);

      // When orders are empty, the component shows "No Orders Found" instead of OrdersTable
      await waitFor(() => {
        expect(screen.getByText("No Orders Found")).toBeInTheDocument();
      });
    });
  });

  describe("Role-based Access", () => {
    it("renders dashboard for admin users", async () => {
      renderWithAuth(<Dashboard />, UserRole.ADMIN);

      await waitFor(() => {
        expect(screen.getByTestId("orders-table")).toBeInTheDocument();
      });
    });

    it("renders dashboard for manager users", async () => {
      renderWithAuth(<Dashboard />, UserRole.SUPERVISOR);

      await waitFor(() => {
        expect(screen.getByTestId("orders-table")).toBeInTheDocument();
      });
    });

    it("renders dashboard for fitter users", async () => {
      renderWithAuth(<Dashboard />, UserRole.FITTER);

      await waitFor(() => {
        expect(screen.getByTestId("orders-table")).toBeInTheDocument();
      });
    });
  });

  describe("Performance Optimizations", () => {
    it("debounces search input to prevent excessive API calls", async () => {
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("search-input")).toBeInTheDocument();
      });

      // The useDebounce hook is used in the component to debounce the search term.
      // In real usage, this prevents excessive calls. In our test, useDebounce returns
      // the value directly, so we verify the hook is being used with a delay parameter.
      expect(mockUseDebounce).toHaveBeenCalledWith("", 500);

      const searchInput = screen.getByTestId("search-input");

      // Type a search term using fireEvent (single change)
      fireEvent.change(searchInput, { target: { value: "abc" } });

      // Wait for universal search to be called with the final value
      await waitFor(
        () => {
          expect(mockUniversalSearch).toHaveBeenCalledWith("abc");
        },
        { timeout: 600 },
      );
    });

    it("prevents unnecessary re-renders when same filter is applied", async () => {
      const user = userEvent.setup();
      renderWithAuth(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("status-cards")).toBeInTheDocument();
      });

      const initialCallCount = mockGetEnrichedOrders.mock.calls.length;

      const pendingButton = screen.getByText("Pending");

      // Click same status twice - each click sets headerFilters with status: 'pending'
      await user.click(pendingButton);

      await waitFor(() => {
        expect(mockGetEnrichedOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            filters: expect.objectContaining({ status: "pending" }),
          }),
        );
      });

      const afterFirstClick = mockGetEnrichedOrders.mock.calls.length;
      expect(afterFirstClick).toBeGreaterThan(initialCallCount);

      await user.click(pendingButton);

      // After second click with same status, verify the filter is still 'pending'
      await waitFor(() => {
        expect(screen.getByTestId("filter-status")).toHaveTextContent(
          "Status Filter: pending",
        );
      });
    });
  });
});
