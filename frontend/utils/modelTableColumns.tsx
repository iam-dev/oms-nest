import React from 'react';
import { TableHeaderFilter } from '../components/shared/TableHeaderFilter';
import { Button } from '@/components/ui/button';

export type ModelHeaderFilters = Record<string, string>;
export type SetModelHeaderFilters = (key: string, value: string) => void;

export interface ModelRow {
  id?: string | number;
  name?: string;
  brandName?: string;
  sequence?: string | number;
  active?: boolean;
  [key: string]: unknown;
}

export interface ModelActionCallbacks {
  onInfo?: (model: ModelRow) => void;
  onExtras?: (model: ModelRow) => void;
  onOptions?: (model: ModelRow) => void;
  onPrices?: (model: ModelRow) => void;
}

export function getModelTableColumns(
  headerFilters: ModelHeaderFilters,
  setHeaderFilters: SetModelHeaderFilters,
  actionCallbacks?: ModelActionCallbacks,
) {
  const columns: Array<{
    key: string;
    title: React.ReactNode;
    render: (v: unknown, row?: ModelRow) => React.ReactNode;
    maxWidth: string;
    width?: string;
  }> = [
    {
      key: 'id',
      title: (
        <TableHeaderFilter
          title="ID"
          value={headerFilters.id || ''}
          onFilter={value => setHeaderFilters('id', value)}
          type="text"
          entityType="saddle"
        />
      ),
      render: (v: unknown) => (v != null ? String(v) : ''),
      maxWidth: '200px',
    },
    {
      key: 'name',
      title: (
        <TableHeaderFilter
          title="NAME"
          value={headerFilters.name || ''}
          onFilter={value => setHeaderFilters('name', value)}
          type="text"
          entityType="saddle"
        />
      ),
      render: (v: unknown) => (v != null ? String(v) : ''),
      maxWidth: '200px',
    },
    {
      key: 'brandName',
      title: (
        <TableHeaderFilter
          title="BRAND"
          value={headerFilters.brandName || ''}
          onFilter={value => setHeaderFilters('brandName', value)}
          type="text"
          entityType="saddle"
        />
      ),
      render: (v: unknown) => (v != null ? String(v) : ''),
      maxWidth: '180px',
    },
    {
      key: 'sequence',
      title: (
        <TableHeaderFilter
          title="SEQUENCE"
          value={headerFilters.sequence || ''}
          onFilter={value => setHeaderFilters('sequence', value)}
          type="text"
          entityType="saddle"
        />
      ),
      render: (v: unknown) => (v != null ? String(v) : ''),
      maxWidth: '120px',
    },
    {
      key: 'active',
      title: (
        <TableHeaderFilter
          title="ACTIVE"
          value={headerFilters.active || ''}
          onFilter={value => setHeaderFilters('active', value)}
          type="enum"
          data={[
            { label: 'Active', value: 'true' },
            { label: 'Inactive', value: 'false' }
          ]}
          entityType="saddle"
        />
      ),
      render: (v: unknown) => (v ? 'Yes' : 'No'),
      maxWidth: '100px',
    },
  ];

  if (actionCallbacks) {
    // Same compact pill buttons as the legacy "Manage Saddles" list, kept on
    // one line: the column gets a fixed width so the text columns can't
    // squeeze the buttons onto a second row (or under the cell's truncation).
    const actionButtonClass =
      'h-7 px-2 text-xs font-medium text-[#7b2326] bg-gray-50 border-gray-300 hover:bg-gray-100 hover:text-[#7b2326]';
    const actions: Array<{ key: keyof ModelActionCallbacks; label: React.ReactNode }> = [
      { key: 'onInfo', label: 'Info' },
      { key: 'onExtras', label: <>Extra&apos;s</> },
      { key: 'onOptions', label: 'Options' },
      { key: 'onPrices', label: 'Prices' },
    ];
    columns.push({
      key: '_actions',
      title: (<span className="text-xs font-medium text-gray-500">ACTIONS</span>),
      render: (_v: unknown, row?: ModelRow) => {
        if (!row) return null;
        return (
          <div className="flex flex-nowrap gap-1 whitespace-nowrap">
            {actions.map(({ key, label }) => {
              const callback = actionCallbacks[key];
              if (!callback) return null;
              return (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  className={actionButtonClass}
                  onClick={(e) => { e.stopPropagation(); callback(row); }}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        );
      },
      maxWidth: 'none',
      width: '270px',
    });
  }

  return columns;
}
