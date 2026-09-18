import { presetSelections } from '@/utils/presetApply';

describe('presetSelections', () => {
  // presets_items for AVIAR SMOOTH Black (24) as on staging: Flap Length 16,
  // Seat Shape SLEEK-Normal (not ticked on Rook 2.0), an item_id=0 row and an
  // orphan leather item id.
  const items = [
    { presetId: 24, optionId: 8, itemId: 69 },
    { presetId: 24, optionId: 41, itemId: 5430 },
    { presetId: 24, optionId: 1, itemId: 0 },
    { presetId: 24, optionId: 11, itemId: 7527 },
    { presetId: 25, optionId: 8, itemId: 70 },
  ];
  const offered = (optionId: number) =>
    ({ 8: [68, 69, 70, 71], 41: [6150], 1: [4, 5, 6, 7, 8], 11: [48, 50] } as Record<number, number[]>)[optionId] ?? [];

  it('applies only items the model actually offers (legacy behaviour)', () => {
    expect(presetSelections(items, 24, offered)).toEqual({ '8:0': '69' });
  });

  it('ignores item_id = 0 rows and orphan item ids', () => {
    const result = presetSelections(items, 24, offered);
    expect(result['1:0']).toBeUndefined();
    expect(result['11:0']).toBeUndefined();
  });

  it('only reads rows of the chosen preset', () => {
    expect(presetSelections(items, 25, offered)).toEqual({ '8:0': '70' });
  });
});
