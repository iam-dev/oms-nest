import React from 'react';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';
import { StatusBadge } from '@/components/shared/StatusBadge';

export type FitterHeaderFilters = Record<string, string>;
export type SetFitterHeaderFilters = (key: string, value: string) => void;

export function getFitterTableColumns(headerFilters: FitterHeaderFilters, setHeaderFilters: SetFitterHeaderFilters, countries: string[] = []) {
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
          entityType="fitter"
        />
      ),
      render: (v: unknown) => v ?? '',
    },
    {
      key: 'username',
      title: (
        <TableHeaderFilter
          title="Username"
          value={headerFilters.username || ''}
          onFilter={value => setHeaderFilters('username', value)}
          type="text"
          entityType="fitter"
        />
      ),
      render: (v: unknown) => v ?? '',
    },
    {
      key: 'city',
      title: (
        <TableHeaderFilter
          title="City"
          value={headerFilters.city || ''}
          onFilter={value => setHeaderFilters('city', value)}
          type="text"
          entityType="fitter"
        />
      ),
      render: (v: unknown) => v ?? '',
    },
    {
      key: 'country',
      title: (
        <TableHeaderFilter
          title="Country"
          value={headerFilters.country || ''}
          onFilter={value => setHeaderFilters('country', value)}
          type={countries.length > 0 ? 'enum' : 'text'}
          data={countries}
          entityType="fitter"
        />
      ),
      render: (v: unknown) => v ?? '',
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
          entityType="fitter"
        />
      ),
      render: (v: unknown) => {
        const status = v ? 'ACTIVE' : 'INACTIVE';
        return <StatusBadge status={status} type="fitter" />;
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
          entityType="fitter"
        />
      ),
      render: (v: unknown) => v ?? 'Never',
    },
  ];
}
