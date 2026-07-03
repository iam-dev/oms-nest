import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';

export type ExtraHeaderFilters = {
  id?: string;
  name?: string;
  sequence?: string;
  active?: string;
  description?: string;
};

export type SetExtraHeaderFilters = (key: keyof ExtraHeaderFilters, value: string) => void;

const formatPrice = (v: unknown, symbol: string) => {
  const numValue = typeof v === 'number' ? v : parseFloat(String(v));
  return !isNaN(numValue) ? `${symbol} ${numValue.toFixed(2)}` : `${symbol} 0.00`;
};

export function getExtraTableColumns(headerFilters: ExtraHeaderFilters, setHeaderFilters: SetExtraHeaderFilters) {
  return [
    {
      key: 'name',
      title: (
        <TableHeaderFilter
          title="EXTRA"
          value={headerFilters.name || ''}
          onFilter={value => setHeaderFilters('name', value)}
          type="text"
          entityType="extra"
        />
      ),
      render: (v: unknown) => (v != null ? String(v) : ''),
      maxWidth: '200px',
    },
    {
      key: 'price1',
      title: 'USD',
      render: (v: unknown) => formatPrice(v, '$'),
      maxWidth: '100px',
    },
    {
      key: 'price2',
      title: 'EUR',
      render: (v: unknown) => formatPrice(v, '€'),
      maxWidth: '100px',
    },
    {
      key: 'price3',
      title: 'GBP',
      render: (v: unknown) => formatPrice(v, '£'),
      maxWidth: '100px',
    },
    {
      key: 'price4',
      title: 'CAD',
      render: (v: unknown) => formatPrice(v, 'C$'),
      maxWidth: '100px',
    },
    {
      key: 'price5',
      title: 'AUD',
      render: (v: unknown) => formatPrice(v, 'A$'),
      maxWidth: '100px',
    },
    {
      key: 'price6',
      title: 'NOK',
      render: (v: unknown) => formatPrice(v, 'N€'),
      maxWidth: '100px',
    },
    {
      key: 'price7',
      title: 'DKK',
      render: (v: unknown) => formatPrice(v, 'D€'),
      maxWidth: '100px',
    },
    {
      key: 'options',
      title: 'OPTIONS',
      render: () => null,
      maxWidth: '150px',
    }
  ];
}
