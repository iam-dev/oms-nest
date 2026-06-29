"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Preset } from '@/services/presets';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';
import { fetchModels, Model } from '@/services/models';

interface PresetEditModalProps {
  preset: Preset | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPreset: Partial<Preset>) => Promise<void>;
}

export function PresetEditModal({ preset, isOpen, onClose, onSave }: PresetEditModalProps) {
  const [editedPreset, setEditedPreset] = useState<Partial<Preset>>({});
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const data = await fetchModels({
        page: 1,
        orderBy: 'name',
        order: 'asc',
        filters: { active: 'true' }
      });
      setModels(data['hydra:member'] || []);
    } catch (error) {
      logger.error('Error loading models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  // Load models when modal opens.
  // Declared after loadModels so React Compiler can see the reference as stable.
  useEffect(() => {
    if (isOpen) {
      loadModels(); // eslint-disable-line react-hooks/set-state-in-effect -- async; setState runs after await
    }
  }, [isOpen]);

  // Sync form state when the preset prop changes.
  useEffect(() => {
    if (preset) {
      // TODO(react-hooks): setEditedPreset initialises derived state from the `preset` prop — intentional controlled reset.
      setEditedPreset({ // eslint-disable-line react-hooks/set-state-in-effect -- driven by preset prop change
        ...preset,
        name: preset.name || '',
        sequence: preset.sequence ?? 0,
        active: preset.active ?? true,
        description: preset.description || '',
        modelId: preset.modelId || '',
      });
      setError('');
    }
  }, [preset]);

  const handleSave = async () => {
    if (!editedPreset || !preset) return;

    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!editedPreset.name?.trim()) {
        throw new Error('Preset name is required');
      }

      if (editedPreset.sequence === undefined || editedPreset.sequence < 0) {
        throw new Error('Sequence must be a non-negative number');
      }

      // Call the onSave callback
      await onSave(editedPreset);
      onClose();
    } catch (error) {
      logger.error('Error saving preset:', error);
      setError(error instanceof Error ? error.message : 'Failed to save preset. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Preset, value: string | number | boolean) => {
    setEditedPreset((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  if (!preset) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Preset {preset.id}</DialogTitle>
          <DialogDescription>
            Update the preset information below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Name: <span className="text-red-500">*</span>
            </label>
            <Input
              value={editedPreset.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Preset Name"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Model:</label>
            <Select
              value={editedPreset.modelId || ''}
              onValueChange={(value) => handleChange('modelId', value)}
              disabled={loadingModels}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingModels ? "Loading models..." : "Select model (optional)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Model</SelectItem>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Sequence: <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                value={editedPreset.sequence || ''}
                onChange={(e) => handleChange('sequence', parseInt(e.target.value) || 0)}
                placeholder="Display Order"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Status:</label>
              <Select
                value={editedPreset.active ? 'true' : 'false'}
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
              value={editedPreset.description || ''}
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
            Back to presets
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Saving...' : 'Save preset'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}