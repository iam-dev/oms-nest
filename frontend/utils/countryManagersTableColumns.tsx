import React from 'react';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';
import { StatusBadge } from '@/components/shared/StatusBadge';

export type CountryManagerHeaderFilters = Record<string, string>;
export type SetCountryManagerHeaderFilters = (key: string, value: string) => void;

export function getCountryManagerTableColumns(headerFilters: CountryManagerHeaderFilters, setHeaderFilters: SetCountryManagerHeaderFilters) {
  return [
    {
      key: 'country',
      title: (
        <TableHeaderFilter
          title="Country"
          value={headerFilters.country || ''}
          onFilter={value => setHeaderFilters('country', value)}
          type="text"
          entityType="country-manager"
        />
      ),
      render: (v: unknown) => v ?? '',
    },
    {
      key: 'managerName',
      title: (
        <TableHeaderFilter
          title="Manager Name"
          value={headerFilters.managerName || ''}
          onFilter={value => setHeaderFilters('managerName', value)}
          type="text"
          entityType="country-manager"
        />
      ),
      render: (v: unknown) => v ?? '',
    },
    {
      key: 'email',
      title: (
        <TableHeaderFilter
          title="Email"
          value={headerFilters.email || ''}
          onFilter={value => setHeaderFilters('email', value)}
          type="text"
          entityType="country-manager"
        />
      ),
      render: (v: unknown) => v ?? '',
    },
    {
      key: 'region',
      title: (
        <TableHeaderFilter
          title="Region"
          value={headerFilters.region || ''}
          onFilter={value => setHeaderFilters('region', value)}
          type="text"
          entityType="country-manager"
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
          entityType="country-manager"
        />
      ),
      render: (v: unknown) => {
        const status = v ? 'ACTIVE' : 'INACTIVE';
        return <StatusBadge status={status} type="country-manager" />;
      },
    },
  ];
}