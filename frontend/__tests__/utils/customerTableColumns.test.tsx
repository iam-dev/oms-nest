import React from 'react';
import { render, screen } from '@testing-library/react';
import { getCustomerTableColumns, type CustomerHeaderFilters, type SetCustomerHeaderFilters } from '@/utils/customerTableColumns';
import type { Customer } from '@/types/Customer';

type RenderFn = (value: unknown, row?: unknown) => React.ReactNode;
/** Extended customer shape with display-layer fields the columns consume */
type MockCustomer = Customer & {
  city?: string;
  country?: string;
  fitter?: { id: number; name: string; $ref?: string } | null;
  phone?: string;
  address?: string;
  notes?: string;
  active?: boolean;
};

/** Column definition shape augmented with optional layout metadata */
type ColumnWithMeta = {
  key: string;
  title: React.ReactNode;
  render?: RenderFn;
  maxWidth?: string;
};

const mockCustomer: MockCustomer = {
  id: 1,
  name: 'John Customer',
  email: 'john@example.com',
  city: 'New York',
  country: 'USA',
  fitter: { id: 1, name: 'Jane Fitter' },
  phone: '+1234567890',
  address: '123 Main St, City, State 12345',
  notes: 'Regular customer with special requirements',
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-16T14:30:00Z',
  active: true,
};

const mockHeaderFilters: CustomerHeaderFilters = {};
const mockSetHeaderFilters: SetCustomerHeaderFilters = jest.fn();

describe('Customer Table Columns', () => {
  describe('Column Generation', () => {
    it('generates all expected columns', () => {
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);

      expect(columns).toHaveLength(6);

      const columnKeys = columns.map(col => col.key);
      expect(columnKeys).toContain('id');
      expect(columnKeys).toContain('fitter');
      expect(columnKeys).toContain('name');
      expect(columnKeys).toContain('country');
      expect(columnKeys).toContain('city');
      expect(columnKeys).toContain('email');
    });

    it('sets correct column titles', () => {
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);

      const nameCol = columns.find(col => col.key === 'name');
      expect(nameCol?.title).toBeDefined();

      const emailCol = columns.find(col => col.key === 'email');
      expect(emailCol?.title).toBeDefined();

      const fitterCol = columns.find(col => col.key === 'fitter');
      expect(fitterCol?.title).toBeDefined();

      const idCol = columns.find(col => col.key === 'id');
      expect(idCol?.title).toBeDefined();

      const countryCol = columns.find(col => col.key === 'country');
      expect(countryCol?.title).toBeDefined();

      const cityCol = columns.find(col => col.key === 'city');
      expect(cityCol?.title).toBeDefined();
    });

    it('configures columns with TableHeaderFilter titles', () => {
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);

      const nameCol = columns.find(col => col.key === 'name');
      expect(nameCol?.title).toBeDefined();

      const emailCol = columns.find(col => col.key === 'email');
      expect(emailCol?.title).toBeDefined();

      const fitterCol = columns.find(col => col.key === 'fitter');
      expect(fitterCol?.title).toBeDefined();

      const idCol = columns.find(col => col.key === 'id');
      expect(idCol?.title).toBeDefined();
    });
  });

  describe('Text Column Rendering', () => {
    it('renders name column correctly', () => {
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const nameCol = columns.find(col => col.key === 'name');

      expect(nameCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (nameCol?.render as RenderFn)?.(mockCustomer.name, mockCustomer);
        return <div data-testid="customer-name">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('customer-name')).toHaveTextContent('John Customer');
    });

    it('renders email column correctly', () => {
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const emailCol = columns.find(col => col.key === 'email');

      expect(emailCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (emailCol?.render as RenderFn)?.(mockCustomer.email, mockCustomer);
        return <div data-testid="customer-email">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('customer-email')).toHaveTextContent('john@example.com');
    });

    it('renders country column correctly', () => {
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const countryCol = columns.find(col => col.key === 'country');

      expect(countryCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (countryCol?.render as RenderFn)?.(mockCustomer.country, mockCustomer);
        return <div data-testid="customer-country">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('customer-country')).toHaveTextContent('USA');
    });
  });

  describe('ID Column Rendering', () => {
    it('renders id column correctly', () => {
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const idCol = columns.find(col => col.key === 'id');

      expect(idCol?.render).toBeDefined();
      expect((idCol as ColumnWithMeta)?.maxWidth).toBe('200px');

      const TestComponent = () => {
        const renderedValue = (idCol?.render as RenderFn)?.(mockCustomer.id, mockCustomer);
        return <div data-testid="customer-id">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('customer-id')).toHaveTextContent('1');
    });
  });

  describe('Fitter Relationship Handling', () => {
    it('extracts fitter name correctly', () => {
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const fitterCol = columns.find(col => col.key === 'fitter');

      const TestComponent = () => {
        const renderedValue = (fitterCol?.render as RenderFn)?.(mockCustomer.fitter, mockCustomer);
        return <div data-testid="fitter-name">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-name')).toHaveTextContent('Jane Fitter');
    });

    it('handles customers without assigned fitter', () => {
      const customerWithoutFitter = { ...mockCustomer, fitter: null };
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const fitterCol = columns.find(col => col.key === 'fitter');

      const TestComponent = () => {
        const renderedValue = (fitterCol?.render as RenderFn)?.(customerWithoutFitter.fitter, customerWithoutFitter);
        return <div data-testid="fitter-name">{renderedValue || 'No fitter'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-name')).toHaveTextContent('No fitter');
    });

    it('handles fitter object with missing name', () => {
      const customerWithEmptyFitter = { ...mockCustomer, fitter: { id: 1, name: '' } };
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const fitterCol = columns.find(col => col.key === 'fitter');

      const TestComponent = () => {
        const renderedValue = (fitterCol?.render as RenderFn)?.(customerWithEmptyFitter.fitter, customerWithEmptyFitter);
        return <div data-testid="fitter-name">{renderedValue || 'No name'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-name')).toHaveTextContent('No name');
    });
  });

  describe('Column Width Configuration', () => {
    it('sets appropriate max widths for columns', () => {
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);

      const idCol = columns.find(col => col.key === 'id');
      expect((idCol as ColumnWithMeta)?.maxWidth).toBe('200px');

      const nameCol = columns.find(col => col.key === 'name');
      expect((nameCol as ColumnWithMeta)?.maxWidth).toBe('200px');

      const fitterCol = columns.find(col => col.key === 'fitter');
      expect((fitterCol as ColumnWithMeta)?.maxWidth).toBe('180px');

      // Columns without explicit maxWidth should not have one
      const emailCol = columns.find(col => col.key === 'email');
      expect((emailCol as ColumnWithMeta)?.maxWidth).toBeUndefined();

      const countryCol = columns.find(col => col.key === 'country');
      expect((countryCol as ColumnWithMeta)?.maxWidth).toBeUndefined();

      const cityCol = columns.find(col => col.key === 'city');
      expect((cityCol as ColumnWithMeta)?.maxWidth).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('handles missing customer data gracefully', () => {
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const nameCol = columns.find(col => col.key === 'name');

      const TestComponent = () => {
        const renderedValue = (nameCol?.render as RenderFn)?.(null, null);
        return <div data-testid="customer-name">{renderedValue || 'No name'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('customer-name')).toHaveTextContent('No name');
    });

    it('handles missing email gracefully', () => {
      const customerWithoutEmail = { ...mockCustomer, email: null };
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const emailCol = columns.find(col => col.key === 'email');

      const TestComponent = () => {
        const renderedValue = (emailCol?.render as RenderFn)?.(customerWithoutEmail.email, customerWithoutEmail);
        return <div data-testid="customer-email">{renderedValue || 'No email'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('customer-email')).toHaveTextContent('No email');
    });
  });

  describe('Special Character Handling', () => {
    it('handles special characters in name', () => {
      const customerWithSpecialChars = { ...mockCustomer, name: 'José María-Fernández & Co.' };
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const nameCol = columns.find(col => col.key === 'name');

      const TestComponent = () => {
        const renderedValue = (nameCol?.render as RenderFn)?.(customerWithSpecialChars.name, customerWithSpecialChars);
        return <div data-testid="customer-name">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('customer-name')).toHaveTextContent('José María-Fernández & Co.');
    });

    it('handles special characters in email', () => {
      const customerWithSpecialEmail = { ...mockCustomer, email: 'test+user@sub-domain.co.uk' };
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const emailCol = columns.find(col => col.key === 'email');

      const TestComponent = () => {
        const renderedValue = (emailCol?.render as RenderFn)?.(customerWithSpecialEmail.email, customerWithSpecialEmail);
        return <div data-testid="customer-email">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('customer-email')).toHaveTextContent('test+user@sub-domain.co.uk');
    });
  });

  describe('Column Order', () => {
    it('maintains expected column order', () => {
      const columns = getCustomerTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const columnKeys = columns.map(col => col.key);

      expect(columnKeys).toEqual([
        'id',
        'fitter',
        'name',
        'country',
        'city',
        'email'
      ]);
    });
  });
});