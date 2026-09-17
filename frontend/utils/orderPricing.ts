import { FITTER_CURRENCIES } from '@/services/fitters';

/** A saddle_leathers row: one price per legacy currency id (1 USD … 7 DE). */
export type PricedLeather = {
  price1?: number; price2?: number; price3?: number; price4?: number;
  price5?: number; price6?: number; price7?: number;
};

/** Legacy fills "Saddle price" from saddle_leathers.price<fitter.currency> when the leather is chosen. */
export function saddlePriceFor(leather: PricedLeather | undefined, currencyId: number | undefined): number {
  if (!leather) return 0;
  const key = `price${currencyId ?? 0}` as keyof PricedLeather;
  const byCurrency = leather[key];
  if (typeof byCurrency === 'number') return byCurrency;
  return leather.price1 ?? 0;
}

export interface OrderPriceFields {
  saddle: string | number; tradein: string | number; deposit: string | number; discount: string | number;
  fittingeval: string | number; callfee: string | number; girth: string | number; additional: string | number;
  shipping: string | number; tax: string | number;
}

const num = (v: string | number): number => (typeof v === 'number' ? v : parseFloat(v)) || 0;

/** Same formula as legacy and the backend's totalPrice. */
export function orderTotal(p: OrderPriceFields): number {
  return num(p.saddle) - num(p.tradein) - num(p.deposit) - num(p.discount)
    + num(p.fittingeval) + num(p.callfee) + num(p.girth) + num(p.additional)
    + num(p.shipping) + num(p.tax);
}

export function currencyCodeFor(currencyId: number | undefined): string {
  return FITTER_CURRENCIES.find(c => c.id === currencyId)?.code ?? 'USD';
}

export const formatMoney = (n: number): string => n.toFixed(2);
