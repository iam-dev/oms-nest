"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Model } from '@/services/models';
import { fetchExtras, Extra } from '@/services/extras';
import {
  fetchSaddleOptionsItemsBySaddleId,
  createSaddleOptionsItem,
  deleteSaddleOptionsItem,
  SaddleOptionsItem,
} from '@/services/saddleOptionsItems';
import { logger } from '@/utils/logger';

interface ModelExtrasModalProps {
  model: Model | null;
  isOpen: boolean;
  onClose: () => void;
}

const PRICE_LABELS = ['$', '\u20AC', '\u00A3', 'C$', 'A$', 'N\u20AC', 'D\u20AC'];

/**
 * Extras are `options` rows with `type = 2`, and "extra X is available on
 * saddle Y" is a `saddle_options_items` row with `optionItemId = 0` and
 * `leatherId = 0` — exactly how the legacy OMS (and every existing order)
 * references them. The separate `saddle_extras` table is not used.
 */
interface ExtraRow {
  extra: Extra;
  saddleExtra: SaddleOptionsItem | null;
  checked: boolean;
}

const ALL_EXTRAS_LIMIT = 100;

const isExtraLink = (soi: SaddleOptionsItem) =>
  soi.optionItemId === 0 && soi.leatherId === 0;

export function ModelExtrasModal({ model, isOpen, onClose }: ModelExtrasModalProps) {
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!model) return;
    setLoading(true);
    try {
      const [extrasRes, saddleOptionsItems] = await Promise.all([
        fetchExtras({ page: 1, limit: ALL_EXTRAS_LIMIT, orderBy: 'sequence', order: 'asc' }),
        fetchSaddleOptionsItemsBySaddleId(Number(model.id)),
      ]);

      const extras = extrasRes['hydra:member'] || [];
      const seMap = new Map<number, SaddleOptionsItem>();
      saddleOptionsItems.filter(isExtraLink).forEach((soi: SaddleOptionsItem) => {
        seMap.set(soi.optionId, soi);
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
        await deleteSaddleOptionsItem(row.saddleExtra.id);
        setRows(prev => prev.map((r, i) =>
          i === index ? { ...r, checked: false, saddleExtra: null } : r
        ));
      } else {
        const created = await createSaddleOptionsItem({
          saddleId: Number(model.id),
          optionId: Number(row.extra.id),
          optionItemId: 0,
          leatherId: 0,
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
