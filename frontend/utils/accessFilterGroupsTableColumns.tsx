import React from 'react';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';
import { StatusBadge } from '@/components/shared/StatusBadge';

export type AccessFilterGroupHeaderFilters = Record<string, string>;
export type SetAccessFilterGroupHeaderFilters = (key: string, value: string) => void;

export function getAccessFilterGroupTableColumns(headerFilters: AccessFilterGroupHeaderFilters, setHeaderFilters: SetAccessFilterGroupHeaderFilters) {
  return [
    {
      key: 'name',
      title: (
        <TableHeaderFilter
          title="Name"
          value={headerFilters.name || ''}
          onFilter={value => setHeaderFilters('name', value)}
          type="text"
          entityType="access-filter-group"
        />
      ),
      render: (v: string | null | undefined) => v ?? '',
    },
    {
      key: 'description',
      title: (
        <TableHeaderFilter
          title="Description"
          value={headerFilters.description || ''}
          onFilter={value => setHeaderFilters('description', value)}
          type="text"
          entityType="access-filter-group"
        />
      ),
      render: (v: string | null | undefined) => v ?? '',
    },
    {
      key: 'enabled',
      title: (
        <TableHeaderFilter
          title="Status"
          value={headerFilters.status || ''}
          onFilter={value => setHeaderFilters('status', value)}
          type="enum"
          data={[
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Inactive', value: 'INACTIVE' }
          ]}
          entityType="access-filter-group"
        />
      ),
      render: (v: boolean | null | undefined) => {
        const status = v ? 'ACTIVE' : 'INACTIVE';
        return <StatusBadge status={status} type="access-filter-group" />;
      },
    },
    {
      key: 'createdAt',
      title: (
        <TableHeaderFilter
          title="Created"
          value={headerFilters.createdAt || ''}
          onFilter={value => setHeaderFilters('createdAt', value)}
          type="date-range"
          entityType="access-filter-group"
        />
      ),
      render: (v: string | null | undefined) => {
        if (!v) return 'N/A';
        const date = new Date(v);
        return date.toLocaleDateString();
      },
    },
  ];
}