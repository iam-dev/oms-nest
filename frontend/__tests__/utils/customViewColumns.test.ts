import { CUSTOM_VIEW_COLUMNS } from '@/utils/customViewColumns';

const column = (key: string) => CUSTOM_VIEW_COLUMNS.find(c => c.key === key)!;

describe('customViewColumns saddle spec columns', () => {
  it('joins every CANTLE Option row, including "(2)" clones, with " / "', () => {
    const row = {
      _saddleSpecs: [
        { optionId: 4, optionName: 'CANTLE Option', displayValue: '2 cm cut of cantle' },
        { optionId: 4, optionName: 'CANTLE Option (2)', displayValue: 'inserted cantle with crystals' },
      ],
    };
    expect(column('cantle').getValue(row)).toBe('2 cm cut of cantle / inserted cantle with crystals');
  });

  it('still returns a single value for a single-row option', () => {
    const row = { _saddleSpecs: [{ optionId: 7, optionName: 'Loops', displayValue: 'STD - LOOPS' }] };
    expect(column('loops').getValue(row)).toBe('STD - LOOPS');
  });

  it('returns an empty string when the option is absent', () => {
    expect(column('cantle').getValue({ _saddleSpecs: [] })).toBe('');
    expect(column('cantle').getValue({})).toBe('');
  });
});
