import React from 'react';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';
import { StatusBadge } from '@/components/shared/StatusBadge';

export type ProductStockHeaderFilters = Record<string, string>;
export type SetProductStockHeaderFilters = (key: string, value: string) => void;

export function getProductStockTableColumns(headerFilters: ProductStockHeaderFilters, setHeaderFilters: SetProductStockHeaderFilters) {
  return [
    {
      key: 'name',
      title: (
        <TableHeaderFilter
          title="Name"
          value={headerFilters.name || ''}
          onFilter={value => setHeaderFilters('name', value)}
          type="text"
          entityType="product"
        />
      ),
      render: (v: string | null | undefined) => v ?? '',
    },
    {
      key: 'sku',
      title: (
        <TableHeaderFilter
          title="SKU"
          value={headerFilters.sku || ''}
          onFilter={value => setHeaderFilters('sku', value)}
          type="text"
          entityType="product"
        />
      ),
      render: (v: string | null | undefined) => v ?? '',
    },
    {
      key: 'stock',
      title: (
        <TableHeaderFilter
          title="Stock"
          value={headerFilters.stock || ''}
          onFilter={value => setHeaderFilters('stock', value)}
          type="number"
          entityType="product"
        />
      ),
      render: (v: number | null | undefined) => v ?? 0,
    },
    {
      key: 'status',
      title: (
        <TableHeaderFilter
          title="Status"
          value={headerFilters.status || ''}
          onFilter={value => setHeaderFilters('status', value)}
          type="enum"
          data={[
            { label: 'Optimal', value: 'Optimal' },
            { label: 'Low Stock', value: 'Low Stock' },
            { label: 'Out of Stock', value: 'Out of Stock' }
          ]}
          entityType="product"
        />
      ),
      render: (v: string | null | undefined) => v ? <StatusBadge status={v} type="product" /> : '',
    },
  ];
}
