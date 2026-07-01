"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Model } from '@/services/models';
import { fetchExtras, Extra } from '@/services/extras';
import {
  fetchSaddleExtrasBySaddleId,
  createSaddleExtra,
  deleteSaddleExtra,
  SaddleExtra,
} from '@/services/saddleExtras';
import { logger } from '@/utils/logger';

interface ModelExtrasModalProps {
  model: Model | null;
  isOpen: boolean;
  onClose: () => void;
}

const PRICE_LABELS = ['$', '\u20AC', '\u00A3', 'C$', 'A$', 'N\u20AC', 'D\u20AC'];

interface ExtraRow {
  extra: Extra;
  saddleExtra: SaddleExtra | null;
  checked: boolean;
}

export function ModelExtrasModal({ model, isOpen, onClose }: ModelExtrasModalProps) {
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!model) return;
    setLoading(true);
    try {
      const [extrasRes, saddleExtras] = await Promise.all([
        fetchExtras({ page: 1, orderBy: 'sequence', order: 'asc' }),
        fetchSaddleExtrasBySaddleId(Number(model.id)),
      ]);

      const extras = extrasRes['hydra:member'] || [];
      const seMap = new Map<number, SaddleExtra>();
      saddleExtras.forEach((se: SaddleExtra) => {
        seMap.set(se.extraId, se);
      });

      const newRows: ExtraRow[] = extras.map((extra: Extra) => {
        const se = seMap.get(Number(extra.id)) || null;
        return {
          extra,
          saddleExtra: se,
          checked: se !== null,
        };
      });

      setRows(newRows);
    } catch (error) {
      logger.error('Error loading extras data:', error);
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
      if (row.checked && row.saddleExtra) {
        await deleteSaddleExtra(row.saddleExtra.id);
        setRows(prev => prev.map((r, i) =>
          i === index ? { ...r, checked: false, saddleExtra: null } : r
        ));
      } else {
        const created = await createSaddleExtra({
          saddleId: Number(model.id),
          extraId: Number(row.extra.id),
        });
        setRows(prev => prev.map((r, i) =>
          i === index ? { ...r, checked: true, saddleExtra: created } : r
        ));
      }
    } catch (error) {
      logger.error('Error toggling extra association:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!model) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Extra&apos;s</DialogTitle>
          <DialogDescription>
            Manage available extra&apos;s for {model.brandName} {model.name}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2 text-left w-8"></th>
                  <th className="p-2 text-left">Extra</th>
                  {PRICE_LABELS.map(label => (
                    <th key={label} className="p-2 text-right min-w-[70px]">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.extra.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={row.checked}
                        onChange={() => handleCheckboxToggle(index)}
                        disabled={saving}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="p-2 font-medium">{row.extra.name}</td>
                    {[
                      row.extra.price1,
                      row.extra.price2,
                      row.extra.price3,
                      row.extra.price4,
                      row.extra.price5,
                      row.extra.price6,
                      row.extra.price7,
                    ].map((price, pi) => (
                      <td key={pi} className="p-2 text-right text-gray-600">
                        {price || 0}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-gray-500">
                      No extras found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
