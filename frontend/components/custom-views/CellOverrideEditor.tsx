'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pencil, X } from 'lucide-react';

interface CellOverrideEditorProps {
  orderId: number;
  columnKey: string;
  originalValue: string;
  overrideValue?: string;
  onSave: (orderId: number, columnKey: string, value: string) => void;
  onRemove: (orderId: number, columnKey: string) => void;
}

export function CellOverrideEditor({
  orderId,
  columnKey,
  originalValue,
  overrideValue,
  onSave,
  onRemove,
}: CellOverrideEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(overrideValue || originalValue);

  // FE-011/FE-012: input-validation choke point — enforce max length,
  // reject control characters, and reject whitespace-only values.
  const MAX_OVERRIDE_LENGTH = 500;
  const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/;

  const handleSave = () => {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      // Whitespace-only: treat as a reset request
      if (overrideValue !== undefined) {
        onRemove(orderId, columnKey);
      }
      setIsOpen(false);
      return;
    }

    if (trimmed.length > MAX_OVERRIDE_LENGTH) {
      return; // input element maxLength already blocks this; guard for API calls
    }

    if (CONTROL_CHAR_RE.test(trimmed)) {
      return; // silently block — browser input shouldn't produce these
    }

    if (trimmed === originalValue) {
      // Value matches original, remove the override
      if (overrideValue !== undefined) {
        onRemove(orderId, columnKey);
      }
    } else {
      onSave(orderId, columnKey, trimmed);
    }
    setIsOpen(false);
  };

  const hasOverride = overrideValue !== undefined;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <span
          className={`cursor-pointer inline-flex items-center gap-1 ${hasOverride ? 'text-blue-700 font-medium' : ''}`}
          title={hasOverride ? `Override: "${overrideValue}" (original: "${originalValue}")` : 'Click to edit'}
        >
          {hasOverride ? overrideValue : originalValue}
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 inline" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Original: {originalValue || '(empty)'}
          </p>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Override value..."
            maxLength={500}
            autoFocus
          />
          <div className="flex justify-between">
            {hasOverride && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onRemove(orderId, columnKey);
                  setIsOpen(false);
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
            <div className="flex gap-1 ml-auto">
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
