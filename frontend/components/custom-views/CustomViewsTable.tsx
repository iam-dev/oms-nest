'use client';

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { CUSTOM_VIEW_COLUMNS } from '@/utils/customViewColumns';
import { CellOverrideEditor } from './CellOverrideEditor';
import type { ColumnConfig, ColumnGroupConfig } from '@/services/customOrderViews';

interface CustomViewsTableProps {
  columns: ColumnConfig[];
  columnGroups?: ColumnGroupConfig[];
  orders: Record<string, unknown>[];
  selectedOrderIds: Set<number>;
  onToggleSelect: (orderId: number) => void;
  onToggleSelectAll: () => void;
  getOverrideValue: (orderId: number, columnKey: string) => string | undefined;
  onSetOverride: (orderId: number, columnKey: string, value: string) => void;
  onRemoveOverride: (orderId: number, columnKey: string) => void;
  loading?: boolean;
}

/**
 * Build group header cells for the visible columns.
 * Returns an array of { label: string | null; colSpan: number; isGroupStart: boolean } entries,
 * one per contiguous region (grouped or ungrouped).
 */
function buildGroupHeaderCells(
  visibleColumns: ColumnConfig[],
  columnGroups: ColumnGroupConfig[],
): Array<{ label: string | null; colSpan: number; isGroupStart: boolean }> {
  const keyToGroup = new Map<string, string>();
  for (const group of columnGroups) {
    for (const key of group.columnKeys) {
      keyToGroup.set(key, group.label);
    }
  }

  const cells: Array<{ label: string | null; colSpan: number; isGroupStart: boolean }> = [];
  let current: { label: string | null; colSpan: number; isGroupStart: boolean } | null = null;

  for (const col of visibleColumns) {
    const groupLabel = keyToGroup.get(col.key) ?? null;
    if (current && current.label === groupLabel) {
      current.colSpan++;
    } else {
      if (current) cells.push(current);
      current = { label: groupLabel, colSpan: 1, isGroupStart: groupLabel !== null };
    }
  }
  if (current) cells.push(current);

  return cells;
}

/**
 * Build a set of column keys that are the first visible column of each group.
 * Used to apply left border separators on header and data rows.
 */
function buildGroupStartKeys(
  visibleColumns: ColumnConfig[],
  columnGroups: ColumnGroupConfig[],
): Set<string> {
  const startKeys = new Set<string>();
  for (const group of columnGroups) {
    // Find the first columnKey in this group that is actually visible
    for (const key of group.columnKeys) {
      if (visibleColumns.some((c) => c.key === key)) {
        startKeys.add(key);
        break;
      }
    }
  }
  return startKeys;
}

export function CustomViewsTable({
  columns,
  columnGroups,
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

  const hasGroups = columnGroups && columnGroups.length > 0;
  const groupStartKeys = hasGroups
    ? buildGroupStartKeys(visibleColumns, columnGroups)
    : new Set<string>();

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
          {hasGroups && (
            <tr className="bg-primary text-white">
              <th className="px-3 py-1" />
              {buildGroupHeaderCells(visibleColumns, columnGroups!).map((cell, i) => (
                <th
                  key={i}
                  colSpan={cell.colSpan}
                  className={`px-3 py-1 text-center text-xs font-bold uppercase tracking-wider ${
                    cell.label ? '' : 'bg-gray-50 text-gray-50'
                  } ${cell.isGroupStart ? 'border-l-2 border-l-white/30' : ''}`}
                >
                  {cell.label || ''}
                </th>
              ))}
            </tr>
          )}
          <tr>
            <th className="px-3 py-2 text-left w-10">
              <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} />
            </th>
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap ${
                  groupStartKeys.has(col.key) ? 'border-l-2 border-l-gray-300' : ''
                }`}
              >
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
                    <td
                      key={col.key}
                      className={`px-3 py-2 group whitespace-nowrap ${
                        groupStartKeys.has(col.key) ? 'border-l-2 border-l-gray-300' : ''
                      }`}
                    >
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
