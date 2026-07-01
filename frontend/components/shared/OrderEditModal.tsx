"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Order } from '@/types/Order';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';
import { getCustomerName, getFitterName, getSupplierName, getUrgent } from '@/utils/orderHydration';

interface OrderEditModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedOrder: Record<string, unknown>) => void;
}

const STATUS_OPTIONS = [
  'UNORDERED',
  'ORDERED',
  'APPROVED', 
  'IN_PRODUCTION_P1',
  'IN_PRODUCTION_P2',
  'IN_PRODUCTION_P3',
  'SHIPPED_TO_STOCK_OWNER',
  'SHIPPED_TO_CUSTOMER',
  'INVENTORY',
  'ON_HOLD',
  'ON_TRIAL',
  'COMPLETED_SALE'
];

export function OrderEditModal({ order, isOpen, onClose, onSave }: OrderEditModalProps) {
  const [editedOrder, setEditedOrder] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (order) {
      // TODO(react-hooks): derives controlled form state from the `order` prop when the modal
      // opens, including hydrated display values (customerName, fitterName, seatSizesString);
      // replacing with useMemo would require lifting all field handlers to the parent —
      // suppress until a full controlled-form refactor is scheduled.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditedOrder({
        ...order,
        // Use direct field names from enriched order, fallback to hydrated values
        customerName: order.customerName || getCustomerName(order),
        fitterName: order.fitterName || getFitterName(order),
        supplierName: order.supplierName || getSupplierName(order),
        urgent: getUrgent(order),
        seatSizesString: Array.isArray(order.seatSizes) ? order.seatSizes.join(', ') : 
                        order.seatSize ? (Array.isArray(order.seatSize) ? order.seatSize.join(', ') : String(order.seatSize)) : 
                        ''
      });
      setError(''); // Clear any previous errors
    }
  }, [order]);

  const handleSave = async () => {
    if (!editedOrder || !order) return;
    
    setSaving(true);
    setError('');
    
    try {
      // Validate required fields
      if (!editedOrder.orderId) {
        throw new Error('Order ID is required');
      }
      
      // Prepare the updated order data
      const updatedOrder = {
        ...editedOrder,
        // Convert seat sizes string back to array
        seatSizes: editedOrder.seatSizesString ? String(editedOrder.seatSizesString).split(',').map((s: string) => s.trim()) : [],
        // Convert urgent to boolean
        urgent: editedOrder.urgent === true || editedOrder.urgent === 'true' || editedOrder.urgent === 'Yes'
      };
      
      // Call the onSave callback (this would typically make an API call)
      await onSave(updatedOrder);
      onClose();
    } catch (error) {
      logger.error('Error saving order:', error);
      setError(error instanceof Error ? error.message : 'Failed to save order. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: unknown) => {
    setEditedOrder((prev: Record<string, unknown>) => ({
      ...prev,
      [field]: value
    }));
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order - #{String(order.orderId ?? order.id)}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Order ID</label>
              <Input
                value={String(editedOrder.orderId || '')}
                onChange={(e) => handleChange('orderId', e.target.value)}
                placeholder="Order ID"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Reference/Saddle</label>
              <Input
                value={String(editedOrder.reference || '')}
                onChange={(e) => handleChange('reference', e.target.value)}
                placeholder="Reference/Saddle"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Status</label>
              <Select
                value={String(editedOrder.orderStatus || editedOrder.status || '')}
                onValueChange={(value) => handleChange('orderStatus', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Urgent</label>
              <Select
                value={editedOrder.urgent ? 'Yes' : 'No'}
                onValueChange={(value) => handleChange('urgent', value === 'Yes')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Seat Sizes (comma separated)</label>
              <Input
                value={String(editedOrder.seatSizesString || '')}
                onChange={(e) => handleChange('seatSizesString', e.target.value)}
                placeholder="17, 17.5, 18"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Customer Name</label>
              <Input
                value={String(editedOrder.customerName || '')}
                onChange={(e) => handleChange('customerName', e.target.value)}
                placeholder="Customer Name"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Fitter Name</label>
              <Input
                value={String(editedOrder.fitterName || '')}
                onChange={(e) => handleChange('fitterName', e.target.value)}
                placeholder="Fitter Name"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Supplier Name</label>
              <Input
                value={String(editedOrder.supplierName || '')}
                onChange={(e) => handleChange('supplierName', e.target.value)}
                placeholder="Supplier Name"
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Notes</label>
              <Textarea
                value={String(editedOrder.notes || '')}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Order notes..."
                rows={3}
              />
            </div>

            <div>
              <label className="block font-semibold text-sm text-gray-600 mb-1">Special Instructions</label>
              <Textarea
                value={String(editedOrder.specialInstructions || '')}
                onChange={(e) => handleChange('specialInstructions', e.target.value)}
                placeholder="Special instructions..."
                rows={3}
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
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#7b2326] hover:bg-[#8b2329] text-white"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}