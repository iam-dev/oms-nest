"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Order } from '@/types/Order';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { getCustomerName, getFitterName } from '@/utils/orderHydration';
import { logger } from '@/utils/logger';

interface OrderApprovalModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onApprove: (order: any, approvalNotes?: string) => void;
}

export function OrderApprovalModal({ order, isOpen, onClose, onApprove }: OrderApprovalModalProps) {
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    if (!order) return;
    
    setApproving(true);
    setError('');
    
    try {
      await onApprove(order, approvalNotes);
      setApprovalNotes('');
      onClose();
    } catch (error) {
      logger.error('Error approving order:', error);
      setError(error instanceof Error ? error.message : 'Failed to approve order. Please try again.');
    } finally {
      setApproving(false);
    }
  };

  if (!order) return null;

  const isAlreadyApproved = order.orderStatus === 'APPROVED' || order.status === 'APPROVED';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAlreadyApproved ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Order Already Approved
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Approve Order
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Order Details</h3>
            <div className="text-sm space-y-1">
              <p><strong>Order ID:</strong> {String(order.orderId ?? order.id)}</p>
              <p><strong>Customer:</strong> {order.customerName || getCustomerName(order) || '-'}</p>
              <p><strong>Fitter:</strong> {String(order.fitterName || getFitterName(order) || '-')}</p>
              <p><strong>Reference:</strong> {order.reference || '-'}</p>
              <p><strong>Current Status:</strong>
                <span className={`ml-1 font-medium ${isAlreadyApproved ? 'text-green-600' : 'text-yellow-600'}`}>
                  {order.orderStatus || order.status || '-'}
                </span>
              </p>
            </div>
          </div>

          {!isAlreadyApproved && (
            <>
              <div>
                <label className="block font-semibold text-sm text-gray-600 mb-1">
                  Approval Notes (Optional)
                </label>
                <Textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add any notes about this approval..."
                  rows={3}
                />
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Confirm Approval</p>
                    <p>This will change the order status to &quot;APPROVED&quot; and may trigger production processes. This action cannot be easily undone.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {isAlreadyApproved && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-800">
                  <p className="font-medium">Order Already Approved</p>
                  <p>This order has already been approved and is ready for production.</p>
                </div>
              </div>
            </div>
          )}

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
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={approving}
          >
            {isAlreadyApproved ? 'Close' : 'Cancel'}
          </Button>
          {!isAlreadyApproved && (
            <Button
              onClick={handleApprove}
              disabled={approving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {approving ? 'Approving...' : 'Approve Order'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}