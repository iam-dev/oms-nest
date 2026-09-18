import { saddlePriceFor, orderTotal, currencyCodeFor, formatMoney } from '@/utils/orderPricing';

describe('orderPricing', () => {
  // saddle_leathers row for Aviar Rook 2.0 / ASBLV as on staging
  const rook2Asblv = { price1: 6595, price2: 5095, price3: 4795, price4: 7195, price5: 7195, price6: 5095, price7: 5695 };

  it('picks the saddle price column for the fitter currency (legacy priceN)', () => {
    expect(saddlePriceFor(rook2Asblv, 1)).toBe(6595); // USD
    expect(saddlePriceFor(rook2Asblv, 7)).toBe(5695); // DE
  });

  it('falls back to price1 for an unknown currency and to 0 without a leather', () => {
    expect(saddlePriceFor(rook2Asblv, 0)).toBe(6595);
    expect(saddlePriceFor(rook2Asblv, undefined)).toBe(6595);
    expect(saddlePriceFor(undefined, 1)).toBe(0);
  });

  it('totals like the legacy form: saddle − tradein − deposit − discount + the rest', () => {
    expect(orderTotal({ saddle: '5195', tradein: '0', deposit: '0', discount: '0', fittingeval: '0', callfee: '0', girth: '0', additional: '290', shipping: '', tax: '' })).toBe(5485);
    expect(orderTotal({ saddle: 1000, tradein: 100, deposit: 200, discount: 50, fittingeval: 10, callfee: 20, girth: 30, additional: 40, shipping: 5, tax: 6 })).toBe(761);
  });

  it('maps legacy currency ids to codes (1 USD … 7 DE) and defaults to USD', () => {
    expect(currencyCodeFor(1)).toBe('USD');
    expect(currencyCodeFor(2)).toBe('EUR');
    expect(currencyCodeFor(4)).toBe('CAN');
    expect(currencyCodeFor(7)).toBe('DE');
    expect(currencyCodeFor(0)).toBe('USD');
    expect(currencyCodeFor(undefined)).toBe('USD');
  });

  it('formats money with two decimals', () => {
    expect(formatMoney(6595)).toBe('6595.00');
  });
});
