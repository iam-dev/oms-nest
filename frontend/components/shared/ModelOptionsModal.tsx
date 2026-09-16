"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Model } from '@/services/models';
import { fetchOptions, Option } from '@/services/options';
import { fetchLeathertypes, Leathertype } from '@/services/leathertypes';
import { fetchOptionsItemsByOptionId, OptionItem } from '@/services/optionsItems';
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

/**
 * How "available options" are stored (legacy `saddle_options_items`):
 *
 * - option enabled on a saddle  → row (optionId, optionItemId = 0, leatherId = 0)
 * - item enabled (custom option, type 0) → row (optionId, optionItemId = item.id, leatherId = 0)
 * - leather enabled (leather option, type 1) → row (optionId, optionItemId = 0, leatherId = item.leatherId)
 *
 * Extras (type 2) use the same table but are managed in the Extra's dialog.
 */
interface OptionRow {
  option: Option;
  /** Active saddle_options_items rows for this option (header + items). */
  links: SaddleOptionsItem[];
  checked: boolean;
  expanded: boolean;
  items?: OptionItem[];
  itemsLoading?: boolean;
}

const ALL_OPTIONS_LIMIT = 500;
const ALL_LEATHERTYPES_LIMIT = 500;
const EXTRAS_TYPE = 2;
const LEATHER_OPTION_TYPE = 1;

const isHeaderLink = (soi: SaddleOptionsItem) => soi.optionItemId === 0 && soi.leatherId === 0;

function findItemLink(row: OptionRow, item: OptionItem): SaddleOptionsItem | undefined {
  if (row.option.type === LEATHER_OPTION_TYPE) {
    return row.links.find(l => l.optionItemId === 0 && l.leatherId !== 0 && l.leatherId === item.leatherId);
  }
  return row.links.find(l => l.optionItemId === item.id);
}

export function ModelOptionsModal({ model, isOpen, onClose }: ModelOptionsModalProps) {
  const [rows, setRows] = useState<OptionRow[]>([]);
  const [leatherNames, setLeatherNames] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!model) return;
    setLoading(true);
    try {
      const [optionsRes, saddleOptionsItems, leathertypesRes] = await Promise.all([
        fetchOptions({ page: 1, limit: ALL_OPTIONS_LIMIT, excludeType: EXTRAS_TYPE, orderBy: 'sequence', order: 'asc' }),
        fetchSaddleOptionsItemsBySaddleId(Number(model.id)),
        // Include deleted leathertypes: legacy option items may still point at them
        fetchLeathertypes({ page: 1, limit: ALL_LEATHERTYPES_LIMIT, includeDeleted: true, orderBy: 'sequence', order: 'asc' }),
      ]);

      const options = optionsRes['hydra:member'] || [];
      const soiMap = new Map<number, SaddleOptionsItem[]>();
      saddleOptionsItems.forEach((soi: SaddleOptionsItem) => {
        const existing = soiMap.get(soi.optionId) || [];
        existing.push(soi);
        soiMap.set(soi.optionId, existing);
      });

      setLeatherNames(
        new Map(
          (leathertypesRes['hydra:member'] || []).map((lt: Leathertype) => [
            Number(lt.id),
            lt.active === false ? `${lt.name} (deleted leathertype)` : lt.name,
          ])
        )
      );
      setRows(
        options.map((option: Option) => {
          const links = soiMap.get(Number(option.id)) || [];
          return { option, links, checked: links.length > 0, expanded: false };
        })
      );
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

  const updateRow = (index: number, patch: Partial<OptionRow> | ((row: OptionRow) => Partial<OptionRow>)) => {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r)));
  };

  const handleOptionToggle = async (index: number) => {
    if (!model || saving) return;
    const row = rows[index];
    setSaving(true);
    try {
      if (row.checked) {
        // Disabling an option drops all of its item links for this saddle too
        await Promise.all(row.links.map(soi => deleteSaddleOptionsItem(soi.id)));
        updateRow(index, { checked: false, links: [] });
      } else {
        const created = await createSaddleOptionsItem({
          saddleId: Number(model.id),
          optionId: Number(row.option.id),
          optionItemId: 0,
          leatherId: 0,
        });
        updateRow(index, { checked: true, links: [created] });
      }
    } catch (error) {
      logger.error('Error toggling option association:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleExpand = async (index: number) => {
    const row = rows[index];
    if (row.expanded) {
      updateRow(index, { expanded: false });
      return;
    }
    updateRow(index, { expanded: true, itemsLoading: row.items === undefined });
    if (row.items !== undefined) return;
    try {
      const items = await fetchOptionsItemsByOptionId(Number(row.option.id));
      updateRow(index, { items, itemsLoading: false });
    } catch (error) {
      logger.error('Error loading option items:', error);
      updateRow(index, { items: [], itemsLoading: false });
    }
  };

  const handleItemToggle = async (index: number, item: OptionItem) => {
    if (!model || saving) return;
    const row = rows[index];
    const existing = findItemLink(row, item);
    setSaving(true);
    try {
      if (existing) {
        await deleteSaddleOptionsItem(existing.id);
        updateRow(index, r => ({ links: r.links.filter(l => l.id !== existing.id) }));
      } else {
        const newLinks: SaddleOptionsItem[] = [];
        // An item can only be available if its option is; add the header link when missing
        if (!row.links.some(isHeaderLink)) {
          newLinks.push(
            await createSaddleOptionsItem({
              saddleId: Number(model.id),
              optionId: Number(row.option.id),
              optionItemId: 0,
              leatherId: 0,
            })
          );
        }
        const isLeather = row.option.type === LEATHER_OPTION_TYPE;
        newLinks.push(
          await createSaddleOptionsItem({
            saddleId: Number(model.id),
            optionId: Number(row.option.id),
            optionItemId: isLeather ? 0 : item.id,
            leatherId: isLeather ? item.leatherId : 0,
          })
        );
        updateRow(index, r => ({ checked: true, links: [...r.links, ...newLinks] }));
      }
    } catch (error) {
      logger.error('Error toggling option item association:', error);
    } finally {
      setSaving(false);
    }
  };

  const itemLabel = (row: OptionRow, item: OptionItem): string => {
    if (row.option.type === LEATHER_OPTION_TYPE) {
      return leatherNames.get(item.leatherId) || item.name || `Leather #${item.leatherId}`;
    }
    return item.name;
  };

  if (!model) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
              <div key={row.option.id} className="border-b" data-testid={`option-row-${row.option.id}`}>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={() => handleOptionToggle(index)}
                    disabled={saving}
                    className="rounded border-gray-300"
                    aria-label={row.option.name}
                  />
                  <span className="text-sm font-medium flex-1">{row.option.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleExpand(index)}
                    aria-label={`${row.expanded ? 'Hide' : 'Show'} items for ${row.option.name}`}
                    aria-expanded={row.expanded}
                  >
                    {row.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>

                {row.expanded && (
                  <div className="ml-8 mb-2 border-l pl-3 space-y-0.5">
                    {row.itemsLoading ? (
                      <div className="flex items-center text-xs text-gray-500 py-1">
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                        Loading items...
                      </div>
                    ) : (row.items ?? []).length === 0 ? (
                      <div className="text-xs text-gray-500 py-1">No items for this option</div>
                    ) : (
                      (row.items ?? []).map(item => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 py-0.5 text-sm text-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={!!findItemLink(row, item)}
                            onChange={() => handleItemToggle(index, item)}
                            disabled={saving}
                            className="rounded border-gray-300"
                          />
                          <span>{itemLabel(row, item)}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
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
