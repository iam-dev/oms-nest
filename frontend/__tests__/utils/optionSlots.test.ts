import { slotKey, slotOptionId, slotLabel, baseOptionName } from '@/utils/optionSlots';

describe('optionSlots', () => {
  it('slotKey defaults to clone 0 and slotOptionId reads the option back', () => {
    expect(slotKey(4)).toBe('4:0');
    expect(slotKey(4, 2)).toBe('4:2');
    expect(slotOptionId('4:2')).toBe(4);
  });

  it('slotLabel matches the legacy "(n)" suffix for clones only', () => {
    expect(slotLabel('CANTLE Option')).toBe('CANTLE Option');
    expect(slotLabel('CANTLE Option', 1)).toBe('CANTLE Option (2)');
  });

  it('baseOptionName strips the suffix slotLabel adds and leaves other names alone', () => {
    expect(baseOptionName(slotLabel('CANTLE Option', 1))).toBe('CANTLE Option');
    expect(baseOptionName('CANTLE Option')).toBe('CANTLE Option');
    expect(baseOptionName('AVIAR Model (please enter model)')).toBe('AVIAR Model (please enter model)');
  });
});
