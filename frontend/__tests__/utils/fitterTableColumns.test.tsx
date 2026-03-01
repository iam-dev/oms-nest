import React from 'react';
import { render, screen } from '@testing-library/react';
import { getFitterTableColumns, type FitterHeaderFilters, type SetFitterHeaderFilters } from '@/utils/fitterTableColumns';
import type { Fitter } from '@/types/Fitter';

const mockFitter: any = {
  id: 1,
  name: 'Jane Fitter',
  username: 'janefitter',
  email: 'jane@example.com',
  city: 'New York',
  country: 'USA',
  phone: '+1234567890',
  address: '123 Main St, City, State 12345',
  enabled: true,
  lastLogin: '2024-01-15T10:30:00Z',
  region: 'North America',
  certificationLevel: 'Expert',
  notes: 'Professional fitter with 10 years experience',
  createdAt: '2024-01-01T10:30:00Z',
  updatedAt: '2024-01-16T14:30:00Z',
  active: true,
};

const mockHeaderFilters: FitterHeaderFilters = {};
const mockSetHeaderFilters: SetFitterHeaderFilters = jest.fn();

describe('Fitter Table Columns', () => {
  describe('Column Generation', () => {
    it('generates all expected columns', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);

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
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);

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
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);

      columns.forEach(column => {
        expect(column.title).toBeDefined();
        expect(column.render).toBeDefined();
      });
    });
  });

  describe('Text Column Rendering', () => {
    it('renders name column correctly', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const nameCol = columns.find(col => col.key === 'name');

      expect(nameCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (nameCol?.render as any)?.(mockFitter.name, mockFitter);
        return <div data-testid="fitter-name">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-name')).toHaveTextContent('Jane Fitter');
    });

    it('renders username column correctly', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const usernameCol = columns.find(col => col.key === 'username');

      expect(usernameCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (usernameCol?.render as any)?.(mockFitter.username, mockFitter);
        return <div data-testid="fitter-username">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-username')).toHaveTextContent('janefitter');
    });

    it('renders city column correctly', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const cityCol = columns.find(col => col.key === 'city');

      expect(cityCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (cityCol?.render as any)?.(mockFitter.city, mockFitter);
        return <div data-testid="fitter-city">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-city')).toHaveTextContent('New York');
    });

    it('renders country column correctly', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const countryCol = columns.find(col => col.key === 'country');

      expect(countryCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (countryCol?.render as any)?.(mockFitter.country, mockFitter);
        return <div data-testid="fitter-country">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-country')).toHaveTextContent('USA');
    });
  });

  describe('Status Column Rendering', () => {
    it('renders enabled status for active fitter', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const enabledCol = columns.find(col => col.key === 'enabled');

      expect(enabledCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (enabledCol?.render as any)?.(true, mockFitter);
        return <div data-testid="fitter-status">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-status')).toBeInTheDocument();
    });

    it('renders enabled status for inactive fitter', () => {
      const inactiveFitter = { ...mockFitter, enabled: false };
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const enabledCol = columns.find(col => col.key === 'enabled');

      const TestComponent = () => {
        const renderedValue = (enabledCol?.render as any)?.(false, inactiveFitter);
        return <div data-testid="fitter-status">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-status')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('formats last login date correctly', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const lastLoginCol = columns.find(col => col.key === 'lastLogin');

      expect(lastLoginCol?.render).toBeDefined();

      const TestComponent = () => {
        const renderedValue = (lastLoginCol?.render as any)?.(mockFitter.lastLogin, mockFitter);
        return <div data-testid="last-login">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('last-login')).toHaveTextContent('2024-01-15T10:30:00Z');
    });

    it('handles null last login date', () => {
      const fitterWithoutDate = { ...mockFitter, lastLogin: null };
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const lastLoginCol = columns.find(col => col.key === 'lastLogin');

      const TestComponent = () => {
        const renderedValue = (lastLoginCol?.render as any)?.(null, fitterWithoutDate);
        return <div data-testid="last-login">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('last-login')).toHaveTextContent('Never');
    });
  });

  describe('Error Handling', () => {
    it('handles missing fitter data gracefully', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const nameCol = columns.find(col => col.key === 'name');

      const TestComponent = () => {
        const renderedValue = (nameCol?.render as any)?.(null, null);
        return <div data-testid="fitter-name">{renderedValue || 'No name'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-name')).toHaveTextContent('No name');
    });

    it('handles missing username gracefully', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const usernameCol = columns.find(col => col.key === 'username');

      const TestComponent = () => {
        const renderedValue = (usernameCol?.render as any)?.(null, mockFitter);
        return <div data-testid="fitter-username">{renderedValue || 'No username'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-username')).toHaveTextContent('No username');
    });

    it('handles missing city gracefully', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const cityCol = columns.find(col => col.key === 'city');

      const TestComponent = () => {
        const renderedValue = (cityCol?.render as any)?.(null, mockFitter);
        return <div data-testid="fitter-city">{renderedValue || 'No city'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-city')).toHaveTextContent('No city');
    });

    it('handles missing country gracefully', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const countryCol = columns.find(col => col.key === 'country');

      const TestComponent = () => {
        const renderedValue = (countryCol?.render as any)?.(null, mockFitter);
        return <div data-testid="fitter-country">{renderedValue || 'No country'}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-country')).toHaveTextContent('No country');
    });
  });

  describe('Special Character Handling', () => {
    it('handles special characters in name', () => {
      const fitterWithSpecialChars = { ...mockFitter, name: 'José María-Fernández' };
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const nameCol = columns.find(col => col.key === 'name');

      const TestComponent = () => {
        const renderedValue = (nameCol?.render as any)?.(fitterWithSpecialChars.name, fitterWithSpecialChars);
        return <div data-testid="fitter-name">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-name')).toHaveTextContent('José María-Fernández');
    });

    it('handles international cities', () => {
      const fitterWithInternationalCity = { ...mockFitter, city: 'São Paulo' };
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
      const cityCol = columns.find(col => col.key === 'city');

      const TestComponent = () => {
        const renderedValue = (cityCol?.render as any)?.(fitterWithInternationalCity.city, fitterWithInternationalCity);
        return <div data-testid="fitter-city">{renderedValue}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('fitter-city')).toHaveTextContent('São Paulo');
    });
  });

  describe('Column Order', () => {
    it('maintains expected column order', () => {
      const columns = getFitterTableColumns(mockHeaderFilters, mockSetHeaderFilters);
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