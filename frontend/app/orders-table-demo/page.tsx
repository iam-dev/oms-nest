"use client";
import React from 'react';
import { useEffect, useState } from 'react';
import { useReactTable, flexRender, getCoreRowModel, ColumnDef } from '@tanstack/react-table';
import { SimpleDataTable } from '@/components/shared/SimpleDataTable';
import { getEnrichedOrders } from '@/services/enrichedOrders';
import { getCustomerName, getFitterName, getSupplierName } from '@/utils/orderHydration';
import type { Order as OrderDomainType } from '@/types/Order';

// Define the columns for the order table
type Order = {
  orderId: string;
  reference: string;
  customer: string | { name: string } | null;
  seatSize: string;
  orderStatus: string;
  urgent: boolean;
  fitter: string | { name: string } | null;
  supplier: string | { name: string } | null;
  orderTime: string;
};

// Helper type guard for objects with a name property
function hasName(obj: unknown): obj is { name: string } {
  return !!obj && typeof obj === 'object' && 'name' in obj;
}

const columns: ColumnDef<Order>[] = [
  { accessorKey: 'orderId', header: 'Order ID' },
  { accessorKey: 'reference', header: 'Reference' },
  { accessorKey: 'customer', header: 'Customer', cell: info => {
      const c = info.getValue();
      if (!c) return '-';
      if (hasName(c)) return c.name;
      return String(c);
    }
  },
  { accessorKey: 'seatSize', header: 'Seat Size' },
  { accessorKey: 'orderStatus', header: 'Status' },
  { accessorKey: 'urgent', header: 'Urgent', cell: info => info.getValue() ? 'Yes' : 'No' },
  { accessorKey: 'fitter', header: 'Fitter', cell: info => {
      const f = info.getValue();
      if (!f) return '-';
      if (hasName(f)) return f.name;
      return String(f);
    }
  },
  { accessorKey: 'supplier', header: 'Supplier', cell: info => {
      const s = info.getValue();
      if (!s) return '-';
      if (hasName(s)) return s.name;
      return String(s);
    }
  },
  { accessorKey: 'orderTime', header: 'Order Time' },
];

export default function OrdersTableDemoPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getEnrichedOrders()
      .then(res => {
        if (Array.isArray(res)) {
          setOrders(res);
        } else if (Array.isArray(res['hydra:member'])) {
          setOrders(res['hydra:member']);
        } else if (Array.isArray(res.items)) {
          setOrders(res.items);
        } else {
          setOrders([]); // fallback
        }
      })
      .catch(e => setError(e.message || 'Failed to fetch'))
      .finally(() => setLoading(false));
  }, []);

  // Normaliseer de data net als in /orders
  const processedOrders = (orders || []).map((order: Order & Record<string, unknown>) => ({
    ...order,
    id: order.id || order.orderId || '',
    orderId: order.orderId || order.id || '',
    reference: order.reference || '',
    seatSizes: Array.isArray(order.seatSizes) && order.seatSizes.length > 0
      ? order.seatSizes.map(String)
      : (order.reference
          ? ([...order.reference.matchAll(/(?:^|[^\w])(\d{2}(?:\.5)?)(?=[^\w]|$)/g)].map(m => m[1]))
          : []
        ),
    seatSize: order.seatSize || '',
    orderStatus: order.orderStatus || '',
    orderTime: order.orderTime || order.createdAt || '',
    urgent: order.urgent || false,
    customer: getCustomerName(order as unknown as OrderDomainType & Record<string, unknown>) || '',
    fitter: getFitterName(order as unknown as OrderDomainType & Record<string, unknown>) || '',
    supplier: getSupplierName(order as unknown as OrderDomainType & Record<string, unknown>) || ''
  }));

  // TODO(react-hooks): TanStack Table's useReactTable returns methods that cannot be safely
  // memoized; this is a known false-positive for this third-party hook integration.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: processedOrders,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: columns as any,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Orders Table Demo (Sticky Header)</h1>
      <SimpleDataTable height="60vh">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-gray-100">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="sticky top-0 z-10 bg-gray-100 px-4 py-2 border-b text-left"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} className="text-center py-10">Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={columns.length} className="text-center text-red-600 py-10">{error}</td></tr>
            ) : processedOrders.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-10">No orders found</td></tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="even:bg-gray-50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-2 border-b">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </SimpleDataTable>
    </div>
  );
}
