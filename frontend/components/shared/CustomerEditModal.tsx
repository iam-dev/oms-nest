"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Customer } from '@/services/customers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CUSTOMER_COUNTRIES } from '@/constants/countries';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';

export interface FitterOption {
  id: number;
  name: string;
}

interface CustomerEditModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCustomer: Partial<Customer>) => Promise<void>;
  /** Admin/supervisor: the fitters offered in the Fitter LOV. */
  fitters?: FitterOption[];
  /**
   * Fitter-role user: the LOV is shown locked to this name and no fitterId is
   * sent — the backend assigns the logged-in fitter's own id.
   */
  lockedFitterName?: string;
}

/** Sentinel value for the locked LOV; never sent to the API. */
const LOCKED_FITTER_VALUE = 'me';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Required fields, in the order the legacy Add Customer form lists them.
 * State, CellNo and Horse Name are optional there too.
 */
const REQUIRED_FIELDS: ReadonlyArray<{ key: keyof Customer; label: string }> = [
  { key: 'name', label: 'Full Customer Name' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'zipcode', label: 'Zipcode' },
  { key: 'email', label: 'Email' },
  { key: 'phoneNo', label: 'PhoneNo' },
];

function emptyCustomer(): Partial<Customer> {
  return {
    name: '',
    address: '',
    city: '',
    country: '',
    state: '',
    zipcode: '',
    email: '',
    phoneNo: '',
    cellNo: '',
    horseName: '',
  };
}

export function CustomerEditModal({
  customer,
  isOpen,
  onClose,
  onSave,
  fitters,
  lockedFitterName,
}: CustomerEditModalProps) {
  const [editedCustomer, setEditedCustomer] = useState<Partial<Customer>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCreateMode = !customer;
  const fitterLocked = lockedFitterName !== undefined;

  useEffect(() => {
    if (customer) {
      // TODO(react-hooks): syncing customer prop to local edit state; derived-state-from-props pattern, safe here
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditedCustomer({
        ...customer,
        ...Object.fromEntries(
          Object.entries(emptyCustomer()).map(([key]) => [key, customer[key as keyof Customer] ?? '']),
        ),
      });
    } else if (isOpen) {
      setEditedCustomer(emptyCustomer());
    }
    setError('');
  }, [customer, isOpen]);

  /** Returns the first problem with the form, or null when it is valid. */
  const validate = (): string | null => {
    const missing = REQUIRED_FIELDS
      .filter(({ key }) => !String(editedCustomer[key] ?? '').trim())
      .map(({ label }) => label);
    if (!fitterLocked && !editedCustomer.fitterId) {
      missing.unshift('Fitter');
    }
    if (missing.length === 1 && missing[0] === 'Full Customer Name') {
      return 'Customer name is required';
    }
    if (missing.length > 0) {
      return `The following fields are required: ${missing.join(', ')}`;
    }
    if (!EMAIL_PATTERN.test(editedCustomer.email!.trim())) {
      return 'Email must be a valid email address';
    }
    return null;
  };

  const handleSave = async () => {
    if (!editedCustomer) return;

    setSaving(true);
    setError('');

    try {
      const problem = validate();
      if (problem) {
        throw new Error(problem);
      }

      const payload: Partial<Customer> = { ...editedCustomer };
      if (fitterLocked) {
        // The backend forces the logged-in fitter's own id; never send one.
        delete payload.fitterId;
      }

      await onSave(payload);
      onClose();
    } catch (error) {
      logger.error('Error saving customer:', error);
      setError(error instanceof Error ? error.message : 'Failed to save customer. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Customer, value: string) => {
    setEditedCustomer((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFitterChange = (value: string) => {
    setEditedCustomer((prev) => ({
      ...prev,
      fitterId: value ? Number(value) : undefined,
    }));
  };

  const fitterValue = fitterLocked
    ? LOCKED_FITTER_VALUE
    : editedCustomer.fitterId !== undefined
      ? String(editedCustomer.fitterId)
      : '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreateMode ? 'Create Customer' : `Edit Customer ${customer.id}`}</DialogTitle>
          <DialogDescription>
            {isCreateMode ? 'Fill in the customer information below.' : 'Update the customer information below.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Fitter: <span className="text-red-500">*</span>
            </label>
            <Select
              value={fitterValue}
              onValueChange={handleFitterChange}
              disabled={fitterLocked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select fitter" />
              </SelectTrigger>
              <SelectContent>
                {fitterLocked ? (
                  <SelectItem value={LOCKED_FITTER_VALUE}>{lockedFitterName}</SelectItem>
                ) : (
                  (fitters ?? []).map((fitter) => (
                    <SelectItem key={fitter.id} value={String(fitter.id)}>
                      {fitter.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Full Customer Name: <span className="text-red-500">*</span>
            </label>
            <Input
              value={editedCustomer.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Customer Name"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Address: <span className="text-red-500">*</span>
            </label>
            <Input
              value={editedCustomer.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Street Address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                City: <span className="text-red-500">*</span>
              </label>
              <Input
                value={editedCustomer.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="City"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Country: <span className="text-red-500">*</span>
              </label>
              <Select
                value={editedCustomer.country || ''}
                onValueChange={(value) => handleChange('country', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">State:</label>
              <Input
                value={editedCustomer.state || ''}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="State/Province"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                Zipcode: <span className="text-red-500">*</span>
              </label>
              <Input
                value={editedCustomer.zipcode || ''}
                onChange={(e) => handleChange('zipcode', e.target.value)}
                placeholder="Postal/Zip Code"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">
              Email: <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={editedCustomer.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Email Address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                PhoneNo: <span className="text-red-500">*</span>
              </label>
              <Input
                type="tel"
                value={editedCustomer.phoneNo || ''}
                onChange={(e) => handleChange('phoneNo', e.target.value)}
                placeholder="Phone Number"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">CellNo:</label>
              <Input
                type="tel"
                value={editedCustomer.cellNo || ''}
                onChange={(e) => handleChange('cellNo', e.target.value)}
                placeholder="Cell Number"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-sm text-gray-600 mb-1">Horse Name:</label>
            <Input
              value={editedCustomer.horseName || ''}
              onChange={(e) => handleChange('horseName', e.target.value)}
              placeholder="Horse Name"
            />
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
            Back to customers
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Saving...' : isCreateMode ? 'Create customer' : 'Save customer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
