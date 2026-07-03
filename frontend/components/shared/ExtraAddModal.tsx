"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Extra } from '@/services/extras';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';

interface ExtraAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newExtra: Partial<Extra>) => Promise<void>;
}

const PRICE_TIERS = [
  { key: 'price1' as const, label: 'USD ($)', symbol: '$' },
  { key: 'price2' as const, label: 'EUR (€)', symbol: '€' },
  { key: 'price3' as const, label: 'GBP (£)', symbol: '£' },
  { key: 'price4' as const, label: 'CAD (C$)', symbol: 'C$' },
  { key: 'price5' as const, label: 'AUD (A$)', symbol: 'A$' },
  { key: 'price6' as const, label: 'NOK (N€)', symbol: 'N€' },
  { key: 'price7' as const, label: 'DKK (D€)', symbol: 'D€' },
];

const INITIAL_STATE: Partial<Extra> = {
  name: '',
  sequence: 0,
  description: '',
  price1: 0,
  price2: 0,
  price3: 0,
  price4: 0,
  price5: 0,
  price6: 0,
  price7: 0,
};

export function ExtraAddModal({ isOpen, onClose, onSave }: ExtraAddModalProps) {
  const [newExtra, setNewExtra] = useState<Partial<Extra>>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // TODO(react-hooks): form reset on modal open; derived-state-from-props pattern, safe here
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewExtra({ ...INITIAL_STATE });
      setError('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      if (!newExtra.name?.trim()) {
        throw new Error('Extra name is required');
      }

      await onSave(newExtra);
      onClose();
    } catch (error) {
      logger.error('Error saving extra:', error);
      setError(error instanceof Error ? error.message : 'Failed to save extra. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Extra, value: string | number | boolean) => {
    setNewExtra((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Extra</DialogTitle>
          <DialogDescription>
            Create a new saddle extra below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Extra Name: <span className="text-red-500">*</span>
              </label>
              <Input
                value={newExtra.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Extra Name"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Sequence:
              </label>
              <Input
                type="number"
                min="0"
                value={newExtra.sequence ?? 0}
                onChange={(e) => handleChange('sequence', parseInt(e.target.value) || 0)}
                placeholder="Display Order"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-2">Default Prices:</label>
            <div className="grid grid-cols-4 gap-3">
              {PRICE_TIERS.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newExtra[key] ?? 0}
                    onChange={(e) => handleChange(key, parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Description:
            </label>
            <Textarea
              value={newExtra.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Description (optional)"
              rows={3}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Error</p>
                <p>{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Creating...' : 'Create extra'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
