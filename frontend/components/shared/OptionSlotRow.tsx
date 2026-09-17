"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { itemsWithCustomized, type SpecInputs } from '@/utils/optionSpecs';

export interface OptionSlotRowProps {
  label: string;
  selectedItemId: string;
  placeholder?: string;
  items: Array<{ id: number | string; name: string }>;
  inputs: SpecInputs;
  custom: string;
  color: string;
  leather: string;
  onSelect: (itemId: string) => void;
  onCustomChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onLeatherChange: (v: string) => void;
  onRemove?: () => void;
  onAddClone?: () => void;
  addCloneLabel?: string;
  inputIdPrefix: string;
}

/**
 * One row of a saddle option as on the legacy form: the select (model items +
 * "Customized by fitter"), the text boxes the chosen item asks for
 * ("Please specify" / "Specify color" / "Specify leathertype"), and the
 * remove / add-another controls for options that allow extra rows.
 */
export function OptionSlotRow(p: OptionSlotRowProps) {
  const textBoxes: Array<{ key: keyof SpecInputs; label: string; value: string; onChange: (v: string) => void }> = [
    { key: 'custom', label: 'Please specify:', value: p.custom, onChange: p.onCustomChange },
    { key: 'color', label: 'Specify color:', value: p.color, onChange: p.onColorChange },
    { key: 'leather', label: 'Specify leathertype:', value: p.leather, onChange: p.onLeatherChange },
  ];
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 items-start">
      <Label className="text-sm font-medium pt-2">
        {p.label}: <span className="text-red-500">*</span>
      </Label>
      <div className="space-y-1">
        <div className="flex items-start gap-1">
          <div className="flex-1">
            <Select value={p.selectedItemId} onValueChange={p.onSelect}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={p.placeholder || 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {itemsWithCustomized(p.items).map(item => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {p.onRemove && (
            <button
              type="button"
              aria-label={`Remove ${p.label}`}
              className="h-9 px-2 text-gray-500 hover:text-red-700"
              onClick={p.onRemove}
            >
              ×
            </button>
          )}
        </div>
        {textBoxes.filter(tb => p.inputs[tb.key]).map(tb => {
          const inputId = `${p.inputIdPrefix}-${tb.key}`;
          return (
            <div key={tb.key} className="ml-4 p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <Label htmlFor={inputId} className="text-xs font-medium text-gray-600 whitespace-nowrap">{tb.label}</Label>
                <span className="text-red-500">*</span>
                <Input
                  id={inputId}
                  className="h-8 text-sm flex-1"
                  value={tb.value}
                  onChange={(e) => tb.onChange(e.target.value)}
                />
              </div>
            </div>
          );
        })}
        {p.onAddClone && (
          <button
            type="button"
            className="text-xs text-[#8B0000] hover:underline"
            onClick={p.onAddClone}
          >
            {p.addCloneLabel}
          </button>
        )}
      </div>
    </div>
  );
}
