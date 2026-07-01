"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Supplier } from '@/services/suppliers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';

interface SupplierEditModalProps {
  supplier: Supplier | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSupplier: Partial<Supplier>) => Promise<void>;
}

export function SupplierEditModal({ supplier, isOpen, onClose, onSave }: SupplierEditModalProps) {
  const [editedSupplier, setEditedSupplier] = useState<Partial<Supplier>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Set initial supplier data
  useEffect(() => {
    if (supplier) {
      // Edit mode - populate with existing data
      // TODO(react-hooks): derives controlled form state from the `supplier` prop when the
      // modal opens; replacing with useMemo would require lifting all field handlers to the
      // parent — suppress until a full controlled-form refactor is scheduled.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditedSupplier({
        ...supplier,
        name: supplier.name || '',
        username: supplier.username || '',
        email: supplier.email || '',
        address: supplier.address || '',
        city: supplier.city || '',
        country: supplier.country || '',
        currency: supplier.currency || 'USD',
        enabled: supplier.enabled ?? true,
      });
    } else {
      // Create mode - set default values
      setEditedSupplier({
        name: '',
        username: '',
        email: '',
        address: '',
        city: '',
        country: '',
        currency: 'USD',
        enabled: true,
      });
    }
    setError('');
  }, [supplier]);

  const handleSave = async () => {
    if (!editedSupplier) return;

    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!editedSupplier.name?.trim()) {
        throw new Error('Supplier name is required');
      }

      if (!editedSupplier.username?.trim()) {
        throw new Error('Username is required');
      }

      if (!editedSupplier.address?.trim()) {
        throw new Error('Address is required');
      }

      if (!editedSupplier.city?.trim()) {
        throw new Error('City is required');
      }

      if (editedSupplier.email && !isValidEmail(editedSupplier.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Call the onSave callback
      await onSave(editedSupplier);

      // Clear form state on successful save
      setEditedSupplier({});
      setError('');

      onClose();
    } catch (error) {
      logger.error('Error saving supplier:', error);
      // Don't set error here anymore since parent handles toast notifications
      // Keep the modal open for user to retry
    } finally {
      setSaving(false);
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleChange = (field: keyof Supplier, value: string | number | boolean) => {
    setEditedSupplier((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // Don't render if modal is not open
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? `Edit Supplier ${supplier.id}` : 'Add New Supplier'}</DialogTitle>
          <DialogDescription>
            {supplier ? 'Update the supplier information below.' : 'Enter the supplier information below.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Supplier Name: <span className="text-red-500">*</span>
            </label>
            <Input
              value={editedSupplier.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Supplier Name"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Username: <span className="text-red-500">*</span>
            </label>
            <Input
              value={editedSupplier.username || ''}
              onChange={(e) => handleChange('username', e.target.value)}
              placeholder="Username"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Email:</label>
            <Input
              type="email"
              value={editedSupplier.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Email Address"
            />
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Address: <span className="text-red-500">*</span>
            </label>
            <Input
              value={editedSupplier.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Street Address"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                City: <span className="text-red-500">*</span>
              </label>
              <Input
                value={editedSupplier.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="City"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Country:</label>
              <Select
                value={editedSupplier.country || ''}
                onValueChange={(value) => handleChange('country', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                  <SelectItem value="DE">Germany</SelectItem>
                  <SelectItem value="FR">France</SelectItem>
                  <SelectItem value="NL">Netherlands</SelectItem>
                  <SelectItem value="AT">Austria</SelectItem>
                  <SelectItem value="BE">Belgium</SelectItem>
                  <SelectItem value="BR">Brazil</SelectItem>
                  <SelectItem value="CN">China</SelectItem>
                  <SelectItem value="CZ">Czech Republic</SelectItem>
                  <SelectItem value="DK">Denmark</SelectItem>
                  <SelectItem value="FI">Finland</SelectItem>
                  <SelectItem value="HU">Hungary</SelectItem>
                  <SelectItem value="IN">India</SelectItem>
                  <SelectItem value="ID">Indonesia</SelectItem>
                  <SelectItem value="IE">Ireland</SelectItem>
                  <SelectItem value="IL">Israel</SelectItem>
                  <SelectItem value="IT">Italy</SelectItem>
                  <SelectItem value="JP">Japan</SelectItem>
                  <SelectItem value="MY">Malaysia</SelectItem>
                  <SelectItem value="MX">Mexico</SelectItem>
                  <SelectItem value="NO">Norway</SelectItem>
                  <SelectItem value="NZ">New Zealand</SelectItem>
                  <SelectItem value="PT">Portugal</SelectItem>
                  <SelectItem value="RO">Romania</SelectItem>
                  <SelectItem value="RU">Russia</SelectItem>
                  <SelectItem value="ES">Spain</SelectItem>
                  <SelectItem value="SE">Sweden</SelectItem>
                  <SelectItem value="CH">Switzerland</SelectItem>
                  <SelectItem value="TH">Thailand</SelectItem>
                  <SelectItem value="UA">Ukraine</SelectItem>
                  <SelectItem value="AR">Argentina</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Currency: <span className="text-red-500">*</span>
            </label>
            <Select
              value={editedSupplier.currency || 'USD'}
              onValueChange={(value) => handleChange('currency', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
                <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                <SelectItem value="NZD">NZD - New Zealand Dollar</SelectItem>
                <SelectItem value="DE_EUR">DE_EUR - German Euro</SelectItem>
                <SelectItem value="NL_EUR">NL_EUR - Netherlands Euro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Status:</label>
            <Select
              value={editedSupplier.enabled ? 'true' : 'false'}
              onValueChange={(value) => handleChange('enabled', value === 'true')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Enabled</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </SelectContent>
            </Select>
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
            Back to suppliers
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Saving...' : (supplier ? 'Save supplier' : 'Create supplier')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}