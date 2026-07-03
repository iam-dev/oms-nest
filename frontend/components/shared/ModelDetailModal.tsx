"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Model } from '@/services/models';
import { Button } from '@/components/ui/button';
import { fetchFactories, Factory, createFactoryLookup } from '@/services/factories';
import { getSaddleTypeLabel, FACTORY_REGIONS, FACTORY_REGION_KEYS } from '@/utils/saddleConstants';
import { Loader2 } from 'lucide-react';
import { logger } from '@/utils/logger';

interface ModelDetailModalProps {
  model: Model | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export function ModelDetailModal({ model, isOpen, onClose, onEdit }: ModelDetailModalProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [factories, setFactories] = useState<Factory[]>([]);
  const [factoryLookup, setFactoryLookup] = useState<Map<number, string>>(new Map());
  const [loadingFactories, setLoadingFactories] = useState(false);

  const loadFactories = useCallback(async () => {
    setLoadingFactories(true);
    try {
      const data = await fetchFactories();
      const factoryList = data['hydra:member'] || [];
      setFactories(factoryList);
      setFactoryLookup(createFactoryLookup(factoryList));
    } catch (error) {
      logger.error('Error loading factories:', error);
    } finally {
      setLoadingFactories(false);
    }
  }, []);

  // Load factories when modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- TODO(react-hooks): loadFactories triggers async fetch+setState; standard data-on-open pattern
      loadFactories();
    }
  }, [isOpen, loadFactories]);

  const getFactoryName = (factoryId?: number): string => {
    if (factoryId === undefined || factoryId === null || factoryId === 0) return '-';
    return factoryLookup.get(factoryId) || `Factory #${factoryId}`;
  };

  if (!model) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Saddle Details - {model.name}</DialogTitle>
          <DialogDescription>
            View saddle information and details.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Saddle ID</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {model.id}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Saddle Name</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {model.name || '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Brand</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {model.brand?.name || model.brandName || '-'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Sequence</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {model.sequence}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Status</label>
              <p className={`text-sm p-2 rounded border inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                model.active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {model.active ? 'Active' : 'Inactive'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Type</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {getSaddleTypeLabel(model.type)}
              </p>
            </div>
          </div>

          {/* Factory Assignments Section */}
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-2">Factory Assignments</label>
            {loadingFactories ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading factories...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {FACTORY_REGION_KEYS.map((key) => {
                  const factoryId = model[key as keyof Model] as number | undefined;
                  return (
                    <div key={key} className="bg-gray-50 rounded border p-2">
                      <span className="text-xs font-medium text-gray-500 block">
                        {FACTORY_REGIONS[key]}
                      </span>
                      <span className="text-sm text-gray-900 truncate block" title={getFactoryName(factoryId)}>
                        {getFactoryName(factoryId)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(model.createdAt || model.updatedAt) && (
            <div className="grid grid-cols-2 gap-4">
              {model.createdAt && (
                <div>
                  <label className="block font-semibold text-sm text-gray-600 mb-1">Created</label>
                  <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                    {new Date(model.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )}

              {model.updatedAt && (
                <div>
                  <label className="block font-semibold text-sm text-gray-600 mb-1">Last Updated</label>
                  <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                    {new Date(model.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
          {onEdit && (
            <Button
              onClick={onEdit}
              className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
            >
              Edit Saddle
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
