/**
 * An order may carry several rows of the same option (legacy
 * orders_info.clone_number: 0 for the first row, 1, 2, … for the extras an
 * option with options.extra_allowed > 0 may have).  The editors key their
 * per-option state by a "slot" so each row has its own selection and text.
 */

/** State key for one row of an option. */
export const slotKey = (optionId: number, clone = 0): string => `${optionId}:${clone}`;

/** Option id encoded in a slot key. */
export const slotOptionId = (key: string): number => Number(key.split(':')[0]);

/** Legacy label: the first row is the bare name, extras are "Name (2)", "Name (3)", … */
export const slotLabel = (name: string, clone = 0): string =>
  clone > 0 ? `${name} (${clone + 1})` : name;

/** Strip the suffix slotLabel adds: "CANTLE Option (2)" -> "CANTLE Option". */
export const baseOptionName = (name: string): string => name.replace(/ \(\d+\)$/, '');
