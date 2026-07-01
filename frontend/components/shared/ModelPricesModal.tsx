"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Pencil, Check, X } from 'lucide-react';
import { Model } from '@/services/models';
import { fetchLeathertypes, Leathertype } from '@/services/leathertypes';
import {
  fetchSaddleLeathersBySaddleId,
  createSaddleLeather,
  updateSaddleLeather,
  deleteSaddleLeather,
  SaddleLeather,
} from '@/services/saddleLeathers';
import { logger } from '@/utils/logger';

interface ModelPricesModalProps {
  model: Model | null;
  isOpen: boolean;
  onClose: () => void;
}

const PRICE_LABELS = ['$', '\u20AC', '\u00A3', 'C$', 'A$', 'N\u20AC', 'D\u20AC'];

interface LeatherRow {
  leather: Leathertype;
  saddleLeather: SaddleLeather | null;
  checked: boolean;
}

export function ModelPricesModal({ model, isOpen, onClose }: ModelPricesModalProps) {
  const [rows, setRows] = useState<LeatherRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrices, setEditPrices] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  const loadData = useCallback(async () => {
    if (!model) return;
    setLoading(true);
    try {
      const [leathertypesRes, saddleLeathers] = await Promise.all([
        fetchLeathertypes({ page: 1, orderBy: 'sequence', order: 'asc' }),
        fetchSaddleLeathersBySaddleId(Number(model.id)),
      ]);

      const leathertypes = leathertypesRes['hydra:member'] || [];
      const slMap = new Map<number, SaddleLeather>();
      saddleLeathers.forEach((sl: SaddleLeather) => {
        slMap.set(sl.leatherId, sl);
      });

      const newRows: LeatherRow[] = leathertypes.map((lt: Leathertype) => {
        const sl = slMap.get(Number(lt.id)) || null;
        return {
          leather: lt,
          saddleLeather: sl,
          checked: sl !== null,
        };
      });

      setRows(newRows);
    } catch (error) {
      logger.error('Error loading prices data:', error);
    } finally {
      setLoading(false);
    }
  }, [model]);

  useEffect(() => {
    if (isOpen && model) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(react-hooks): loadData triggers async fetch+setState; setEditingId resets UI on open
      loadData();
      setEditingId(null);
    }
  }, [isOpen, model, loadData]);

  const handleCheckboxToggle = async (index: number) => {
    if (!model || saving) return;
    const row = rows[index];
    setSaving(true);
    try {
      if (row.checked && row.saddleLeather) {
        await deleteSaddleLeather(row.saddleLeather.id);
        setRows(prev => prev.map((r, i) =>
          i === index ? { ...r, checked: false, saddleLeather: null } : r
        ));
      } else {
        const created = await createSaddleLeather({
          saddleId: Number(model.id),
          leatherId: Number(row.leather.id),
        });
        setRows(prev => prev.map((r, i) =>
          i === index ? { ...r, checked: true, saddleLeather: created } : r
        ));
      }
    } catch (error) {
      logger.error('Error toggling leather association:', error);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: LeatherRow) => {
    if (!row.saddleLeather) return;
    setEditingId(row.leather.id);
    setEditPrices([
      row.saddleLeather.price1 || 0,
      row.saddleLeather.price2 || 0,
      row.saddleLeather.price3 || 0,
      row.saddleLeather.price4 || 0,
      row.saddleLeather.price5 || 0,
      row.saddleLeather.price6 || 0,
      row.saddleLeather.price7 || 0,
    ]);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (row: LeatherRow) => {
    if (!row.saddleLeather) return;
    setSaving(true);
    try {
      const updated = await updateSaddleLeather(row.saddleLeather.id, {
        price1: editPrices[0],
        price2: editPrices[1],
        price3: editPrices[2],
        price4: editPrices[3],
        price5: editPrices[4],
        price6: editPrices[5],
        price7: editPrices[6],
      });
      setRows(prev => prev.map(r =>
        r.leather.id === row.leather.id ? { ...r, saddleLeather: updated } : r
      ));
      setEditingId(null);
    } catch (error) {
      logger.error('Error saving prices:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!model) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Prices</DialogTitle>
          <DialogDescription>
            Manage available leathertypes &amp; prices for {model.brandName} {model.name}
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
                  <th className="p-2 text-left">Leather</th>
                  {PRICE_LABELS.map(label => (
                    <th key={label} className="p-2 text-right min-w-[70px]">{label}</th>
                  ))}
                  <th className="p-2 text-center w-20"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.leather.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={row.checked}
                        onChange={() => handleCheckboxToggle(index)}
                        disabled={saving}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="p-2 font-medium">{row.leather.name}</td>
                    {editingId === row.leather.id ? (
                      <>
                        {editPrices.map((price, pi) => (
                          <td key={pi} className="p-1">
                            <Input
                              type="number"
                              value={price}
                              onChange={e => {
                                const newPrices = [...editPrices];
                                newPrices[pi] = Number(e.target.value) || 0;
                                setEditPrices(newPrices);
                              }}
                              className="h-7 w-[70px] text-right text-xs"
                            />
                          </td>
                        ))}
                        <td className="p-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => saveEdit(row)}
                              disabled={saving}
                            >
                              <Check className="h-3 w-3 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={cancelEdit}
                            >
                              <X className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        {[
                          row.saddleLeather?.price1,
                          row.saddleLeather?.price2,
                          row.saddleLeather?.price3,
                          row.saddleLeather?.price4,
                          row.saddleLeather?.price5,
                          row.saddleLeather?.price6,
                          row.saddleLeather?.price7,
                        ].map((price, pi) => (
                          <td key={pi} className="p-2 text-right text-gray-600">
                            {row.checked ? (price || 0) : '-'}
                          </td>
                        ))}
                        <td className="p-2 text-center">
                          {row.checked && row.saddleLeather && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => startEdit(row)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-4 text-center text-gray-500">
                      No leathertypes found
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
