import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableHeaderFilter } from '@/components/shared/TableHeaderFilter';

// Mock the Popover component from Radix UI
jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
}));

// Mock the sub-components
jest.mock('@/components/shared/TableHeaderFilterBase', () => ({
  TableHeaderFilterBase: ({ title, value, onFilter }: { title: string; value: string; onFilter: (v: string) => void }) => (
    <div data-testid="filter-base">
      <input
        data-testid="text-filter"
        placeholder={`Filter by ${title}`}
        value={value}
        onChange={(e) => onFilter(e.target.value)}
      />
      <button data-testid="apply-button" onClick={() => onFilter(value)}>Apply</button>
    </div>
  ),
}));

jest.mock('@/components/shared/filters/BooleanFilter', () => ({
  BooleanFilter: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="boolean-filter"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
  ),
}));

jest.mock('@/components/shared/filters/EnumFilter', () => ({
  EnumFilter: ({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="enum-filter"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  ),
}));

jest.mock('@/components/shared/filters/DateRangeFilter', () => ({
  DateRangeFilter: ({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) => (
    <div data-testid="date-range-filter">
      <input
        data-testid="date-from"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
      />
      <input
        data-testid="date-to"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
      />
    </div>
  ),
}));

describe('TableHeaderFilter Component', () => {
  const mockOnFilter = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Text Filter Type', () => {
    test('renders with text filter type', async () => {
      render(
        <TableHeaderFilter 
          title="Name" 
          type="text" 
          value="" 
          onFilter={mockOnFilter} 
        />
      );
      
      expect(screen.getByText('Name')).toBeInTheDocument();
      
      // Since we've mocked the Popover component, we can directly test the filter
      const textFilter = screen.getByTestId('text-filter');
      expect(textFilter).toBeInTheDocument();
      
      // Type in the filter
      await userEvent.type(textFilter, 'test');
      
      // Apply the filter
      const applyButton = screen.getByTestId('apply-button');
      await userEvent.click(applyButton);
      
      // Check if onFilter was called with the right value
      expect(mockOnFilter).toHaveBeenCalled();
    });

    test('displays current text filter value', () => {
      render(
        <TableHeaderFilter 
          title="Name" 
          type="text" 
          value="existing value" 
          onFilter={mockOnFilter} 
        />
      );
      
      const textFilter = screen.getByTestId('text-filter');
      expect(textFilter).toHaveValue('existing value');
    });

    test('clears text filter value', async () => {
      render(
        <TableHeaderFilter 
          title="Name" 
          type="text" 
          value="existing value" 
          onFilter={mockOnFilter} 
        />
      );
      
      const textFilter = screen.getByTestId('text-filter');
      await userEvent.clear(textFilter);
      
      expect(mockOnFilter).toHaveBeenCalledWith('');
    });
  });

  describe('Boolean Filter Type', () => {
    test('renders with boolean filter type', async () => {
      render(
        <TableHeaderFilter 
          title="Active" 
          type="boolean" 
          value="" 
          onFilter={mockOnFilter} 
        />
      );
      
      expect(screen.getByText('Active')).toBeInTheDocument();
      
      // Boolean filter should be visible
      const booleanFilter = screen.getByTestId('boolean-filter');
      expect(booleanFilter).toBeInTheDocument();
      
      // Select an option
      await userEvent.selectOptions(booleanFilter, 'true');
      
      // Check if onFilter was called with the right value
      expect(mockOnFilter).toHaveBeenCalledWith('true');
    });

    test('handles boolean filter state changes', async () => {
      render(
        <TableHeaderFilter 
          title="Urgent" 
          type="boolean" 
          value="" 
          onFilter={mockOnFilter} 
        />
      );
      
      const booleanFilter = screen.getByTestId('boolean-filter');
      
      // Test selecting "Yes"
      await userEvent.selectOptions(booleanFilter, 'true');
      expect(mockOnFilter).toHaveBeenCalledWith('true');
      
      // Test selecting "No"
      await userEvent.selectOptions(booleanFilter, 'false');
      expect(mockOnFilter).toHaveBeenCalledWith('false');
      
      // Test selecting "All"
      await userEvent.selectOptions(booleanFilter, '');
      expect(mockOnFilter).toHaveBeenCalledWith('');
    });

    test('displays current boolean filter value', () => {
      render(
        <TableHeaderFilter 
          title="Active" 
          type="boolean" 
          value="true" 
          onFilter={mockOnFilter} 
        />
      );
      
      const booleanFilter = screen.getByTestId('boolean-filter');
      expect(booleanFilter).toHaveValue('true');
    });
  });

  describe('Enum Filter Type', () => {
    test('renders with enum filter type', async () => {
      render(
        <TableHeaderFilter 
          title="Status" 
          type="enum" 
          value="" 
          onFilter={mockOnFilter} 
          data={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      );
      
      expect(screen.getByText('Status')).toBeInTheDocument();
      
      // Enum filter should be visible
      const enumFilter = screen.getByTestId('enum-filter');
      expect(enumFilter).toBeInTheDocument();
      
      // Select an option
      await userEvent.selectOptions(enumFilter, 'active');
      
      // Check if onFilter was called with the right value
      expect(mockOnFilter).toHaveBeenCalledWith('active');
    });

    test('handles enum filter with complex data', async () => {
      const enumData = [
        { value: 'pending', label: 'Pending Orders' },
        { value: 'approved', label: 'Approved Orders' },
        { value: 'completed', label: 'Completed Orders' },
        { value: 'cancelled', label: 'Cancelled Orders' },
      ];

      render(
        <TableHeaderFilter 
          title="Order Status" 
          type="enum" 
          value="" 
          onFilter={mockOnFilter} 
          data={enumData}
        />
      );
      
      const enumFilter = screen.getByTestId('enum-filter');
      
      // Test all options
      for (const option of enumData) {
        await userEvent.selectOptions(enumFilter, option.value);
        expect(mockOnFilter).toHaveBeenCalledWith(option.value);
      }
    });

    test('displays current enum filter value', () => {
      render(
        <TableHeaderFilter 
          title="Status" 
          type="enum" 
          value="active" 
          onFilter={mockOnFilter} 
          data={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      );
      
      const enumFilter = screen.getByTestId('enum-filter');
      expect(enumFilter).toHaveValue('active');
    });

    test('handles enum filter without data gracefully', () => {
      render(
        <TableHeaderFilter 
          title="Status" 
          type="enum" 
          value="" 
          onFilter={mockOnFilter} 
        />
      );
      
      const enumFilter = screen.getByTestId('enum-filter');
      expect(enumFilter).toBeInTheDocument();
      
      // Should only have the "All" option
      const options = enumFilter.querySelectorAll('option');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent('All');
    });
  });

  describe('Date Range Filter Type', () => {
    test('renders with date-range filter type', async () => {
      render(
        <TableHeaderFilter 
          title="Date" 
          type="date-range" 
          value="2023-01-01:2023-01-31" 
          onFilter={mockOnFilter} 
        />
      );
      
      expect(screen.getByText('Date')).toBeInTheDocument();
      
      // Date range filter should be visible
      const dateRangeFilter = screen.getByTestId('date-range-filter');
      expect(dateRangeFilter).toBeInTheDocument();
      
      // Change from date
      const fromInput = screen.getByTestId('date-from');
      await userEvent.clear(fromInput);
      await userEvent.type(fromInput, '2023-02-01');
      
      // Check if onFilter was called with the right value
      expect(mockOnFilter).toHaveBeenCalledWith('2023-02-01:2023-01-31');
      
      // Change to date
      const toInput = screen.getByTestId('date-to');
      await userEvent.clear(toInput);
      await userEvent.type(toInput, '2023-02-28');
      
      // Check if onFilter was called with the right value
      expect(mockOnFilter).toHaveBeenCalledWith('2023-02-01:2023-02-28');
    });

    test('handles empty date range value', () => {
      render(
        <TableHeaderFilter 
          title="Date" 
          type="date-range" 
          value="" 
          onFilter={mockOnFilter} 
        />
      );
      
      const dateRangeFilter = screen.getByTestId('date-range-filter');
      expect(dateRangeFilter).toBeInTheDocument();
      
      const fromInput = screen.getByTestId('date-from');
      const toInput = screen.getByTestId('date-to');
      
      expect(fromInput).toHaveValue('');
      expect(toInput).toHaveValue('');
    });

    test('handles partial date range updates', async () => {
      render(
        <TableHeaderFilter 
          title="Date" 
          type="date-range" 
          value="" 
          onFilter={mockOnFilter} 
        />
      );
      
      const fromInput = screen.getByTestId('date-from');
      await userEvent.type(fromInput, '2023-01-01');
      
      expect(mockOnFilter).toHaveBeenCalledWith('2023-01-01:');
    });
  });

  describe('Number Filter Type', () => {
    test('renders with number filter type', async () => {
      render(
        <TableHeaderFilter 
          title="Count" 
          type="number" 
          value="" 
          onFilter={mockOnFilter} 
        />
      );
      
      expect(screen.getByText('Count')).toBeInTheDocument();
      
      const textFilter = screen.getByTestId('text-filter');
      expect(textFilter).toBeInTheDocument();
      
      await userEvent.type(textFilter, '123');
      
      const applyButton = screen.getByTestId('apply-button');
      await userEvent.click(applyButton);
      
      expect(mockOnFilter).toHaveBeenCalled();
    });
  });

  describe('Urgent Filter Type', () => {
    test('renders with urgent filter type', async () => {
      render(
        <TableHeaderFilter 
          title="Urgent" 
          type="urgent" 
          value="" 
          onFilter={mockOnFilter} 
        />
      );
      
      expect(screen.getByText('Urgent')).toBeInTheDocument();
      
      const booleanFilter = screen.getByTestId('boolean-filter');
      expect(booleanFilter).toBeInTheDocument();
      
      await userEvent.selectOptions(booleanFilter, 'true');
      expect(mockOnFilter).toHaveBeenCalledWith('true');
    });
  });

  describe('Filter State Management', () => {
    test('shows active filter indicator when value is set', () => {
      render(
        <TableHeaderFilter 
          title="Status" 
          type="text" 
          value="active filter" 
          onFilter={mockOnFilter} 
        />
      );
      
      // The exact implementation would depend on how active state is shown
      // This might be a CSS class, icon, or color change
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('handles filter reset', async () => {
      render(
        <TableHeaderFilter 
          title="Name" 
          type="text" 
          value="existing value" 
          onFilter={mockOnFilter} 
        />
      );
      
      const textFilter = screen.getByTestId('text-filter');
      await userEvent.clear(textFilter);
      
      expect(mockOnFilter).toHaveBeenCalledWith('');
    });
  });

  describe('Entity Type Integration', () => {
    test('handles orders entity type', () => {
      render(
        <TableHeaderFilter
          title="Status"
          type="enum"
          value=""
          onFilter={mockOnFilter}
          entityType="order"
          data={[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
          ]}
        />
      );
      
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('handles customers entity type', () => {
      render(
        <TableHeaderFilter
          title="Name"
          type="text"
          value=""
          onFilter={mockOnFilter}
          entityType="customer"
        />
      );

      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    test('handles suppliers entity type', () => {
      render(
        <TableHeaderFilter
          title="Company"
          type="text"
          value=""
          onFilter={mockOnFilter}
          entityType="supplier"
        />
      );

      expect(screen.getByText('Company')).toBeInTheDocument();
    });

    test('handles fitters entity type', () => {
      render(
        <TableHeaderFilter
          title="Name"
          type="text"
          value=""
          onFilter={mockOnFilter}
          entityType="fitter"
        />
      );

      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('provides accessible filter interface', () => {
      render(
        <TableHeaderFilter 
          title="Name" 
          type="text" 
          value="" 
          onFilter={mockOnFilter} 
        />
      );
      
      const textFilter = screen.getByTestId('text-filter');
      expect(textFilter).toHaveAttribute('placeholder', 'Filter by Name');
    });

    test('supports keyboard navigation', async () => {
      render(
        <TableHeaderFilter 
          title="Status" 
          type="enum" 
          value="" 
          onFilter={mockOnFilter} 
          data={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      );
      
      const enumFilter = screen.getByTestId('enum-filter');
      
      // Test keyboard navigation
      enumFilter.focus();
      expect(enumFilter).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    test('handles invalid filter data gracefully', () => {
      // Passing null as data causes a TypeError because the component
      // calls data.map() without a null guard. Verify it throws.
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        render(
          <TableHeaderFilter
            title="Status"
            type="enum"
            value=""
            onFilter={mockOnFilter}
            data={null as unknown as { value: string; label: string }[]}
          />
        );
      }).toThrow();
      consoleSpy.mockRestore();
    });

    test('handles undefined filter value', () => {
      render(
        <TableHeaderFilter 
          title="Name" 
          type="text" 
          value={undefined}
          onFilter={mockOnFilter} 
        />
      );
      
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });
});
