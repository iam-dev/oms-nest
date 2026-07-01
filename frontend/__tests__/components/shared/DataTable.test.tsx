import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '@/components/shared/DataTable';
import type { Column } from '@/components/shared/DataTable';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

interface MockData {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  count: number;
}

const mockData: MockData[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active', count: 10 },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive', count: 5 },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'active', count: 15 },
  { id: 4, name: 'Alice Brown', email: 'alice@example.com', status: 'inactive', count: 3 },
  { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', status: 'active', count: 8 },
];

const mockColumns: Column<MockData>[] = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: 'Name', maxWidth: '200px' },
  { key: 'email', title: 'Email' },
  {
    key: 'status',
    title: 'Status',
    render: (value: MockData['status']) => (
      <span className={`status-badge ${value}`}>
        {value?.toUpperCase()}
      </span>
    )
  },
  { key: 'count', title: 'Count' },
];

const mockPagination: PaginationProps = {
  currentPage: 1,
  totalPages: 3,
  onPageChange: jest.fn(),
  totalItems: 25,
  itemsPerPage: 10,
};

describe('DataTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders table with data and columns', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('renders custom column content using render function', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      const statusElements = screen.getAllByText('ACTIVE');
      expect(statusElements[0]).toHaveClass('status-badge active');

      const inactiveElements = screen.getAllByText('INACTIVE');
      expect(inactiveElements[0]).toHaveClass('status-badge inactive');
    });

    it('applies maxWidth styles to columns', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      const nameHeaders = screen.getAllByText('Name');
      const nameHeader = nameHeaders.find(el => el.tagName === 'TH');
      expect(nameHeader).toHaveStyle({ textOverflow: 'ellipsis', overflow: 'auto' });
    });
  });

  describe('Empty States', () => {
    it('renders empty state when no data provided', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={[]}
          pagination={mockPagination}
        />
      );

      expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('renders empty state message even with search term', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={[]}
          pagination={mockPagination}
          searchTerm="nonexistent"
        />
      );

      // Source always shows "No results found" regardless of searchTerm
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading spinner when loading is true', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={[]}
          pagination={mockPagination}
          loading={true}
        />
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('hides data when loading', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
          loading={true}
        />
      );

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('displays error message when error prop is provided', () => {
      const errorMessage = 'Failed to load data';
      render(
        <DataTable
          columns={mockColumns}
          data={[]}
          pagination={mockPagination}
          error={errorMessage}
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('hides data when error occurs', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
          error="Something went wrong"
        />
      );

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('renders search input with custom placeholder', () => {
      const placeholder = 'Search users...';
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
          onSearch={jest.fn()}
          searchPlaceholder={placeholder}
        />
      );

      expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
    });

    it('calls onSearch when search input changes', async () => {
      const user = userEvent.setup();
      const onSearchMock = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
          onSearch={onSearchMock}
          searchPlaceholder="Search..."
        />
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'john');

      // onSearch is called on every change event (no debounce)
      // Since the input is controlled by searchTerm prop (empty string),
      // each keystroke produces a single character in the change event
      expect(onSearchMock).toHaveBeenCalledTimes(4);
      expect(onSearchMock).toHaveBeenNthCalledWith(1, 'j');
      expect(onSearchMock).toHaveBeenNthCalledWith(2, 'o');
      expect(onSearchMock).toHaveBeenNthCalledWith(3, 'h');
      expect(onSearchMock).toHaveBeenNthCalledWith(4, 'n');
    });

    it('calls onSearch on each keystroke (no debounce)', async () => {
      const user = userEvent.setup();
      const onSearchMock = jest.fn();

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
          onSearch={onSearchMock}
          searchPlaceholder="Search..."
        />
      );

      const searchInput = screen.getByPlaceholderText('Search...');

      await user.type(searchInput, 'john');

      // onSearch is called for each keystroke since there is no debounce
      expect(onSearchMock).toHaveBeenCalledTimes(4);
    });

    it('displays current search term in input', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
          onSearch={jest.fn()}
          searchTerm="existing search"
          searchPlaceholder="Search..."
        />
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      expect(searchInput).toHaveValue('existing search');
    });

    it('does not render search input when onSearch is not provided', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
          searchPlaceholder="Search..."
        />
      );

      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('renders pagination controls', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      expect(screen.getByText('<< FIRST')).toBeInTheDocument();
      expect(screen.getByText('< PREVIOUS')).toBeInTheDocument();
      expect(screen.getByText('NEXT >')).toBeInTheDocument();
      expect(screen.getByText('LAST >>')).toBeInTheDocument();
    });

    it('displays results info with item range and total', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      // Source format: "Displaying results: {start}-{end} of {total}"
      // With 5 items on page 1 with itemsPerPage=10: "Displaying results: 1-5 of 25"
      expect(screen.getByText('Displaying results: 1-5 of 25')).toBeInTheDocument();
    });

    it('calls onPageChange when First button is clicked', async () => {
      const user = userEvent.setup();
      const onPageChangeMock = jest.fn();
      const pagination = { ...mockPagination, currentPage: 2, onPageChange: onPageChangeMock };

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={pagination}
        />
      );

      await user.click(screen.getByText('<< FIRST'));
      expect(onPageChangeMock).toHaveBeenCalledWith(1);
    });

    it('calls onPageChange when Previous button is clicked', async () => {
      const user = userEvent.setup();
      const onPageChangeMock = jest.fn();
      const pagination = { ...mockPagination, currentPage: 2, onPageChange: onPageChangeMock };

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={pagination}
        />
      );

      await user.click(screen.getByText('< PREVIOUS'));
      expect(onPageChangeMock).toHaveBeenCalledWith(1);
    });

    it('calls onPageChange when Next button is clicked', async () => {
      const user = userEvent.setup();
      const onPageChangeMock = jest.fn();
      const pagination = { ...mockPagination, onPageChange: onPageChangeMock };

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={pagination}
        />
      );

      await user.click(screen.getByText('NEXT >'));
      expect(onPageChangeMock).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange when Last button is clicked', async () => {
      const user = userEvent.setup();
      const onPageChangeMock = jest.fn();
      const pagination = { ...mockPagination, onPageChange: onPageChangeMock };

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={pagination}
        />
      );

      await user.click(screen.getByText('LAST >>'));
      expect(onPageChangeMock).toHaveBeenCalledWith(3);
    });

    it('disables First and Previous buttons on first page', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      expect(screen.getByText('<< FIRST')).toBeDisabled();
      expect(screen.getByText('< PREVIOUS')).toBeDisabled();
    });

    it('disables Next and Last buttons on last page', () => {
      const pagination = { ...mockPagination, currentPage: 3 };
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={pagination}
        />
      );

      expect(screen.getByText('NEXT >')).toBeDisabled();
      expect(screen.getByText('LAST >>')).toBeDisabled();
    });
  });

  describe('Action Buttons', () => {
    it('renders action buttons when renderActions is provided', () => {
      const renderActions = (item: MockData) => (
        <div>
          <button>Edit {item.name}</button>
          <button>Delete {item.name}</button>
        </div>
      );

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
          renderActions={renderActions}
        />
      );

      expect(screen.getByText('Edit John Doe')).toBeInTheDocument();
      expect(screen.getByText('Delete John Doe')).toBeInTheDocument();
      expect(screen.getByText('Edit Jane Smith')).toBeInTheDocument();
    });

    it('renders OPTIONS column header when renderActions is provided', () => {
      const renderActions = (item: MockData) => (
        <div>
          <button>Edit {item.name}</button>
        </div>
      );

      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
          renderActions={renderActions}
        />
      );

      expect(screen.getByText('OPTIONS')).toBeInTheDocument();
    });

    it('does not render OPTIONS column when renderActions is not provided', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      expect(screen.queryByText('OPTIONS')).not.toBeInTheDocument();
    });
  });

  describe('Table Structure', () => {
    it('applies correct CSS classes to container', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      const tableContainer = screen.getByRole('table').closest('div');
      expect(tableContainer).toHaveClass('overflow-auto');
    });

    it('renders sticky header cells', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      // sticky and top-0 are on individual <th> elements, not <thead>
      const headerCells = screen.getAllByRole('columnheader');
      headerCells.forEach(cell => {
        expect(cell).toHaveClass('sticky');
        expect(cell).toHaveClass('top-0');
      });
    });

    it('applies row striping on odd-indexed rows', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      const tableBody = screen.getByRole('table').querySelector('tbody');
      const rows = tableBody?.querySelectorAll('tr');

      // Row at index 0: no striping class
      expect(rows?.[0]).not.toHaveClass('even:bg-gray-50');
      // Row at index 1 (odd): has even:bg-gray-50 class
      expect(rows?.[1]).toHaveClass('even:bg-gray-50');
    });
  });

  describe('Responsive Behavior', () => {
    it('handles overflow with scroll', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      const container = screen.getByRole('table').closest('.overflow-auto');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper table structure', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(5);
      expect(screen.getAllByRole('row')).toHaveLength(6); // 1 header + 5 data rows
    });

    it('provides accessible pagination controls', () => {
      render(
        <DataTable
          columns={mockColumns}
          data={mockData}
          pagination={mockPagination}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.some(btn => btn.textContent === '<< FIRST')).toBe(true);
      expect(buttons.some(btn => btn.textContent === '< PREVIOUS')).toBe(true);
      expect(buttons.some(btn => btn.textContent === 'NEXT >')).toBe(true);
      expect(buttons.some(btn => btn.textContent === 'LAST >>')).toBe(true);
    });
  });
});
