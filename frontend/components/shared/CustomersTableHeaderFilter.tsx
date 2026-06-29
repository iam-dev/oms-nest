import React, { useState, useEffect } from 'react';
import { TableHeaderFilterBase } from './TableHeaderFilterBase';
import { BooleanFilter } from './filters/BooleanFilter';
import { EnumFilter } from './filters/EnumFilter';
import { DateRangeFilter } from './filters/DateRangeFilter';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Filter as FilterIcon } from 'lucide-react';

interface CustomersTableHeaderFilterProps {
  title: string;
  type?: 'text' | 'number' | 'date-range' | 'boolean' | 'enum';
  value: string;
  onFilter: (value: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any[];
}

export function CustomersTableHeaderFilter({ title, type = 'text', value = '', onFilter, data = [] }: CustomersTableHeaderFilterProps) {
  const [open, setOpen] = useState(false);
  const [filterValue, setFilterValue] = useState(value || '');
  const [booleanValue, setBooleanValue] = useState(value || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    // TODO(react-hooks): syncing value prop to local filter state; derived-state-from-props pattern, safe here
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
    if (type === 'boolean') {
      return <BooleanFilter value={booleanValue} onChange={val => { setBooleanValue(val); onFilter(val); setOpen(false); }} />;
    }
    if (type === 'enum') {
      return <EnumFilter value={filterValue} onChange={val => { setFilterValue(val); onFilter(val); setOpen(false); }} options={data} />;
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
