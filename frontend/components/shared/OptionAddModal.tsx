"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Option } from '@/services/options';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';

interface OptionAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newOption: Partial<Option>) => Promise<void>;
}

export function OptionAddModal({ isOpen, onClose, onSave }: OptionAddModalProps) {
  const [newOption, setNewOption] = useState<Partial<Option>>({
    name: '',
    sequence: 0,
    active: true,
    price: 0,
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(react-hooks): form reset on open is intentional UI initialization, not external sync
      setNewOption({
        name: '',
        sequence: 0,
        active: true,
        price: 0,
        description: '',
      });
      setError('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!newOption.name?.trim()) {
        throw new Error('Option name is required');
      }

      if (newOption.sequence === undefined || newOption.sequence < 0) {
        throw new Error('Sequence must be a non-negative number');
      }

      if (newOption.price === undefined || newOption.price < 0) {
        throw new Error('Price must be a non-negative number');
      }

      // Call the onSave callback
      await onSave(newOption);
      onClose();
    } catch (error) {
      logger.error('Error saving option:', error);
      setError(error instanceof Error ? error.message : 'Failed to save option. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Option, value: string | number | boolean) => {
    setNewOption((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Option</DialogTitle>
          <DialogDescription>
            Create a new saddle option below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Option Name: <span className="text-red-500">*</span>
            </label>
            <Input
              value={newOption.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Option Name"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Description:
            </label>
            <Textarea
              value={newOption.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Description (optional)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Price: <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newOption.price || ''}
                onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
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
                value={newOption.sequence || ''}
                onChange={(e) => handleChange('sequence', parseInt(e.target.value) || 0)}
                placeholder="Display Order"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Status:</label>
              <Select
                value={newOption.active ? 'true' : 'false'}
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
            {saving ? 'Creating...' : 'Create option'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}