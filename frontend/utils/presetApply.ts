import { slotKey } from '@/utils/optionSlots';

export interface PresetItem { presetId: number; optionId: number; itemId: number }

/**
 * Selections a preset makes for the first row of each option, the way legacy
 * applies it: a preset value is only applied when the model offers that item.
 * presets_items also carries item_id = 0 rows and ids of purged items; both are
 * skipped (0 would otherwise read as "Customized by fitter").
 */
export function presetSelections(
  presetItems: PresetItem[],
  presetId: number,
  offeredItemIds: (optionId: number) => Array<number | string>,
): Record<string, string> {
  const selections: Record<string, string> = {};
  for (const item of presetItems) {
    if (item.presetId !== presetId || item.itemId === 0) continue;
    const offered = offeredItemIds(item.optionId).map(String);
    if (!offered.includes(String(item.itemId))) continue;
    selections[slotKey(item.optionId)] = String(item.itemId);
  }
  return selections;
}
