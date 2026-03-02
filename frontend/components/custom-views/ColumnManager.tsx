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
import { getColumnsByCategory, CUSTOM_VIEW_COLUMNS } from '@/utils/customViewColumns';
import type { ColumnConfig } from '@/services/customOrderViews';

interface ColumnManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnConfig[];
  onSave: (columns: ColumnConfig[]) => void;
}

export function ColumnManager({ open, onOpenChange, columns, onSave }: ColumnManagerProps) {
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
    setLocalColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)),
    );
  };

  const selectAll = () => {
    setLocalColumns((prev) => prev.map((c) => ({ ...c, visible: true })));
  };

  const selectNone = () => {
    setLocalColumns((prev) => prev.map((c) => ({ ...c, visible: false })));
  };

  const handleSave = () => {
    // Re-number order based on visible first, then hidden
    const visible = localColumns.filter((c) => c.visible);
    const hidden = localColumns.filter((c) => !c.visible);
    const reordered = [...visible, ...hidden].map((c, i) => ({ ...c, order: i }));
    onSave(reordered);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Columns</DialogTitle>
        </DialogHeader>

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
                return (
                  <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                    <Checkbox
                      checked={localCol?.visible ?? false}
                      onCheckedChange={() => toggle(col.key)}
                    />
                    {col.label}
                  </label>
                );
              })}
            </div>
          </div>
        ))}

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
