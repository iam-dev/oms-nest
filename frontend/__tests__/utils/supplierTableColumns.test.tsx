import React from 'react';
import { render, screen } from '@testing-library/react';
import { getSupplierTableColumns, type SupplierHeaderFilters, type SetSupplierHeaderFilters } from '@/utils/supplierTableColumns';
import type { Supplier } from '@/types/Supplier';

const mockSupplier: any = {
  id: 1,
  name: 'Premium Saddle Co.',
  username: 'premiumsaddle',
  email: 'contact@premiumsaddle.com',
  city: 'London',
  country: 'UK',
  phone: '+441234567890',
  address: '123 Leather St, London, UK',
  enabled: true,
  lastLogin: '2024-01-15T10:30:00Z',
  region: 'Europe',
  notes: 'Premium leather supplier with 20 years experience',
  createdAt: '2024-01-01T10:30:00Z',
  updatedAt: '2024-01-16T14:30:00Z',
  active: true,
};

const mockHeaderFilters: SupplierHeaderFilters = {};
const mockSetHeaderFilters: SetSupplierHeaderFilters = jest.fn();

describe('Supplier Table Columns', () => {
  describe('Column Generation', () => {
    it('generates all expected columns', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);

      expect(columns).toHaveLength(7);

      const columnKeys = columns.map(col => col.key);
      expect(columnKeys).toContain('id');
      expect(columnKeys).toContain('name');
      expect(columnKeys).toContain('username');
      expect(columnKeys).toContain('city');
      expect(columnKeys).toContain('country');
      expect(columnKeys).toContain('enabled');
      expect(columnKeys).toContain('lastLogin');
    });

    it('sets correct column titles', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);

      const nameCol = columns.find(col => col.key === 'name');
      expect(nameCol?.title).toBeDefined();

      const usernameCol = columns.find(col => col.key === 'username');
      expect(usernameCol?.title).toBeDefined();

      const cityCol = columns.find(col => col.key === 'city');
      expect(cityCol?.title).toBeDefined();

      const countryCol = columns.find(col => col.key === 'country');
      expect(countryCol?.title).toBeDefined();

      const enabledCol = columns.find(col => col.key === 'enabled');
      expect(enabledCol?.title).toBeDefined();

      const lastLoginCol = columns.find(col => col.key === 'lastLogin');
      expect(lastLoginCol?.title).toBeDefined();
    });

    it('configures columns with TableHeaderFilter titles', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);

      columns.forEach(column => {
        expect(column.title).toBeDefined();
        expect(column.render).toBeDefined();
      });
    });
  });

  describe('Text Column Rendering', () => {
    it('renders name column correctly', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const nameCol = columns.find(col => col.key === 'name');

      expect(nameCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (nameCol?.render as any)?.(mockSupplier.name, mockSupplier);
        return <div data-testid="supplier-name">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-name')).toHaveTextContent('Premium Saddle Co.');
    });

    it('renders username column correctly', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const usernameCol = columns.find(col => col.key === 'username');

      expect(usernameCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (usernameCol?.render as any)?.(mockSupplier.username, mockSupplier);
        return <div data-testid="supplier-username">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-username')).toHaveTextContent('premiumsaddle');
    });

    it('renders city column correctly', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const cityCol = columns.find(col => col.key === 'city');

      expect(cityCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (cityCol?.render as any)?.(mockSupplier.city, mockSupplier);
        return <div data-testid="supplier-city">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-city')).toHaveTextContent('London');
    });

    it('renders country column correctly', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const countryCol = columns.find(col => col.key === 'country');

      expect(countryCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (countryCol?.render as any)?.(mockSupplier.country, mockSupplier);
        return <div data-testid="supplier-country">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-country')).toHaveTextContent('UK');
    });
  });

  describe('Status Column Rendering', () => {
    it('renders enabled status for active supplier', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const enabledCol = columns.find(col => col.key === 'enabled');

      expect(enabledCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (enabledCol?.render as any)?.(true, mockSupplier);
        return <div data-testid="supplier-status">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-status')).toBeInTheDocument();
    });

    it('renders enabled status for inactive supplier', () => {
      const inactiveSupplier = { ...mockSupplier, enabled: false };
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const enabledCol = columns.find(col => col.key === 'enabled');

      const TestComponent = () => {
        const renderedValue = (enabledCol?.render as any)?.(false, inactiveSupplier);
        return <div data-testid="supplier-status">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-status')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('formats last login date correctly', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const lastLoginCol = columns.find(col => col.key === 'lastLogin');

      expect(lastLoginCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (lastLoginCol?.render as any)?.(mockSupplier.lastLogin, mockSupplier);
        return <div data-testid="last-login">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('last-login')).toHaveTextContent('2024-01-15T10:30:00Z');
    });

    it('handles null last login date', () => {
      const supplierWithoutDate = { ...mockSupplier, lastLogin: null };
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const lastLoginCol = columns.find(col => col.key === 'lastLogin');

      const TestComponent = () => {
        const renderedValue = (lastLoginCol?.render as any)?.(null, supplierWithoutDate);
        return <div data-testid="last-login">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('last-login')).toHaveTextContent('Never');
    });
  });

  describe('Error Handling', () => {
    it('handles missing supplier data gracefully', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const nameCol = columns.find(col => col.key === 'name');

      const TestComponent = () => {
        const renderedValue = (nameCol?.render as any)?.(null, null);
        return <div data-testid="supplier-name">{renderedValue || 'No name'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-name')).toHaveTextContent('No name');
    });

    it('handles missing username gracefully', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const usernameCol = columns.find(col => col.key === 'username');

      const TestComponent = () => {
        const renderedValue = (usernameCol?.render as any)?.(null, mockSupplier);
        return <div data-testid="supplier-username">{renderedValue || 'No username'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-username')).toHaveTextContent('No username');
    });

    it('handles missing city gracefully', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const cityCol = columns.find(col => col.key === 'city');

      const TestComponent = () => {
        const renderedValue = (cityCol?.render as any)?.(null, mockSupplier);
        return <div data-testid="supplier-city">{renderedValue || 'No city'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-city')).toHaveTextContent('No city');
    });

    it('handles missing country gracefully', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const countryCol = columns.find(col => col.key === 'country');

      const TestComponent = () => {
        const renderedValue = (countryCol?.render as any)?.(null, mockSupplier);
        return <div data-testid="supplier-country">{renderedValue || 'No country'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-country')).toHaveTextContent('No country');
    });
  });

  describe('Special Character Handling', () => {
    it('handles special characters in name', () => {
      const supplierWithSpecialChars = { ...mockSupplier, name: 'Müller & Söhne GmbH' };
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const nameCol = columns.find(col => col.key === 'name');

      const TestComponent = () => {
        const renderedValue = (nameCol?.render as any)?.(supplierWithSpecialChars.name, supplierWithSpecialChars);
        return <div data-testid="supplier-name">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-name')).toHaveTextContent('Müller & Söhne GmbH');
    });

    it('handles international cities', () => {
      const supplierWithInternationalCity = { ...mockSupplier, city: 'München' };
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const cityCol = columns.find(col => col.key === 'city');

      const TestComponent = () => {
        const renderedValue = (cityCol?.render as any)?.(supplierWithInternationalCity.city, supplierWithInternationalCity);
        return <div data-testid="supplier-city">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('supplier-city')).toHaveTextContent('München');
    });
  });

  describe('Column Order', () => {
    it('maintains expected column order', () => {
      const columns = getSupplierTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const columnKeys = columns.map(col => col.key);

      expect(columnKeys).toEqual([
        'id',
        'name',
        'username',
        'city',
        'country',
        'enabled',
        'lastLogin'
      ]);
    });
  });
});