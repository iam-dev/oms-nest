"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Model, fetchNextSequence } from '@/services/models';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { logger } from '@/utils/logger';
import { fetchFactories, Factory } from '@/services/factories';
import { API_URL } from '@/services/api-config';
import { SADDLE_TYPE_OPTIONS, FACTORY_REGIONS, FACTORY_REGION_KEYS, FactoryRegionKey } from '@/utils/saddleConstants';

interface ModelAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newModel: Partial<Model>) => Promise<void>;
}

export function ModelAddModal({ isOpen, onClose, onSave }: ModelAddModalProps) {
  const [newModel, setNewModel] = useState<Partial<Model>>({
    name: '',
    brandName: '',
    sequence: 0,
    active: true,
    factoryEu: 0,
    factoryGb: 0,
    factoryUs: 0,
    factoryCa: 0,
    factoryAud: 0,
    factoryDe: 0,
    factoryNl: 0,
    type: 0,
  });
  const [brands, setBrands] = useState<string[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingFactories, setLoadingFactories] = useState(false);
  const [loadingSequence, setLoadingSequence] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load brands, factories, and next sequence when modal opens
  useEffect(() => {
    if (isOpen) {
      loadBrands();
      loadFactories();
      loadNextSequence();
      // Reset form when modal opens (sequence will be set by loadNextSequence)
      setNewModel({
        name: '',
        brandName: '',
        sequence: 0,
        active: true,
        factoryEu: 0,
        factoryGb: 0,
        factoryUs: 0,
        factoryCa: 0,
        factoryAud: 0,
        factoryDe: 0,
        factoryNl: 0,
        type: 0,
      });
      setError('');
    }
  }, [isOpen]);

  const loadBrands = async () => {
    setLoadingBrands(true);
    try {
      logger.log('ModelAddModal: Loading brands from saddles...');
      const response = await fetch(`${API_URL}/api/v1/saddles/brands`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Failed to fetch brands: ${response.status}`);
      const brandNames: string[] = await response.json();
      logger.log('ModelAddModal: Loaded brands:', brandNames);
      setBrands(brandNames);
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
      logger.log('ModelAddModal: Loading factories...');
      const data = await fetchFactories();
      logger.log('ModelAddModal: Loaded factories:', data);
      setFactories(data['hydra:member'] || []);
    } catch (error) {
      logger.error('Error loading factories:', error);
      setError('Failed to load factories. Please try again.');
    } finally {
      setLoadingFactories(false);
    }
  };

  const loadNextSequence = async () => {
    setLoadingSequence(true);
    try {
      logger.log('ModelAddModal: Loading next sequence...');
      const nextSeq = await fetchNextSequence();
      logger.log('ModelAddModal: Next sequence:', nextSeq);
      setNewModel(prev => ({
        ...prev,
        sequence: nextSeq,
      }));
    } catch (error) {
      logger.error('Error loading next sequence:', error);
      // Default to 1 if we can't get the next sequence
      setNewModel(prev => ({
        ...prev,
        sequence: 1,
      }));
    } finally {
      setLoadingSequence(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!newModel.name?.trim()) {
        throw new Error('Model name is required');
      }

      if (!newModel.brandName?.trim()) {
        throw new Error('Brand is required');
      }

      if (newModel.sequence === undefined || newModel.sequence < 0) {
        throw new Error('Sequence must be a non-negative number');
      }

      // Call the onSave callback
      await onSave(newModel);
      onClose();
    } catch (error) {
      logger.error('Error saving model:', error);
      setError(error instanceof Error ? error.message : 'Failed to save model. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Model, value: string | number | boolean) => {
    setNewModel((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFactoryChange = (field: FactoryRegionKey, value: string) => {
    const numValue = value === '0' || value === '' ? 0 : parseInt(value, 10);
    setNewModel((prev) => ({
      ...prev,
      [field]: numValue
    }));
  };

  const isLoading = loadingBrands || loadingFactories;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Saddle</DialogTitle>
          <DialogDescription>
            Create a new saddle model below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Model Name: <span className="text-red-500">*</span>
            </label>
            <Input
              value={newModel.name || ''}
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
              value={newModel.brandName || ''}
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
                  brands.map((brandName) => (
                    <SelectItem key={brandName} value={brandName}>
                      {brandName}
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
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  value={newModel.sequence || ''}
                  onChange={(e) => handleChange('sequence', parseInt(e.target.value) || 0)}
                  placeholder="Display Order"
                  required
                  disabled={loadingSequence}
                />
                {loadingSequence && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Suggested next sequence: {loadingSequence ? 'Loading...' : newModel.sequence}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Status:</label>
              <Select
                value={newModel.active ? 'true' : 'false'}
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
              value={String(newModel.type ?? 0)}
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
                      value={String(newModel[key as keyof Model] ?? 0)}
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
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || isLoading}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Creating...' : 'Create saddle'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
