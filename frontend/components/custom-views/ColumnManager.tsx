'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { getColumnsByCategory, CUSTOM_VIEW_COLUMNS } from '@/utils/customViewColumns';
import type { ColumnConfig } from '@/services/customOrderViews';

interface ColumnManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnConfig[];
  onSave: (columns: ColumnConfig[]) => void;
  tabName?: string;
}

export function ColumnManager({ open, onOpenChange, columns, onSave, tabName }: ColumnManagerProps) {
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>([]);
  const grouped = getColumnsByCategory();

  useEffect(() => {
    if (open) {
      // Initialize local state from current columns, adding any missing columns from catalog
      const existingKeys = new Set(columns.map((c) => c.key));
      const merged = [...columns];
      CUSTOM_VIEW_COLUMNS.forEach((col, i) => {
        if (!existingKeys.has(col.key)) {
          merged.push({ key: col.key, label: col.label, visible: false, order: 100 + i });
        }
      });
      setLocalColumns(merged);
    }
  }, [open, columns]);

  const toggle = (key: string) => {
    setLocalColumns((prev) => {
      const col = prev.find((c) => c.key === key);
      if (!col) return prev;
      if (col.visible) {
        // Toggling off — just set invisible
        return prev.map((c) => (c.key === key ? { ...c, visible: false } : c));
      }
      // Toggling on — append to end of visible list
      const maxVisibleOrder = Math.max(0, ...prev.filter((c) => c.visible).map((c) => c.order));
      return prev.map((c) =>
        c.key === key ? { ...c, visible: true, order: maxVisibleOrder + 1 } : c,
      );
    });
  };

  const selectAll = () => {
    setLocalColumns((prev) => prev.map((c) => ({ ...c, visible: true })));
  };

  const selectNone = () => {
    setLocalColumns((prev) => prev.map((c) => ({ ...c, visible: false })));
  };

  const moveColumn = (key: string, direction: 'up' | 'down') => {
    setLocalColumns((prev) => {
      const visible = prev
        .filter((c) => c.visible)
        .sort((a, b) => a.order - b.order);
      const idx = visible.findIndex((c) => c.key === key);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= visible.length) return prev;

      // Swap order values between the two adjacent visible columns
      const keyA = visible[idx].key;
      const keyB = visible[swapIdx].key;
      const orderA = visible[idx].order;
      const orderB = visible[swapIdx].order;

      return prev.map((c) => {
        if (c.key === keyA) return { ...c, order: orderB };
        if (c.key === keyB) return { ...c, order: orderA };
        return c;
      });
    });
  };

  const renameColumn = (key: string, newLabel: string) => {
    setLocalColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, label: newLabel } : c)),
    );
  };

  const handleSave = () => {
    // Preserve user's ordering for visible columns, then append hidden
    const visible = localColumns
      .filter((c) => c.visible)
      .sort((a, b) => a.order - b.order);
    const hidden = localColumns.filter((c) => !c.visible);
    const reordered = [...visible, ...hidden].map((c, i) => ({ ...c, order: i }));
    onSave(reordered);
    onOpenChange(false);
  };

  const visibleSorted = localColumns
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Columns{tabName ? ` — ${tabName}` : ''}</DialogTitle>
        </DialogHeader>

        {/* Column Order section */}
        {visibleSorted.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold text-sm text-gray-600 mb-2">Column Order</h4>
            <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
              {visibleSorted.map((col, idx) => (
                <div
                  key={col.key}
                  className="flex items-center justify-between px-3 py-1.5 text-sm gap-2"
                >
                  <Input
                    value={col.label}
                    onChange={(e) => renameColumn(col.key, e.target.value)}
                    className="h-7 text-sm flex-1"
                  />
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={idx === 0}
                      onClick={() => moveColumn(col.key, 'up')}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={idx === visibleSorted.length - 1}
                      onClick={() => moveColumn(col.key, 'down')}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show/Hide Columns section */}
        <div>
          <h4 className="font-semibold text-sm text-gray-600 mb-2">Show / Hide Columns</h4>
          <div className="flex gap-2 mb-3">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={selectNone}>
              Deselect All
            </Button>
          </div>

          {Object.entries(grouped).map(([category, cols]) => (
            <div key={category} className="mb-4">
              <h4 className="font-semibold text-sm text-gray-600 mb-2">{category}</h4>
              <div className="grid grid-cols-2 gap-1">
                {cols.map((col) => {
                  const localCol = localColumns.find((c) => c.key === col.key);
                  const isVisible = localCol?.visible ?? false;
                  return (
                    <div key={col.key} className="flex items-center gap-2 text-sm py-1">
                      <Checkbox
                        checked={isVisible}
                        onCheckedChange={() => toggle(col.key)}
                      />
                      {isVisible ? (
                        <Input
                          value={localCol?.label ?? col.label}
                          onChange={(e) => renameColumn(col.key, e.target.value)}
                          className="h-7 text-sm flex-1"
                        />
                      ) : (
                        <label className="cursor-pointer" onClick={() => toggle(col.key)}>
                          {localCol?.label ?? col.label}
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
