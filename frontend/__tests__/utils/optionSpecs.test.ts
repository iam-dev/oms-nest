import { CUSTOMIZED_BY_FITTER_ID, CUSTOMIZED_BY_FITTER_LABEL, specInputsForItem, itemsWithCustomized } from '@/utils/optionSpecs';

describe('optionSpecs', () => {
  it('asks for free text when "Customized by fitter" (item 0) is chosen', () => {
    expect(specInputsForItem(CUSTOMIZED_BY_FITTER_ID, undefined)).toEqual({ custom: true, color: false, leather: false });
  });

  it('asks for colour / leather from the item flags', () => {
    expect(specInputsForItem('4660', { name: 'Aviar STD Inlaid', userColor: 1, userLeather: 0 })).toEqual({ custom: false, color: true, leather: false });
    expect(specInputsForItem('36', { name: 'CUS - CUSTOM LEATHER', userColor: 1, userLeather: 1 })).toEqual({ custom: false, color: true, leather: true });
  });

  it('also asks for colour when the item name mentions color (legacy orders.js quirk)', () => {
    expect(specInputsForItem('3803', { name: 'Aviar Feather Loop (Choose: Blk,Brn,Red) color' })).toMatchObject({ color: true });
    expect(specInputsForItem('7', { name: 'MOCK CROC(Specifiy Color)' })).toMatchObject({ color: true });
  });

  it('asks nothing for an unknown item', () => {
    expect(specInputsForItem('99', undefined)).toEqual({ custom: false, color: false, leather: false });
  });

  it('appends the Customized by fitter entry after the model items', () => {
    const out = itemsWithCustomized([{ id: 4, name: '16.5' }]);
    expect(out).toEqual([{ id: 4, name: '16.5' }, { id: CUSTOMIZED_BY_FITTER_ID, name: CUSTOMIZED_BY_FITTER_LABEL }]);
  });
});
