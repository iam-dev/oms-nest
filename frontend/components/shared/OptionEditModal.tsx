"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Option } from '@/services/options';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';

interface OptionEditModalProps {
  option: Option | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedOption: Partial<Option>) => Promise<void>;
}

export function OptionEditModal({ option, isOpen, onClose, onSave }: OptionEditModalProps) {
  const [editedOption, setEditedOption] = useState<Partial<Option>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Set initial option data
  useEffect(() => {
    if (option) {
      // TODO(react-hooks): derives controlled form state from the `option` prop when the
      // modal opens; replacing with useMemo would require lifting all field handlers to the
      // parent — suppress until a full controlled-form refactor is scheduled.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditedOption({
        ...option,
        name: option.name || '',
        sequence: option.sequence ?? 0,
        active: option.active ?? true,
        price: option.price ?? 0,
        description: option.description || '',
      });
      setError('');
    }
  }, [option]);

  const handleSave = async () => {
    if (!editedOption || !option) return;

    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!editedOption.name?.trim()) {
        throw new Error('Option name is required');
      }

      if (editedOption.sequence === undefined || editedOption.sequence < 0) {
        throw new Error('Sequence must be a non-negative number');
      }

      if (editedOption.price !== undefined && editedOption.price < 0) {
        throw new Error('Price must be a non-negative number');
      }

      // Call the onSave callback
      await onSave(editedOption);
      onClose();
    } catch (error) {
      logger.error('Error saving option:', error);
      setError(error instanceof Error ? error.message : 'Failed to save option. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Option, value: string | number | boolean) => {
    setEditedOption((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  if (!option) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Option {option.id}</DialogTitle>
          <DialogDescription>
            Update the option information below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Name: <span className="text-red-500">*</span>
            </label>
            <Input
              value={editedOption.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Option Name"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Sequence: <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                value={editedOption.sequence || ''}
                onChange={(e) => handleChange('sequence', parseInt(e.target.value) || 0)}
                placeholder="Display Order"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Price:</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editedOption.price || ''}
                onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Status:</label>
              <Select
                value={editedOption.active ? 'true' : 'false'}
                onValueChange={(value) => handleChange('active', value === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Description:</label>
            <Textarea
              value={editedOption.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Optional description"
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
            Back to options
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Saving...' : 'Save option'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}