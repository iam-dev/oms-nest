import React from 'react';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';

export type BrandHeaderFilters = Record<string, string>;
export type SetBrandHeaderFilters = (key: string, value: string) => void;

export function getBrandTableColumns(headerFilters: BrandHeaderFilters, setHeaderFilters: SetBrandHeaderFilters) {
  return [
    {
      key: 'id',
      title: (
        <TableHeaderFilter
          title="ID"
          value={headerFilters.id || ''}
          onFilter={value => setHeaderFilters('id', value)}
          type="text"
          entityType="brand"
        />
      ),
      render: (v: string | number | null | undefined) => v ?? '',
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
          entityType="brand"
        />
      ),
      render: (v: string | null | undefined) => v ?? '',
      maxWidth: '200px',
    },
    {
      key: 'sequence',
      title: (
        <TableHeaderFilter
          title="SEQUENCE"
          value={headerFilters.sequence || ''}
          onFilter={value => setHeaderFilters('sequence', value)}
          type="text"
          entityType="brand"
        />
      ),
      render: (v: number | null | undefined) => v ?? '',
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
          entityType="brand"
        />
      ),
      render: (v: boolean | null | undefined) => v ? 'Yes' : 'No',
      maxWidth: '100px',
    },
  ];
}