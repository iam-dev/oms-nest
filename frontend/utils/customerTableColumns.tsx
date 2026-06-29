import React from 'react';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';
import type { Customer } from '@/types/Customer';

type CustomerRow = Customer & { fitter?: { $ref?: string; name?: string } | null };

export type CustomerHeaderFilters = Record<string, string>;
export type SetCustomerHeaderFilters = (key: string, value: string) => void;
export type CustomerFilterChangeHandler = (key: string, value: string) => void;

export function getCustomerTableColumns(headerFilters: CustomerHeaderFilters, setHeaderFilters: SetCustomerHeaderFilters) {
  return [
    {
      key: 'id',
      title: (
        <TableHeaderFilter
          title="ID"
          value={headerFilters.id || ''}
          onFilter={value => setHeaderFilters('id', value)}
          type="text"
          entityType="customer"
        />
      ),
      render: (v: unknown) => String(v ?? ''),
      maxWidth: '200px',
    },
    {
      key: 'fitter',
      title: (
        <TableHeaderFilter
          title="FITTER"
          value={headerFilters.fitter || ''}
          onFilter={value => setHeaderFilters('fitter', value)}
          type="text"
          entityType="customer"
        />
      ),
      render: (_v: unknown, row: CustomerRow) => {
        // Show fitter name from the customer's fitter relationship
        if (!row || !row.fitter) return '';
        // Handle fitter references ($ref) vs full objects
        if (row.fitter.$ref) return '—';
        return row.fitter.name || '';
      },
      maxWidth: '180px',
    },
    {
      key: 'name',
      title: (
        <TableHeaderFilter
          title="NAME"
          value={headerFilters.name || ''}
          onFilter={value => setHeaderFilters('name', value)}
          type="text"
          entityType="customer"
        />
      ),
      render: (v: unknown, row: CustomerRow) => {
        // Ensure we always show the customer's name, never "Loading..."
        if (row && row.name) return row.name;
        return String(v ?? '');
      },
      maxWidth: '200px',
    },
    {
      key: 'country',
      title: (
        <TableHeaderFilter
          title="COUNTRY"
          value={headerFilters.country || ''}
          onFilter={value => setHeaderFilters('country', value)}
          type="text"
          entityType="customer"
        />
      ),
      render: (v: unknown) => String(v ?? ''),
    },
    {
      key: 'city',
      title: (
        <TableHeaderFilter
          title="CITY"
          value={headerFilters.city || ''}
          onFilter={value => setHeaderFilters('city', value)}
          type="text"
          entityType="customer"
        />
      ),
      render: (v: unknown) => String(v ?? ''),
    },
    {
      key: 'email',
      title: (
        <TableHeaderFilter
          title="EMAIL"
          value={headerFilters.email || ''}
          onFilter={value => setHeaderFilters('email', value)}
          type="text"
          entityType="customer"
        />
      ),
      render: (v: unknown) => String(v ?? ''),
    },
  ];
}
