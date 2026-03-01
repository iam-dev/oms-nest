import React from 'react';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';
import { StatusBadge } from '@/components/shared/StatusBadge';

export type SupplierHeaderFilters = Record<string, string>;
export type SetSupplierHeaderFilters = (key: string, value: string) => void;

export function getSupplierTableColumns(headerFilters: SupplierHeaderFilters, setHeaderFilters: SetSupplierHeaderFilters) {
  return [
    {
      key: 'id',
      title: 'ID',
      render: (v: unknown) => String(v ?? ''),
    },
    {
      key: 'name',
      title: (
        <TableHeaderFilter
          title="Name"
          value={headerFilters.name || ''}
          onFilter={value => setHeaderFilters('name', value)}
          type="text"
          entityType="factory"
        />
      ),
      render: (v: any) => v ?? '',
    },
    {
      key: 'username',
      title: (
        <TableHeaderFilter
          title="Username"
          value={headerFilters.username || ''}
          onFilter={value => setHeaderFilters('username', value)}
          type="text"
          entityType="factory"
        />
      ),
      render: (v: any) => v ?? '',
    },
    {
      key: 'city',
      title: (
        <TableHeaderFilter
          title="City"
          value={headerFilters.city || ''}
          onFilter={value => setHeaderFilters('city', value)}
          type="text"
          entityType="factory"
        />
      ),
      render: (v: any) => v ?? '',
    },
    {
      key: 'country',
      title: (
        <TableHeaderFilter
          title="Country"
          value={headerFilters.country || ''}
          onFilter={value => setHeaderFilters('country', value)}
          type="text"
          entityType="factory"
        />
      ),
      render: (v: any) => v ?? '',
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
          entityType="factory"
        />
      ),
      render: (v: any) => {
        const status = v ? 'ACTIVE' : 'INACTIVE';
        return <StatusBadge status={status} type="supplier" />;
      },
    },
    {
      key: 'lastLogin',
      title: (
        <TableHeaderFilter
          title="Last Login"
          value={headerFilters.lastLogin || ''}
          onFilter={value => setHeaderFilters('lastLogin', value)}
          type="date-range"
          entityType="factory"
        />
      ),
      render: (v: any) => v ?? 'Never',
    },
  ];
}