"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Brand } from '@/services/brands';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';

interface BrandAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newBrand: Partial<Brand>) => Promise<void>;
}

export function BrandAddModal({ isOpen, onClose, onSave }: BrandAddModalProps) {
  const [newBrand, setNewBrand] = useState<Partial<Brand>>({
    name: '',
    sequence: 0,
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // TODO(react-hooks): form reset on modal open; derived-state-from-props pattern, safe here
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewBrand({
        name: '',
        sequence: 0,
        active: true,
      });
      setError('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!newBrand.name?.trim()) {
        throw new Error('Brand name is required');
      }

      if (newBrand.sequence === undefined || newBrand.sequence < 0) {
        throw new Error('Sequence must be a non-negative number');
      }

      // Call the onSave callback
      await onSave(newBrand);
      onClose();
    } catch (error) {
      logger.error('Error saving brand:', error);
      setError(error instanceof Error ? error.message : 'Failed to save brand. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Brand, value: string | number | boolean) => {
    setNewBrand((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Brand</DialogTitle>
          <DialogDescription>
            Create a new saddle brand below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Brand Name: <span className="text-red-500">*</span>
            </label>
            <Input
              value={newBrand.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Brand Name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Sequence:
              </label>
              <Input
                type="number"
                min="0"
                value={newBrand.sequence || ''}
                onChange={(e) => handleChange('sequence', parseInt(e.target.value) || 0)}
                placeholder="Display Order"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Status:</label>
              <Select
                value={newBrand.active ? 'true' : 'false'}
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
            {saving ? 'Creating...' : 'Create brand'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}