"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Leathertype } from '@/services/leathertypes';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';

interface LeathertypeEditModalProps {
  leathertype: Leathertype | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedLeathertype: Partial<Leathertype>) => Promise<void>;
}

export function LeathertypeEditModal({ leathertype, isOpen, onClose, onSave }: LeathertypeEditModalProps) {
  const [editedLeathertype, setEditedLeathertype] = useState<Partial<Leathertype>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Set initial leathertype data
  useEffect(() => {
    if (leathertype) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(react-hooks): syncing prop->state on prop change is intentional controlled-form initialization
      setEditedLeathertype({
        ...leathertype,
        name: leathertype.name || '',
        sequence: leathertype.sequence ?? 0,
        active: leathertype.active ?? true,
        description: leathertype.description || '',
      });
      setError('');
    }
  }, [leathertype]);

  const handleSave = async () => {
    if (!editedLeathertype || !leathertype) return;

    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!editedLeathertype.name?.trim()) {
        throw new Error('Leathertype name is required');
      }

      if (editedLeathertype.sequence === undefined || editedLeathertype.sequence < 0) {
        throw new Error('Sequence must be a non-negative number');
      }

      // Call the onSave callback
      await onSave(editedLeathertype);
      onClose();
    } catch (error) {
      logger.error('Error saving leathertype:', error);
      setError(error instanceof Error ? error.message : 'Failed to save leathertype. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Leathertype, value: string | number | boolean) => {
    setEditedLeathertype((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  if (!leathertype) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Leathertype {leathertype.id}</DialogTitle>
          <DialogDescription>
            Update the leather type information below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Name: <span className="text-red-500">*</span>
            </label>
            <Input
              value={editedLeathertype.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Leathertype Name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Sequence: <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                value={editedLeathertype.sequence || ''}
                onChange={(e) => handleChange('sequence', parseInt(e.target.value) || 0)}
                placeholder="Display Order"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Status:</label>
              <Select
                value={editedLeathertype.active ? 'true' : 'false'}
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
              value={editedLeathertype.description || ''}
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
            Back to leathertypes
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Saving...' : 'Save leathertype'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}