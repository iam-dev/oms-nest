import React, { useState, useEffect } from 'react';
import { TableHeaderFilterBase } from './TableHeaderFilterBase';
import { BooleanFilter } from './filters/BooleanFilter';
import { EnumFilter } from './filters/EnumFilter';
import { DateRangeFilter } from './filters/DateRangeFilter';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Filter as FilterIcon } from 'lucide-react';

export type FilterType = 'text' | 'number' | 'date-range' | 'boolean' | 'enum' | 'urgent';
export interface EnumOption {
  label: string;
  value: string;
}

interface OrdersTableHeaderFilterProps {
  title: string;
  type?: FilterType;
  value?: string;
  onFilter: (value: string) => void;
  data?: EnumOption[];
}

export function OrdersTableHeaderFilter({ title, type = 'text', value = '', onFilter, data = [] }: OrdersTableHeaderFilterProps) {
  const [open, setOpen] = useState(false);
  const [filterValue, setFilterValue] = useState(value || '');
  const [booleanValue, setBooleanValue] = useState(value || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    // TODO(react-hooks): syncs multiple local filter states from a controlled `value` prop;
    // the filter is intentionally semi-controlled (popover-local state + parent notification)
    // — a full refactor to fully-controlled would require parent to own dateFrom/dateTo too.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterValue(value || '');
    setBooleanValue(value || '');
    if (type === 'date-range' && value) {
      const [from, to] = value.split(':');
      setDateFrom(from || '');
      setDateTo(to || '');
    }
  }, [value, type]);

  const renderFilterContent = () => {
    if (type === 'boolean' || type === 'urgent') {
      return <BooleanFilter value={booleanValue} onChange={val => { setBooleanValue(val); onFilter(val); setOpen(false); }} />;
    }
    if (type === 'enum') {
      return <EnumFilter value={filterValue} onChange={val => { setFilterValue(val); onFilter(val); setOpen(false); }} options={data as EnumOption[]} />;
    }
    if (type === 'date-range') {
      return (
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
            onFilter(`${from}:${to}`);
            setOpen(false);
          }}
        />
      );
    }
    // text/number
    return (
      <TableHeaderFilterBase
        title={title}
        type={type}
        value={filterValue}
        onFilter={val => { setFilterValue(val); onFilter(val); setOpen(false); }}
        inputClassName="h-7 text-xs"
        inputStyle={{ minWidth: 0, width: 90 }}
        showApplyClear={true}
      />
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 group hover:text-[#8B0000]" type="button">
          <span>{title}</span>
          <FilterIcon size={16} className="text-gray-400 group-hover:text-[#8B0000]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-2 min-w-[160px]">
        {renderFilterContent()}
      </PopoverContent>
    </Popover>
  );
}
