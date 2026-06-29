import React from 'react';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';
import { StatusBadge } from '@/components/shared/StatusBadge';

export type ProductHeaderFilters = Record<string, string>;
export type SetProductHeaderFilters = (key: string, value: string) => void;

export function getProductTableColumns(headerFilters: ProductHeaderFilters, setHeaderFilters: SetProductHeaderFilters) {
  return [
    {
      key: 'id',
      title: (
        <TableHeaderFilter
          title="Product ID"
          value={headerFilters.id || ''}
          onFilter={value => setHeaderFilters('id', value)}
          type="text"
          entityType="product"
        />
      ),
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
          entityType="product"
        />
      ),
      render: (v: unknown) => String(v ?? ''),
    },
    {
      key: 'category',
      title: (
        <TableHeaderFilter
          title="Category"
          value={headerFilters.category || ''}
          onFilter={value => setHeaderFilters('category', value)}
          type="text"
          entityType="product"
        />
      ),
      render: (v: unknown) => String(v ?? ''),
    },
    {
      key: 'price',
      title: (
        <TableHeaderFilter
          title="Price"
          value={headerFilters.price || ''}
          onFilter={value => setHeaderFilters('price', value)}
          type="text"
          entityType="product"
        />
      ),
      render: (v: unknown) => String(v ?? ''),
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
      render: (v: unknown) => v ?? 0,
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
            { label: 'In Stock', value: 'In Stock' },
            { label: 'Low Stock', value: 'Low Stock' },
            { label: 'Out of Stock', value: 'Out of Stock' }
          ]}
          entityType="product"
        />
      ),
      render: (v: unknown) => (typeof v === 'string' && v) ? <StatusBadge status={v} type="product" /> : '',
    },
  ];
}
