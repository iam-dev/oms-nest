"use client";

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SaddleStock } from '@/types/SaddleStock';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SaddleStockDetailModalProps {
  saddle: SaddleStock | null;
  isOpen: boolean;
  onClose: () => void;
}

const getDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return (obj.name as string) || (obj.title as string) || JSON.stringify(value);
  }
  return String(value);
};

export function SaddleStockDetailModal({ saddle, isOpen, onClose }: SaddleStockDetailModalProps) {
  if (!saddle) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Saddle Stock Details - {saddle.serial}</DialogTitle>
          <DialogDescription>
            View saddle stock information and details.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Serial</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border font-mono">
                {saddle.serial || '-'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Name</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {saddle.name || '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Model</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {getDisplayValue(saddle.model)}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Leather Type</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {getDisplayValue(saddle.leatherType)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Stock</label>
              <div className="p-2 bg-gray-50 rounded border">
                <Badge variant={saddle.stock > 5 ? 'default' : saddle.stock > 0 ? 'secondary' : 'destructive'}>
                  {saddle.stock}
                </Badge>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Demo</label>
              <div className="p-2 bg-gray-50 rounded border">
                <Badge variant={saddle.demo ? 'outline' : 'secondary'}>
                  {saddle.demo ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Customizable</label>
              <div className="p-2 bg-gray-50 rounded border">
                <Badge variant={saddle.customizableProduct ? 'default' : 'secondary'}>
                  {saddle.customizableProduct ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Owner</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {saddle.stockOwner?.name || '-'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Sponsored</label>
              <div className="p-2 bg-gray-50 rounded border">
                <Badge variant={saddle.sponsored ? 'default' : 'secondary'}>
                  {saddle.sponsored ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Ordered</label>
              <div className="p-2 bg-gray-50 rounded border">
                <Badge variant={saddle.productHasBeenOrdered ? 'default' : 'secondary'}>
                  {saddle.productHasBeenOrdered ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Created</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {saddle.createdAt
                  ? new Date(saddle.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
