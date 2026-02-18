"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Customer } from '@/services/customers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';

interface CustomerEditModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCustomer: Partial<Customer>) => Promise<void>;
}

export function CustomerEditModal({ customer, isOpen, onClose, onSave }: CustomerEditModalProps) {
  const [editedCustomer, setEditedCustomer] = useState<Partial<Customer>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCreateMode = !customer;

  useEffect(() => {
    if (customer) {
      setEditedCustomer({
        ...customer,
        name: customer.name || '',
        address: customer.address || '',
        city: customer.city || '',
        country: customer.country || '',
        state: customer.state || '',
        zipcode: customer.zipcode || '',
        email: customer.email || '',
        phoneNo: customer.phoneNo || '',
        cellNo: customer.cellNo || '',
      });
    } else if (isOpen) {
      setEditedCustomer({
        name: '',
        address: '',
        city: '',
        country: '',
        state: '',
        zipcode: '',
        email: '',
        phoneNo: '',
        cellNo: '',
      });
    }
    setError('');
  }, [customer, isOpen]);

  const handleSave = async () => {
    if (!editedCustomer) return;

    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!editedCustomer.name?.trim()) {
        throw new Error('Customer name is required');
      }

      // Call the onSave callback
      await onSave(editedCustomer);
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
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                  <SelectItem value="Australia">Australia</SelectItem>
                  <SelectItem value="Germany">Germany</SelectItem>
                  <SelectItem value="France">France</SelectItem>
                  <SelectItem value="Netherlands">Netherlands</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">
                State: <span className="text-red-500">*</span>
              </label>
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