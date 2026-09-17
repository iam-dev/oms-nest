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

/**
 * Countries offered in the dropdown. The legacy `factories.country` column
 * stores the full English name (e.g. "United Kingdom"), not an ISO code, so
 * the option values must be full names too.
 */
const FACTORY_COUNTRIES = [
  'Australia',
  'Austria',
  'Belgium',
  'Canada',
  'Czech Republic',
  'Denmark',
  'Finland',
  'France',
  'Germany',
  'India',
  'Ireland',
  'Israel',
  'Italy',
  'Japan',
  'Mexico',
  'Netherlands',
  'New Zealand',
  'Norway',
  'Portugal',
  'Russia',
  'Spain',
  'Sweden',
  'Switzerland',
  'United Kingdom',
  'United States',
];

const EMPTY_FORM: Partial<Supplier> = {
  name: '',
  username: '',
  email: '',
  address: '',
  city: '',
  country: '',
  state: '',
  zipcode: '',
  phoneNo: '',
  cellNo: '',
  enabled: true,
};

/**
 * Create / edit dialog for a factory. Field set mirrors the legacy PHP
 * `/factories/edit/:id` form (full name, address, city, country, state,
 * zipcode, phone, cellphone, email, username) plus the Status select.
 * There is no password field: a new factory receives a set-password email.
 */
export function SupplierEditModal({ supplier, isOpen, onClose, onSave }: SupplierEditModalProps) {
  const [editedSupplier, setEditedSupplier] = useState<Partial<Supplier>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCreateMode = !supplier;

  useEffect(() => {
    if (supplier) {
      // TODO(react-hooks): syncing supplier prop to local edit state; derived-state-from-props pattern, safe here
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditedSupplier({
        ...supplier,
        name: supplier.name || '',
        username: supplier.username || '',
        email: supplier.email || '',
        address: supplier.address || '',
        city: supplier.city || '',
        country: supplier.country || '',
        state: supplier.state || '',
        zipcode: supplier.zipcode || '',
        phoneNo: supplier.phoneNo || '',
        cellNo: supplier.cellNo || '',
        enabled: supplier.enabled ?? true,
      });
    } else if (isOpen) {
      setEditedSupplier(EMPTY_FORM);
    }
    setError('');
  }, [supplier, isOpen]);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  /** Returns the first validation problem, or null when the form is submittable. */
  const validate = (): string | null => {
    if (!editedSupplier.name?.trim()) return 'Full name is required';
    if (!editedSupplier.username?.trim()) return 'Username is required';
    // Required because the set-password welcome email goes here on create.
    if (!editedSupplier.email?.trim()) return 'Email is required';
    if (!isValidEmail(editedSupplier.email)) return 'Please enter a valid email address';
    if (!editedSupplier.address?.trim()) return 'Address is required';
    if (!editedSupplier.city?.trim()) return 'City is required';
    if (!editedSupplier.country?.trim()) return 'Country is required';
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave(editedSupplier);
      setEditedSupplier(EMPTY_FORM);
      onClose();
    } catch (err) {
      logger.error('Error saving factory:', err);
      // The parent also toasts; keep the message in the dialog so the user
      // can fix the field without losing their input.
      setError(err instanceof Error ? err.message : 'Failed to save factory');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Supplier, value: string | number | boolean) => {
    setEditedSupplier((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Legacy data may hold a country that is not in our preset list; keep it
  // selectable so the stored value still displays instead of a blank select.
  const countryOptions =
    editedSupplier.country && !FACTORY_COUNTRIES.includes(editedSupplier.country)
      ? [editedSupplier.country, ...FACTORY_COUNTRIES]
      : FACTORY_COUNTRIES;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? `Edit Factory ${supplier.name}` : 'Add New Factory'}</DialogTitle>
          <DialogDescription>
            {supplier
              ? 'Update the factory information below.'
              : 'Enter the factory information below. The factory will receive an email to set their password.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Full Name: <span className="text-red-500">*</span>
            </label>
            <Input
              value={editedSupplier.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Full Name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Username: <span className="text-red-500">*</span>
              </label>
              <Input
                value={editedSupplier.username || ''}
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder="Username"
                disabled={!isCreateMode}
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Email: <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={editedSupplier.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Email Address"
                required
              />
            </div>
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
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Country: <span className="text-red-500">*</span>
              </label>
              <Select
                name="country"
                value={editedSupplier.country || undefined}
                onValueChange={(value) => handleChange('country', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countryOptions.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">State:</label>
              <Input
                value={editedSupplier.state || ''}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="State/Province"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Zipcode:</label>
              <Input
                value={editedSupplier.zipcode || ''}
                onChange={(e) => handleChange('zipcode', e.target.value)}
                placeholder="Postal/Zip Code"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Phone Number:</label>
              <Input
                type="tel"
                value={editedSupplier.phoneNo || ''}
                onChange={(e) => handleChange('phoneNo', e.target.value)}
                placeholder="Phone Number"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Cellphone Number:</label>
              <Input
                type="tel"
                value={editedSupplier.cellNo || ''}
                onChange={(e) => handleChange('cellNo', e.target.value)}
                placeholder="Cellphone Number"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Status:</label>
            <Select
              name="enabled"
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
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Back to factories
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Saving...' : supplier ? 'Save factory' : 'Create factory'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
