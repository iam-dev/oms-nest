import React, { useState, useEffect } from 'react';
import { TableHeaderFilterBase } from './TableHeaderFilterBase';
import { BooleanFilter } from './filters/BooleanFilter';
import { EnumFilter } from './filters/EnumFilter';
import { DateRangeFilter } from './filters/DateRangeFilter';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Filter as FilterIcon } from 'lucide-react';

export type FilterType = 'text' | 'number' | 'date-range' | 'boolean' | 'enum' | 'urgent' | 'select';

export interface FilterOption {
  label: string;
  value: string;
}

export interface TableHeaderFilterProps {
  title: string;
  type?: FilterType;
  value?: string;
  onFilter: (value: string) => void;
  data?: FilterOption[] | string[];
  entityType?: 'order' | 'customer' | 'product' | 'fitter' | 'supplier' | 'factory' | 'access-filter-group' | 'country-manager' | 'user' | 'warehouse' | 'saddle' | 'brand' | 'option' | 'preset' | 'leathertype' | 'extra';
}

export function TableHeaderFilter({
  title,
  type = 'text',
  value = '',
  onFilter,
  data = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  entityType,
}: TableHeaderFilterProps) {
  const [open, setOpen] = useState(false);
  // Ensure filter values are always strings, never undefined
  const [filterValue, setFilterValue] = useState(value ?? '');
  const [booleanValue, setBooleanValue] = useState(value ?? '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sync local state with prop value when it changes (including to empty string)
  useEffect(() => {
    // Always sync, even when value is empty string
    const newValue = value ?? '';
    // TODO(react-hooks): syncs multiple local filter states from a controlled `value` prop;
    // the filter is intentionally semi-controlled (popover-local state + parent notification)
    // — a full refactor to fully-controlled would require parent to own dateFrom/dateTo too.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterValue(newValue);
    setBooleanValue(newValue);
    if (type === 'date-range' && value) {
      const [from, to] = value.split(':');
      setDateFrom(from || '');
      setDateTo(to || '');
    } else if (type === 'date-range' && !value) {
      setDateFrom('');
      setDateTo('');
    }
  }, [value, type]);

  const renderFilterContent = () => {
    if (type === 'boolean' || type === 'urgent') {
      return (
        <BooleanFilter 
          value={booleanValue} 
          onChange={val => { 
            setBooleanValue(val); 
            onFilter(val); 
            setOpen(false); 
          }} 
        />
      );
    }
    
    if (type === 'enum') {
      // Ensure data is in the correct format
      const options = data.map(item => {
        if (typeof item === 'string') {
          return { label: item, value: item };
        }
        return item as FilterOption;
      });

      return (
        <EnumFilter
          value={filterValue}
          onChange={val => {
            // Ensure empty string is properly handled for "All" selection
            const newValue = val ?? '';
            setFilterValue(newValue);
            onFilter(newValue);
            setOpen(false);
          }}
          options={options as FilterOption[]}
        />
      );
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
    
    return (
      <TableHeaderFilterBase
        title={title}
        type={type as 'text' | 'number' | 'date-range'}
        value={filterValue}
        onFilter={val => {
          setFilterValue(val);
          onFilter(val);
          setOpen(false);
        }}
      />
    );
  };

  const hasActiveFilter = value && value !== '';
  
  return (
    <div className="flex items-center space-x-1">
      <span className="font-medium text-sm">{title}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`p-1 rounded-sm ${hasActiveFilter ? 'text-primary' : 'text-muted-foreground'}`}
            title={`Filter ${title}`}
          >
            <FilterIcon className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          {renderFilterContent()}
        </PopoverContent>
      </Popover>
    </div>
  );
}
