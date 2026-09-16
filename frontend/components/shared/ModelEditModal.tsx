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

/**
 * Legacy "Manage information" form: one label/control row per field, in the
 * same order as production so admins recognise it. Declared at module scope —
 * defining it inside the component would remount the inputs on every render.
 */
function FieldRow({ label, htmlFor, required, children }: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <label
        htmlFor={htmlFor}
        data-testid="field-label"
        className="w-40 shrink-0 text-sm text-gray-700"
      >
        {label}
        {required && <span className="ml-1 text-red-700">*</span>}
      </label>
      <div className="w-72">{children}</div>
    </div>
  );
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
  const brandListId = `model-brand-suggestions-${model.id}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Manage information for {model.brandName} {model.name}
          </DialogTitle>
          <DialogDescription>
            Factories per region, brand, model, type and status of this saddle.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="mt-2 space-y-3 rounded border border-dashed border-gray-300 p-4">
            {FACTORY_REGION_KEYS.map((key) => {
              const id = `saddle-${key}`;
              return (
                <FieldRow key={key} label={`Factory for ${FACTORY_REGIONS[key]}:`} htmlFor={id} required>
                  <Select
                    value={String(editedModel[key as keyof Model] ?? 0)}
                    onValueChange={(value) => handleFactoryChange(key, value)}
                    aria-label={`Factory for ${FACTORY_REGIONS[key]}:`}
                  >
                    <SelectTrigger id={id} className="h-9">
                      <SelectValue placeholder="- Choose factory -" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">- Choose factory -</SelectItem>
                      {factories.map((factory) => (
                        <SelectItem key={factory.id} value={String(factory.id)}>
                          {factory.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              );
            })}

            <FieldRow label="Brand:" htmlFor="saddle-brand" required>
              {/* Free text like production: saddles use brands that are not in the brands table */}
              <Input
                id="saddle-brand"
                aria-label="Brand:"
                list={brandListId}
                value={editedModel.brandName || ''}
                onChange={(e) => handleChange('brandName', e.target.value)}
                className="h-9"
                required
              />
              <datalist id={brandListId}>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.name} />
                ))}
              </datalist>
            </FieldRow>

            <FieldRow label="Model:" htmlFor="saddle-model" required>
              <Input
                id="saddle-model"
                aria-label="Model:"
                value={editedModel.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                className="h-9"
                required
              />
            </FieldRow>

            <FieldRow label="Type:" htmlFor="saddle-type" required>
              <Select
                value={String(editedModel.type ?? 0)}
                onValueChange={(value) => handleChange('type', parseInt(value, 10))}
                aria-label="Type:"
              >
                <SelectTrigger id="saddle-type" className="h-9">
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
            </FieldRow>

            <FieldRow label="Status:" htmlFor="saddle-status" required>
              <Select
                value={editedModel.active ? 'true' : 'false'}
                onValueChange={(value) => handleChange('active', value === 'true')}
                aria-label="Status:"
              >
                <SelectTrigger id="saddle-status" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        )}

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
            disabled={saving || isLoading}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Saving...' : 'Save information'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
