"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, X, Search } from 'lucide-react';

const MAX_VISIBLE = 100;

interface MultiSelectFilterProps {
  label: string;
  options: { label: string; value: string }[];
  selected: string[];
  onChangeSelected: (values: string[]) => void;
  placeholder?: string;
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChangeSelected,
  placeholder = "Please select",
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Small delay so popover is mounted before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(react-hooks): clearing search on close is intentional UI reset, not external sync
      setSearch('');
    }
  }, [open]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const available = options.filter(opt => !selectedSet.has(opt.value));
    if (!q) return available.slice(0, MAX_VISIBLE);
    return available
      .filter(opt => opt.label.toLowerCase().includes(q))
      .slice(0, MAX_VISIBLE);
  }, [options, selectedSet, search]);

  const totalAvailable = useMemo(() => {
    if (!search) return options.length - selected.length;
    const q = search.toLowerCase();
    return options.filter(opt => !selectedSet.has(opt.value) && opt.label.toLowerCase().includes(q)).length;
  }, [options, selectedSet, search, selected.length]);

  const handleSelect = (value: string) => {
    onChangeSelected([...selected, value]);
    setOpen(false);
  };

  const handleRemove = (value: string) => {
    onChangeSelected(selected.filter(v => v !== value));
  };

  return (
    <div className="flex items-start gap-2">
      <label className="w-32 pt-2">{label}</label>
      <div className="flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-9 w-[200px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <span className="text-muted-foreground truncate">{placeholder}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <div className="flex items-center border-b px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground mr-1.5 shrink-0" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type to search..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">No results</div>
              ) : (
                <>
                  {filtered.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                      onClick={() => handleSelect(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {totalAvailable > MAX_VISIBLE && (
                    <div className="py-1.5 px-2 text-xs text-muted-foreground border-t">
                      Showing {MAX_VISIBLE} of {totalAvailable} — type to narrow
                    </div>
                  )}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 max-w-[300px]">
            {selected.map(value => {
              const option = options.find(o => o.value === value);
              return (
                <span
                  key={value}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full"
                >
                  {option?.label || value}
                  <button
                    type="button"
                    onClick={() => handleRemove(value)}
                    className="hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
