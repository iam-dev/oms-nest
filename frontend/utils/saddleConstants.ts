// Saddle type constants

export const SADDLE_TYPES: Record<number, string> = {
  0: 'Dressage',
  1: 'Jumping',
  2: 'All-Purpose',
};

export const SADDLE_TYPE_OPTIONS = [
  { value: 0, label: 'Dressage' },
  { value: 1, label: 'Jumping' },
  { value: 2, label: 'All-Purpose' },
];

export function getSaddleTypeLabel(type?: number | null): string {
  if (type === undefined || type === null) return '-';
  return SADDLE_TYPES[type] ?? 'Unknown';
}

// Factory region labels for display
export const FACTORY_REGIONS: Record<string, string> = {
  factoryEu: 'EU',
  factoryUs: 'US',
  factoryGb: 'GB',
  factoryCa: 'CA',
  factoryAud: 'AUD',
  factoryNl: 'NL',
  factoryDe: 'DE',
};

export const FACTORY_REGION_KEYS = [
  'factoryEu',
  'factoryUs',
  'factoryGb',
  'factoryCa',
  'factoryAud',
  'factoryNl',
  'factoryDe',
] as const;

export type FactoryRegionKey = typeof FACTORY_REGION_KEYS[number];
