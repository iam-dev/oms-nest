"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Model } from '@/services/models';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { logger } from '@/utils/logger';
import { fetchBrands, Brand } from '@/services/brands';
import { fetchFactories, Factory } from '@/services/factories';
import { SADDLE_TYPE_OPTIONS, FACTORY_REGIONS, FACTORY_REGION_KEYS, FactoryRegionKey } from '@/utils/saddleConstants';

interface ModelEditModalProps {
  model: Model | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedModel: Partial<Model>) => Promise<void>;
}

export function ModelEditModal({ model, isOpen, onClose, onSave }: ModelEditModalProps) {
  const [editedModel, setEditedModel] = useState<Partial<Model>>({});
  const [brands, setBrands] = useState<Brand[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingFactories, setLoadingFactories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadBrands = async () => {
    setLoadingBrands(true);
    try {
      logger.log('ModelEditModal: Loading brands...');
      const data = await fetchBrands({
        page: 1,
        orderBy: 'name',
        order: 'asc',
      });
      logger.log('ModelEditModal: Loaded brands:', data);
      setBrands(data['hydra:member'] || []);
    } catch (error) {
      logger.error('Error loading brands:', error);
      setError('Failed to load brands. Please try again.');
    } finally {
      setLoadingBrands(false);
    }
  };

  const loadFactories = async () => {
    setLoadingFactories(true);
    try {
      logger.log('ModelEditModal: Loading factories...');
      const data = await fetchFactories();
      logger.log('ModelEditModal: Loaded factories:', data);
      setFactories(data['hydra:member'] || []);
    } catch (error) {
      logger.error('Error loading factories:', error);
      setError('Failed to load factories. Please try again.');
    } finally {
      setLoadingFactories(false);
    }
  };

  // Load brands and factories when modal opens.
  // Declared after the load functions so React Compiler can resolve them as stable references.
  useEffect(() => {
    if (isOpen) {
      loadBrands(); // eslint-disable-line react-hooks/set-state-in-effect -- async; setState runs after await
      loadFactories();
    }
  }, [isOpen]);

  // Sync form state when the model prop changes (e.g. user picks a different row to edit).
  useEffect(() => {
    if (model) {
      // TODO(react-hooks): setEditedModel initialises derived state from the `model` prop — intentional controlled reset.
      setEditedModel({ // eslint-disable-line react-hooks/set-state-in-effect -- driven by model prop change
        ...model,
        name: model.name || '',
        brandName: model.brandName || '',
        sequence: model.sequence || 0,
        active: model.active ?? true,
        factoryEu: model.factoryEu ?? 0,
        factoryGb: model.factoryGb ?? 0,
        factoryUs: model.factoryUs ?? 0,
        factoryCa: model.factoryCa ?? 0,
        factoryAud: model.factoryAud ?? 0,
        factoryDe: model.factoryDe ?? 0,
        factoryNl: model.factoryNl ?? 0,
        type: model.type ?? 0,
      });
      setError('');
    }
  }, [model]);

  const handleSave = async () => {
    if (!editedModel || !model) return;

    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!editedModel.name?.trim()) {
        throw new Error('Model name is required');
      }

      if (!editedModel.brandName?.trim()) {
        throw new Error('Brand is required');
      }

      if (editedModel.sequence === undefined || editedModel.sequence < 0) {
        throw new Error('Sequence must be a non-negative number');
      }

      // Call the onSave callback
      await onSave(editedModel);
      onClose();
    } catch (error) {
      logger.error('Error saving saddle:', error);
      setError(error instanceof Error ? error.message : 'Failed to save saddle. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Model, value: string | number | boolean) => {
    setEditedModel((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFactoryChange = (field: FactoryRegionKey, value: string) => {
    const numValue = value === '0' || value === '' ? 0 : parseInt(value, 10);
    setEditedModel((prev) => ({
      ...prev,
      [field]: numValue
    }));
  };

  if (!model) return null;

  const isLoading = loadingBrands || loadingFactories;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Saddle {model.id}</DialogTitle>
          <DialogDescription>
            Update the saddle model information below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Model Name: <span className="text-red-500">*</span>
            </label>
            <Input
              value={editedModel.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Model Name"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Brand: <span className="text-red-500">*</span>
            </label>
            <Select
              value={editedModel.brandName || ''}
              onValueChange={(value) => handleChange('brandName', value)}
              disabled={loadingBrands}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingBrands ? "Loading brands..." : "Select brand"} />
              </SelectTrigger>
              <SelectContent>
                {loadingBrands ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </div>
                ) : brands.length === 0 ? (
                  <div className="py-2 px-3 text-gray-500 text-sm">
                    No brands available
                  </div>
                ) : (
                  brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.name}>
                      {brand.name}
                    </SelectItem>
                  ))
                )}
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
                value={editedModel.sequence || ''}
                onChange={(e) => handleChange('sequence', parseInt(e.target.value) || 0)}
                placeholder="Display Order"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Status:</label>
              <Select
                value={editedModel.active ? 'true' : 'false'}
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

          {/* Saddle Type */}
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Type:</label>
            <Select
              value={String(editedModel.type ?? 0)}
              onValueChange={(value) => handleChange('type', parseInt(value, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {SADDLE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Factory Assignments Section */}
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-2">Factory Assignments:</label>
            {loadingFactories ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading factories...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {FACTORY_REGION_KEYS.map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {FACTORY_REGIONS[key]}
                    </label>
                    <Select
                      value={String(editedModel[key as keyof Model] ?? 0)}
                      onValueChange={(value) => handleFactoryChange(key, value)}
                      disabled={loadingFactories}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        {factories.map((factory) => (
                          <SelectItem key={factory.id} value={String(factory.id)}>
                            {factory.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
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
            Back to saddles
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || isLoading}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Saving...' : 'Save saddle'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
