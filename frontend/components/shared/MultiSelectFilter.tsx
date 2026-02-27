"use client";

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from 'lucide-react';

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
  // Filter out already-selected options
  const availableOptions = options.filter(opt => !selected.includes(opt.value));

  const handleSelect = (value: string) => {
    if (value && !selected.includes(value)) {
      onChangeSelected([...selected, value]);
    }
  };

  const handleRemove = (value: string) => {
    onChangeSelected(selected.filter(v => v !== value));
  };

  return (
    <div className="flex items-start gap-2">
      <label className="w-32 pt-2">{label}</label>
      <div className="flex-1">
        <Select
          value=""
          onValueChange={handleSelect}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {availableOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
