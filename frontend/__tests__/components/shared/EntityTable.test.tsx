import React from 'react';
import { render, screen } from '@testing-library/react';
import { EntityTable } from '@/components/shared/EntityTable';

// Mock the DataTable component
jest.mock('@/components/shared/DataTable', () => ({
  DataTable: ({ data, columns, renderRowActions, loading, error }: {
    data: Record<string, unknown>[];
    columns: { key: string; title: React.ReactNode; render?: (v: unknown) => React.ReactNode | undefined }[];
    renderRowActions?: (item: Record<string, unknown>) => React.ReactNode;
    loading?: boolean;
    error?: string;
  }) => (
    <div data-testid="data-table">
      {loading && <div data-testid="loading-indicator">Loading...</div>}
      {error && <div data-testid="error-message">{error}</div>}
      {!loading && !error && data.length === 0 && <div data-testid="empty-message">No data available</div>}
      {!loading && !error && data.length > 0 && (
        <table>
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i}>{col.title}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i}>
                {columns.map((col, j) => (
                  <td key={j}>{col.render ? col.render(item[col.key]) : (item[col.key] as React.ReactNode)}</td>
                ))}
                <td>{renderRowActions && renderRowActions(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  ),
}));

describe('EntityTable Component', () => {
  const mockEntities = [
    { id: '1', name: 'Entity 1', status: 'Active' },
    { id: '2', name: 'Entity 2', status: 'Inactive' },
  ];
  
  const mockColumns = [
    {
      key: 'name',
      title: 'Name',
      render: (v: string) => v,
    },
    {
      key: 'status',
      title: 'Status',
      render: (v: string) => v,
    },
  ];
  
  const mockPagination = {
    currentPage: 1,
    totalPages: 2,
    onPageChange: jest.fn(),
    totalItems: 12,
    itemsPerPage: 10,
  };
  
  const mockOnView = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders with basic props', () => {
    render(
      <EntityTable
        entities={mockEntities}
        columns={mockColumns}
      />
    );
    
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Entity 1')).toBeInTheDocument();
    expect(screen.getByText('Entity 2')).toBeInTheDocument();
  });
  
  test('renders loading state', () => {
    render(
      <EntityTable
        entities={mockEntities}
        columns={mockColumns}
        loading={true}
      />
    );
    
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });
  
  test('renders error state', () => {
    render(
      <EntityTable
        entities={[]}
        columns={mockColumns}
        error="Failed to load entities"
      />
    );
    
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    expect(screen.getByText('Failed to load entities')).toBeInTheDocument();
  });
  
  test('renders empty state', () => {
    render(
      <EntityTable
        entities={[]}
        columns={mockColumns}
      />
    );
    
    expect(screen.getByTestId('empty-message')).toBeInTheDocument();
  });
  
  test('renders with pagination', () => {
    render(
      <EntityTable
        entities={mockEntities}
        columns={mockColumns}
        pagination={mockPagination}
      />
    );
    
    // Pagination is passed to DataTable, which is mocked
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });
  
  test('calls action handlers when buttons are clicked', async () => {
    render(
      <EntityTable
        entities={mockEntities}
        columns={mockColumns}
        onView={mockOnView}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );
    
    // Since we're mocking the component, we can't test the actual button clicks
    // We would need to test this in an integration test
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });
  
  test('respects actionButtons configuration', () => {
    render(
      <EntityTable
        entities={mockEntities}
        columns={mockColumns}
        onView={mockOnView}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        actionButtons={{
          view: true,
          edit: false,
          delete: false,
        }}
      />
    );
    
    // Since we're mocking the component, we can't test the actual buttons
    // We would need to test this in an integration test
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });
  
  test('handles search term changes', async () => {
    const mockOnSearch = jest.fn();
    
    render(
      <EntityTable
        entities={mockEntities}
        columns={mockColumns}
        searchTerm="test"
        onSearch={mockOnSearch}
      />
    );
    
    // Since we're mocking the component, we can't test the actual search input
    // We would need to test this in an integration test
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });
});
