'use client';

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { CUSTOM_VIEW_COLUMNS } from '@/utils/customViewColumns';
import { CellOverrideEditor } from './CellOverrideEditor';
import type { ColumnConfig } from '@/services/customOrderViews';

interface CustomViewsTableProps {
  columns: ColumnConfig[];
  orders: Record<string, unknown>[];
  selectedOrderIds: Set<number>;
  onToggleSelect: (orderId: number) => void;
  onToggleSelectAll: () => void;
  getOverrideValue: (orderId: number, columnKey: string) => string | undefined;
  onSetOverride: (orderId: number, columnKey: string, value: string) => void;
  onRemoveOverride: (orderId: number, columnKey: string) => void;
  loading?: boolean;
}

export function CustomViewsTable({
  columns,
  orders,
  selectedOrderIds,
  onToggleSelect,
  onToggleSelectAll,
  getOverrideValue,
  onSetOverride,
  onRemoveOverride,
  loading,
}: CustomViewsTableProps) {
  const colDefMap = new Map(CUSTOM_VIEW_COLUMNS.map((c) => [c.key, c]));

  const visibleColumns = [...columns]
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);

  const allSelected = orders.length > 0 && orders.every((o) => {
    const id = Number(o.id || o.orderId);
    return selectedOrderIds.has(id);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        Loading orders...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        No orders to display
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-3 py-2 text-left w-10">
              <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} />
            </th>
            {visibleColumns.map((col) => (
              <th key={col.key} className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order, rowIdx) => {
            const orderId = Number(order.id || order.orderId);
            const isSelected = selectedOrderIds.has(orderId);
            return (
              <tr
                key={orderId || rowIdx}
                className={`border-b hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
              >
                <td className="px-3 py-2">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(orderId)}
                  />
                </td>
                {visibleColumns.map((col) => {
                  const colDef = colDefMap.get(col.key);
                  const originalValue = colDef ? colDef.getValue(order) : '';
                  const overrideValue = getOverrideValue(orderId, col.key);

                  return (
                    <td key={col.key} className="px-3 py-2 group whitespace-nowrap">
                      <CellOverrideEditor
                        orderId={orderId}
                        columnKey={col.key}
                        originalValue={originalValue}
                        overrideValue={overrideValue}
                        onSave={onSetOverride}
                        onRemove={onRemoveOverride}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
