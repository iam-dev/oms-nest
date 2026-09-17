"use client";

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Supplier } from '@/services/suppliers';
import { Button } from '@/components/ui/button';
import { formatLastLogin } from '@/utils/formatLastLogin';

interface SupplierDetailModalProps {
  supplier: Supplier | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export function SupplierDetailModal({ supplier, isOpen, onClose, onEdit }: SupplierDetailModalProps) {
  if (!supplier) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Factory Details - {supplier.name}</DialogTitle>
          <DialogDescription>
            View factory information and details.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Factory ID</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {supplier.id}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Full Name</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {supplier.name || '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Username</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {supplier.username || '-'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Email</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {supplier.email || '-'}
              </p>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Address</label>
            <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
              {supplier.address || '-'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">City</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {supplier.city || '-'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Country</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {supplier.country || '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">State</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {supplier.state || '-'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Zipcode</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {supplier.zipcode || '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Phone Number</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {supplier.phoneNo || '-'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Cellphone Number</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {supplier.cellNo || '-'}
              </p>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Status</label>
            <p className={`text-sm p-2 rounded border inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              supplier.enabled
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {supplier.enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>

          {supplier.lastLogin && (
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Last Login</label>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                {formatLastLogin(supplier.lastLogin)}
              </p>
            </div>
          )}

          {(supplier.createdAt || supplier.updatedAt) && (
            <div className="grid grid-cols-2 gap-4">
              {supplier.createdAt && (
                <div>
                  <label className="block font-semibold text-sm text-gray-600 mb-1">Created</label>
                  <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                    {new Date(supplier.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )}

              {supplier.updatedAt && (
                <div>
                  <label className="block font-semibold text-sm text-gray-600 mb-1">Last Updated</label>
                  <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded border">
                    {new Date(supplier.updatedAt).toLocaleDateString()}
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
              Edit Supplier
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}