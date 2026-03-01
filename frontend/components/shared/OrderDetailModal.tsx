"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Order } from '@/types/Order';
import { getCustomerName, getFitterName, getSupplierName, getUrgent } from '@/utils/orderHydration';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailModal({ order, isOpen, onClose }: OrderDetailModalProps) {
  if (!order) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return dateStr;
    }
  };

  const extractSeatSizes = (order: Order): string => {
    if (!order) return '';
    
    // Check for seatSizes array first (from hydra response)
    if (Array.isArray(order.seatSizes) && order.seatSizes.length > 0) {
      return order.seatSizes.join(', ');
    }
    
    // Extract from reference if available
    if (order.reference) {
      const match = order.reference.match(/(\d{2}(?:\.5)?)/g);
      if (match && match.length > 0) {
        return match.join(', ');
      }
    }
    
    // Fallback to seatSize property
    if (order.seatSize) {
      if (Array.isArray(order.seatSize)) {
        return order.seatSize.join(', ');
      }
      return String(order.seatSize);
    }
    
    return '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details - #{String(order.orderId ?? order.id)}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-6 mt-4">
          {/* Left Column - Your order reference & Saddle Information */}
          <div className="space-y-6">
            {/* Your order reference section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-4">Your order reference</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Order ID:</span>
                  <span className="text-gray-900">{String(order.orderId ?? order.id ?? '-')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Your reference:</span>
                  <span className="text-gray-900">{order.reference || '-'}</span>
                </div>
              </div>
            </div>

            {/* Saddle information section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-4">Saddle information</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Reference:</span>
                  <span className="text-gray-900">{order.reference || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Seat Size:</span>
                  <span className="text-gray-900">{extractSeatSizes(order) || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className="text-gray-900 font-medium">{order.orderStatus || order.status || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Urgent:</span>
                  <span className={`font-medium ${getUrgent(order) ? 'text-red-600' : 'text-green-600'}`}>
                    {getUrgent(order) ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Fitter Information & Customer Information */}
          <div className="space-y-6">
            {/* Fitter information section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-4">Fitter information</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Fitter Name:</span>
                  <span className="text-gray-900 italic">{getFitterName(order) || '-'}</span>
                </div>
              </div>
            </div>

            {/* Customer information section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-4">Customer information</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Customer:</span>
                  <span className="text-gray-900">{order.customerName || getCustomerName(order) || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Order Date:</span>
                  <span className="text-gray-900">{formatDate(String(order.orderTime || order.createdAt || order.date || ''))}</span>
                </div>
              </div>
            </div>

            {/* Order Status section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-4">Order Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className="text-gray-900 font-medium">{order.orderStatus || order.status || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Priority:</span>
                  <span className={`font-medium ${getUrgent(order) ? 'text-red-600' : 'text-green-600'}`}>
                    {getUrgent(order) ? 'High Priority' : 'Normal'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Supplier & Additional Info */}
          <div className="space-y-6">
            {/* Supplier information */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-4">Factory</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Factory:</span>
                  <span className="text-gray-900">{order.supplierName || getSupplierName(order) || '-'}</span>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            {(order.notes || order.specialInstructions) && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-4">Additional Information</h3>
                <div className="space-y-3">
                  {order.notes ? (
                    <div>
                      <span className="font-medium text-gray-700 text-sm">Notes:</span>
                      <p className="text-sm text-gray-900 mt-1">{String(order.notes)}</p>
                    </div>
                  ) : null}
                  {order.specialInstructions && (
                    <div>
                      <span className="font-medium text-gray-700 text-sm">Special Instructions:</span>
                      <p className="text-sm text-gray-900 mt-1">{order.specialInstructions}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Technical Details */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-4">Technical Details</h3>
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Order UUID:</span>
                  <p className="font-mono text-xs break-all text-gray-600 mt-1">{order.id || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}