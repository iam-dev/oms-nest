"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Preset } from '@/services/presets';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';
import { fetchModels, Model } from '@/services/models';

interface PresetAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newPreset: Partial<Preset>) => Promise<void>;
}

export function PresetAddModal({ isOpen, onClose, onSave }: PresetAddModalProps) {
  const [newPreset, setNewPreset] = useState<Partial<Preset>>({
    name: '',
    sequence: 0,
    active: true,
    description: '',
    modelId: '',
  });
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
  // Declared after loadModels so React Compiler can resolve the reference as stable.
  useEffect(() => {
    if (isOpen) {
      loadModels(); // eslint-disable-line react-hooks/set-state-in-effect -- async; setState runs after await
      // Reset form when modal opens
      // TODO(react-hooks): setNewPreset reset is intentional — driven by isOpen prop change, not internal state churn.
      setNewPreset({
        name: '',
        sequence: 0,
        active: true,
        description: '',
        modelId: '',
      });
      setError('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!newPreset.name?.trim()) {
        throw new Error('Preset name is required');
      }

      if (!newPreset.modelId?.trim()) {
        throw new Error('Model is required');
      }

      if (newPreset.sequence === undefined || newPreset.sequence < 0) {
        throw new Error('Sequence must be a non-negative number');
      }

      // Call the onSave callback
      await onSave(newPreset);
      onClose();
    } catch (error) {
      logger.error('Error saving preset:', error);
      setError(error instanceof Error ? error.message : 'Failed to save preset. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Preset, value: string | number | boolean) => {
    setNewPreset((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Preset</DialogTitle>
          <DialogDescription>
            Create a new saddle preset below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Preset Name: <span className="text-red-500">*</span>
            </label>
            <Input
              value={newPreset.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Preset Name"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Model: <span className="text-red-500">*</span>
            </label>
            <Select
              value={newPreset.modelId || ''}
              onValueChange={(value) => handleChange('modelId', value)}
              disabled={loadingModels}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingModels ? "Loading models..." : "Select model"} />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name} ({model.brandName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Description:
            </label>
            <Textarea
              value={newPreset.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Description (optional)"
              rows={3}
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
                value={newPreset.sequence || ''}
                onChange={(e) => handleChange('sequence', parseInt(e.target.value) || 0)}
                placeholder="Display Order"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Status:</label>
              <Select
                value={newPreset.active ? 'true' : 'false'}
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
            {saving ? 'Creating...' : 'Create preset'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}