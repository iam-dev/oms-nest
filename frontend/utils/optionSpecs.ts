/**
 * Legacy sentinel: orders_info.option_item_id = 0 means "Customized by fitter",
 * with the fitter's free text stored in orders_info.custom. Every option select
 * on the legacy form ends with this entry.
 */
export const CUSTOMIZED_BY_FITTER_ID = '0';
export const CUSTOMIZED_BY_FITTER_LABEL = 'Customized by fitter';

/** Which text boxes a selected item asks for (legacy -custom / -color / -leather inputs). */
export interface SpecInputs {
  custom: boolean;
  color: boolean;
  leather: boolean;
}

export const NO_SPEC_INPUTS: SpecInputs = { custom: false, color: false, leather: false };

export function specInputsForItem(
  selectedItemId: string,
  item?: { name: string; userColor?: number; userLeather?: number },
): SpecInputs {
  if (selectedItemId === CUSTOMIZED_BY_FITTER_ID) {
    return { custom: true, color: false, leather: false };
  }
  if (!item) return NO_SPEC_INPUTS;
  // Legacy orders.js also shows the colour box when the item name mentions
  // "color"/"Color" (case-sensitive), regardless of the user_color flag.
  const nameAsksColor = item.name.includes('color') || item.name.includes('Color');
  return { custom: false, color: !!item.userColor || nameAsksColor, leather: !!item.userLeather };
}

/** The model's items followed by the legacy "Customized by fitter" entry. */
export function itemsWithCustomized<T extends { id: number | string; name: string }>(
  items: T[],
): Array<T | { id: string; name: string }> {
  return [...items, { id: CUSTOMIZED_BY_FITTER_ID, name: CUSTOMIZED_BY_FITTER_LABEL }];
}
