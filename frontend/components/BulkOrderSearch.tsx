"use client";

import React, { useState, useCallback, useRef } from 'react';
import { FileSpreadsheet, Search, Upload, X } from 'lucide-react';
import { MIN_ORDER_ID } from '@/utils/orderConstants';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface BulkOrderSearchProps {
  onSearch: (ids: number[]) => void;
}

function parseIdsFromText(text: string): number[] {
  return text
    .split(/[\n,\t\s]+/)
    .map(s => s.trim())
    .filter(s => /^\d+$/.test(s))
    .map(s => parseInt(s, 10))
    .filter(id => id >= MIN_ORDER_ID)
    .filter((id, index, arr) => arr.indexOf(id) === index); // deduplicate
}

export function BulkOrderSearch({ onSearch }: BulkOrderSearchProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [parsedIds, setParsedIds] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = useCallback((value: string) => {
    setText(value);
    setParsedIds(parseIdsFromText(value));
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);

      const ids: number[] = [];
      workbook.eachSheet((sheet) => {
        sheet.eachRow((row) => {
          row.eachCell((cell) => {
            const val = cell.value;
            const num = typeof val === 'number' ? val : parseInt(String(val), 10);
            if (!isNaN(num) && num >= MIN_ORDER_ID && String(num) === String(val).trim()) {
              ids.push(num);
            }
          });
        });
      });

      const uniqueIds = ids.filter((id, index) => ids.indexOf(id) === index);
      const idsText = uniqueIds.join('\n');
      setText(idsText);
      setParsedIds(uniqueIds);
    } catch {
      setText('Error reading Excel file');
      setParsedIds([]);
    }

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleSearch = useCallback(() => {
    if (parsedIds.length > 0) {
      onSearch(parsedIds);
      setOpen(false);
    }
  }, [parsedIds, onSearch]);

  const handleClear = useCallback(() => {
    setText('');
    setParsedIds([]);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Bulk Search
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Bulk Order Search</h4>
            {text && (
              <button onClick={handleClear} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Textarea
            placeholder="Paste order IDs here (one per line, or comma/tab separated)"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={5}
            className="text-sm max-h-[200px] overflow-y-auto !field-sizing-normal"
          />

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {parsedIds.length > 0
                ? `${parsedIds.length} order ID${parsedIds.length === 1 ? '' : 's'} detected`
                : 'No valid IDs detected'}
            </span>
            {parsedIds.length > 0 && parsedIds.length <= 10 && (
              <span className="text-gray-400 truncate ml-2 max-w-[140px]">
                {parsedIds.join(', ')}
              </span>
            )}
            {parsedIds.length > 10 && (
              <span className="text-gray-400 truncate ml-2 max-w-[140px]">
                {parsedIds.slice(0, 10).join(', ')}...
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload Excel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleSearch}
              disabled={parsedIds.length === 0}
            >
              <Search className="mr-1.5 h-3.5 w-3.5" />
              Search ({parsedIds.length})
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
