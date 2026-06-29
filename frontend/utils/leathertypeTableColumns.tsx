import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';

export type LeathertypeHeaderFilters = {
  id?: string;
  name?: string;
  sequence?: string;
  active?: string;
  description?: string;
};

export type SetLeathertypeHeaderFilters = (key: keyof LeathertypeHeaderFilters, value: string) => void;

export function getLeathertypeTableColumns(headerFilters: LeathertypeHeaderFilters, setHeaderFilters: SetLeathertypeHeaderFilters) {
  return [
    {
      key: 'id',
      title: (
        <TableHeaderFilter
          title="ID"
          value={headerFilters.id || ''}
          onFilter={value => setHeaderFilters('id', value)}
          type="text"
          entityType="leathertype"
        />
      ),
      render: (v: unknown) => v ?? '',
    },
    {
      key: 'sequence',
      title: (
        <TableHeaderFilter
          title="SEQUENCE"
          value={headerFilters.sequence || ''}
          onFilter={value => setHeaderFilters('sequence', value)}
          type="text"
          entityType="leathertype"
        />
      ),
      render: (v: unknown) => v ?? '',
    },
    {
      key: 'name',
      title: (
        <TableHeaderFilter
          title="NAME"
          value={headerFilters.name || ''}
          onFilter={value => setHeaderFilters('name', value)}
          type="text"
          entityType="leathertype"
        />
      ),
      render: (v: unknown) => v ?? '',
    },
    {
      key: 'active',
      title: (
        <TableHeaderFilter
          title="ACTIVE"
          value={headerFilters.active || ''}
          onFilter={value => setHeaderFilters('active', value)}
          type="select"
          entityType="leathertype"
          data={[
            { value: '', label: 'All' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' }
          ]}
        />
      ),
      render: (v: unknown) => v ? 'Yes' : 'No',
    },
    {
      key: 'description',
      title: (
        <TableHeaderFilter
          title="DESCRIPTION"
          value={headerFilters.description || ''}
          onFilter={value => setHeaderFilters('description', value)}
          type="text"
          entityType="leathertype"
        />
      ),
      render: (v: unknown) => v ?? '',
    },
  ];
}