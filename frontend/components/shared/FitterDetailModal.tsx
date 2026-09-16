"use client";

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Fitter, FITTER_CURRENCIES } from '@/services/fitters';
import { Button } from '@/components/ui/button';

// Helper function to convert country codes to names
const getCountryName = (countryCode?: string): string => {
  const countryNames: Record<string, string> = {
    'US': 'United States',
    'GB': 'United Kingdom',
    'CA': 'Canada',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'NL': 'Netherlands',
    'ES': 'Spain',
    'IT': 'Italy',
    'AT': 'Austria',
    'BE': 'Belgium',
    'CH': 'Switzerland',
    'DK': 'Denmark',
    'FI': 'Finland',
    'IE': 'Ireland',
    'NO': 'Norway',
    'PT': 'Portugal',
    'SE': 'Sweden',
  };

  return countryNames[countryCode || ''] || countryCode || '';
};

interface FitterDetailModalProps {
  fitter: Fitter | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export function FitterDetailModal({ fitter, isOpen, onClose, onEdit }: FitterDetailModalProps) {
  if (!fitter) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fitter Details - {fitter.username}</DialogTitle>
          <DialogDescription>
            View fitter information and details.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Fitter ID</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {fitter.id}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Username</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {fitter.username || '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">First Name</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {fitter.firstName || '-'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Last Name</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {fitter.lastName || '-'}
              </p>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Email</label>
            <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
              {fitter.email || '-'}
            </p>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Address</label>
            <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
              {fitter.address || '-'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">City</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {fitter.city || '-'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Country</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {getCountryName(fitter.country) || '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">State</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {fitter.state || '-'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Zipcode</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {fitter.zipcode || '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Phone Number</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {fitter.phoneNo || '-'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Cell Number</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {fitter.cellNo || '-'}
              </p>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Currency</label>
            <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
              {FITTER_CURRENCIES.find((c) => c.id === fitter.currency)?.code || '-'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Status</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {fitter.enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Type</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(fitter as any)['@type'] || 'Fitter'}
              </p>
            </div>
          </div>

          {fitter.lastLogin && (
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Last Login</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {new Date(fitter.lastLogin).toLocaleDateString()} at {new Date(fitter.lastLogin).toLocaleTimeString()}
              </p>
            </div>
          )}

          {(fitter.createdAt || fitter.updatedAt) && (
            <div className="grid grid-cols-2 gap-4">
              {fitter.createdAt && (
                <div>
                  <label className="block font-semibold text-sm text-gray-600 mb-1">Created</label>
                  <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                    {new Date(fitter.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )}

              {fitter.updatedAt && (
                <div>
                  <label className="block font-semibold text-sm text-gray-600 mb-1">Last Updated</label>
                  <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                    {new Date(fitter.updatedAt).toLocaleDateString()}
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
              Edit Fitter
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}