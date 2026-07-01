'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import type { ColumnConfig, ColumnGroupConfig } from '@/services/customOrderViews';

interface ColumnGroupEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnConfig[];
  columnGroups: ColumnGroupConfig[];
  onSave: (columnGroups: ColumnGroupConfig[], columns: ColumnConfig[]) => void;
}

export function ColumnGroupEditor({
  open,
  onOpenChange,
  columns,
  columnGroups,
  onSave,
}: ColumnGroupEditorProps) {
  const [localGroups, setLocalGroups] = useState<ColumnGroupConfig[]>([]);
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>([]);

  const allColumnsSorted = [...localColumns].sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (open) {
      // TODO(react-hooks): syncing dialog-local copies from props when the dialog opens is intentional; not a cascading-render bug
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalGroups(columnGroups.map((g) => ({ ...g, columnKeys: [...g.columnKeys] })));
      setLocalColumns(columns.map((c) => ({ ...c })));
    }
  }, [open, columnGroups, columns]);

  const addGroup = () => {
    setLocalGroups((prev) => [...prev, { label: '', columnKeys: [] }]);
  };

  const removeGroup = (index: number) => {
    setLocalGroups((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLabel = (index: number, label: string) => {
    setLocalGroups((prev) =>
      prev.map((g, i) => (i === index ? { ...g, label } : g)),
    );
  };

  const toggleColumnInGroup = (groupIndex: number, columnKey: string) => {
    setLocalGroups((prev) =>
      prev.map((g, i) => {
        if (i !== groupIndex) return g;
        const has = g.columnKeys.includes(columnKey);
        return {
          ...g,
          columnKeys: has
            ? g.columnKeys.filter((k) => k !== columnKey)
            : [...g.columnKeys, columnKey],
        };
      }),
    );
  };

  const renameColumn = (key: string, newLabel: string) => {
    setLocalColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, label: newLabel } : c)),
    );
  };

  const handleSave = () => {
    // Filter out groups with no label
    const valid = localGroups.filter((g) => g.label.trim());
    onSave(valid, localColumns);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Column Group Headers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {localGroups.map((group, gIdx) => {
            // Keys assigned by OTHER groups (not this one)
            const otherAssigned = new Set(
              localGroups
                .filter((_, i) => i !== gIdx)
                .flatMap((g) => g.columnKeys),
            );

            return (
              <div key={gIdx} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Group label (e.g. SEAT, CANTLE)"
                    value={group.label}
                    onChange={(e) => updateLabel(gIdx, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 shrink-0"
                    onClick={() => removeGroup(gIdx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {allColumnsSorted.map((col) => {
                    const inThisGroup = group.columnKeys.includes(col.key);
                    const inOther = otherAssigned.has(col.key);
                    return (
                      <div
                        key={col.key}
                        className={`flex items-center gap-2 text-sm py-0.5 ${
                          inOther ? 'opacity-40' : ''
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={inThisGroup}
                            disabled={inOther && !inThisGroup}
                            onChange={() => toggleColumnInGroup(gIdx, col.key)}
                            className="rounded"
                          />
                        </label>
                        {inThisGroup ? (
                          <Input
                            value={col.label}
                            onChange={(e) => renameColumn(col.key, e.target.value)}
                            className="h-7 text-sm flex-1"
                          />
                        ) : (
                          <span className={inOther ? 'cursor-not-allowed' : 'cursor-pointer'}
                                onClick={() => { if (!inOther) toggleColumnInGroup(gIdx, col.key); }}>
                            {col.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <Button variant="outline" size="sm" onClick={addGroup}>
            <Plus className="h-4 w-4 mr-1" />
            Add Group
          </Button>
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
