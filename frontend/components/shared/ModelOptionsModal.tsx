"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Model } from '@/services/models';
import { fetchOptions, Option } from '@/services/options';
import {
  fetchSaddleOptionsItemsBySaddleId,
  createSaddleOptionsItem,
  deleteSaddleOptionsItem,
  SaddleOptionsItem,
} from '@/services/saddleOptionsItems';
import { logger } from '@/utils/logger';

interface ModelOptionsModalProps {
  model: Model | null;
  isOpen: boolean;
  onClose: () => void;
}

interface OptionRow {
  option: Option;
  saddleOptionsItems: SaddleOptionsItem[];
  checked: boolean;
}

export function ModelOptionsModal({ model, isOpen, onClose }: ModelOptionsModalProps) {
  const [rows, setRows] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!model) return;
    setLoading(true);
    try {
      const [optionsRes, saddleOptionsItems] = await Promise.all([
        fetchOptions({ page: 1, orderBy: 'sequence', order: 'asc' }),
        fetchSaddleOptionsItemsBySaddleId(Number(model.id)),
      ]);

      const options = optionsRes['hydra:member'] || [];
      const soiMap = new Map<number, SaddleOptionsItem[]>();
      saddleOptionsItems.forEach((soi: SaddleOptionsItem) => {
        const existing = soiMap.get(soi.optionId) || [];
        existing.push(soi);
        soiMap.set(soi.optionId, existing);
      });

      const newRows: OptionRow[] = options.map((option: Option) => {
        const items = soiMap.get(Number(option.id)) || [];
        return {
          option,
          saddleOptionsItems: items,
          checked: items.length > 0,
        };
      });

      setRows(newRows);
    } catch (error) {
      logger.error('Error loading options data:', error);
    } finally {
      setLoading(false);
    }
  }, [model]);

  useEffect(() => {
    if (isOpen && model) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(react-hooks): loadData triggers async fetch+setState; standard data-on-open pattern
      loadData();
    }
  }, [isOpen, model, loadData]);

  const handleCheckboxToggle = async (index: number) => {
    if (!model || saving) return;
    const row = rows[index];
    setSaving(true);
    try {
      if (row.checked && row.saddleOptionsItems.length > 0) {
        // Delete all saddle-options-items for this option
        await Promise.all(
          row.saddleOptionsItems.map(soi => deleteSaddleOptionsItem(soi.id))
        );
        setRows(prev => prev.map((r, i) =>
          i === index ? { ...r, checked: false, saddleOptionsItems: [] } : r
        ));
      } else {
        // Create a default saddle-options-item for this option
        const created = await createSaddleOptionsItem({
          saddleId: Number(model.id),
          optionId: Number(row.option.id),
          optionItemId: 0,
          leatherId: 0,
        });
        setRows(prev => prev.map((r, i) =>
          i === index ? { ...r, checked: true, saddleOptionsItems: [created] } : r
        ));
      }
    } catch (error) {
      logger.error('Error toggling option association:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!model) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Options</DialogTitle>
          <DialogDescription>
            Manage available options for {model.brandName} {model.name}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          <div className="space-y-1">
            {rows.map((row, index) => (
              <div
                key={row.option.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 border-b"
              >
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={() => handleCheckboxToggle(index)}
                  disabled={saving}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium flex-1">{row.option.name}</span>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                No options found
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
