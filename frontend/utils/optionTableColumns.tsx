import React from 'react';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';

export type OptionHeaderFilters = Record<string, string>;
export type SetOptionHeaderFilters = (key: string, value: string) => void;

export function getOptionTableColumns(headerFilters: OptionHeaderFilters, setHeaderFilters: SetOptionHeaderFilters) {
  return [
    {
      key: 'id',
      title: (
        <TableHeaderFilter
          title="ID"
          value={headerFilters.id || ''}
          onFilter={value => setHeaderFilters('id', value)}
          type="text"
          entityType="option"
        />
      ),
      render: (v: unknown) => String(v ?? ''),
      maxWidth: '200px',
    },
    {
      key: 'name',
      title: (
        <TableHeaderFilter
          title="NAME"
          value={headerFilters.name || ''}
          onFilter={value => setHeaderFilters('name', value)}
          type="text"
          entityType="option"
        />
      ),
      render: (v: unknown) => String(v ?? ''),
      maxWidth: '200px',
    },
    {
      key: 'description',
      title: (
        <TableHeaderFilter
          title="DESCRIPTION"
          value={headerFilters.description || ''}
          onFilter={value => setHeaderFilters('description', value)}
          type="text"
          entityType="option"
        />
      ),
      render: (v: unknown) => String(v ?? ''),
      maxWidth: '250px',
    },
    {
      key: 'price',
      title: (
        <TableHeaderFilter
          title="PRICE"
          value={headerFilters.price || ''}
          onFilter={value => setHeaderFilters('price', value)}
          type="text"
          entityType="option"
        />
      ),
      render: (v: unknown) => (v != null && v !== '') ? `$${parseFloat(String(v)).toFixed(2)}` : '',
      maxWidth: '120px',
    },
    {
      key: 'sequence',
      title: (
        <TableHeaderFilter
          title="SEQUENCE"
          value={headerFilters.sequence || ''}
          onFilter={value => setHeaderFilters('sequence', value)}
          type="text"
          entityType="option"
        />
      ),
      render: (v: unknown) => String(v ?? ''),
      maxWidth: '120px',
    },
    {
      key: 'active',
      title: (
        <TableHeaderFilter
          title="ACTIVE"
          value={headerFilters.active || ''}
          onFilter={value => setHeaderFilters('active', value)}
          type="enum"
          data={[
            { label: 'Active', value: 'true' },
            { label: 'Inactive', value: 'false' }
          ]}
          entityType="option"
        />
      ),
      render: (v: unknown) => v ? 'Yes' : 'No',
      maxWidth: '100px',
    },
  ];
}