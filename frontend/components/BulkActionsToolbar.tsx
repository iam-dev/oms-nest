"use client";

import React, { useState } from 'react';
import { Printer, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { orderStatuses } from '@/utils/orderConstants';
import { bulkUpdateOrderStatus, fetchOrderDetail } from '@/services/enrichedOrders';
import { generateBulkOrderPDF, type OrderData } from '@/lib/generate-pdf';
import { logger } from '@/utils/logger';

interface BulkActionsToolbarProps {
  selectedOrderIds: Set<number>;
  onClearSelection: () => void;
  onStatusUpdated: () => void;
}

function formatOrderDate(orderTime: string | null): string {
  if (!orderTime) return '-';
  try {
    const date = new Date(orderTime);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return orderTime;
  }
}

export function BulkActionsToolbar({
  selectedOrderIds,
  onClearSelection,
  onStatusUpdated,
}: BulkActionsToolbarProps) {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [printing, setPrinting] = useState(false);

  const count = selectedOrderIds.size;
  if (count === 0) return null;

  const handleApplyStatus = () => {
    if (!selectedStatus) return;
    setConfirmOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    setConfirmOpen(false);
    setUpdating(true);
    try {
      const result = await bulkUpdateOrderStatus(
        Array.from(selectedOrderIds),
        selectedStatus,
      );
      logger.log('Bulk status update result:', result);
      if (result.failed > 0) {
        alert(`Updated ${result.updated} orders. ${result.failed} failed.`);
      }
      onStatusUpdated();
      onClearSelection();
    } catch (err) {
      logger.error('Bulk status update failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to update statuses');
    } finally {
      setUpdating(false);
    }
  };

  const handlePrintAll = async () => {
    setPrinting(true);
    try {
      const orderIds = Array.from(selectedOrderIds);
      const ordersData: OrderData[] = [];

      for (const orderId of orderIds) {
        const detailData = await fetchOrderDetail(orderId);

        const saddleModel = `${detailData.brandName || ''} ${detailData.modelName || ''}`.trim();
        const saddleLeatherType = detailData.leatherName || '';
        const saddleSpecs = detailData.saddleSpecs || [];

        const saddleDataForPdf: Record<string, string> = {
          model: saddleModel,
          leatherType: saddleLeatherType,
        };
        for (const spec of saddleSpecs) {
          saddleDataForPdf[spec.optionName] = spec.displayValue || '';
        }

        ordersData.push({
          orderId: detailData.orderId,
          saddle: saddleDataForPdf,
          saddleSpecs,
          fitter: {
            fullName: detailData.fitterName || '-',
            email: detailData.fitterEmail || '-',
          },
          customer: {
            name: detailData.customerName || detailData.orderName || '-',
            address: detailData.customerAddress || detailData.orderAddress || '',
            city: detailData.customerCity || detailData.orderCity || '',
            zipcode: detailData.customerZipcode || detailData.orderZipcode || '',
            country: detailData.customerCountry || detailData.orderCountry || '',
            email: detailData.customerEmail || detailData.orderEmail || '-',
          },
          price: {
            saddlePrice: Number(detailData.priceSaddle) || 0,
            tradeIn: Number(detailData.priceTradein) || 0,
            deposit: Number(detailData.priceDeposit) || 0,
            discount: Number(detailData.priceDiscount) || 0,
            fittingEval: Number(detailData.priceFittingeval) || 0,
            callFee: Number(detailData.priceCallfee) || 0,
            girth: Number(detailData.priceGirth) || 0,
            additional: Number(detailData.priceAdditional) || 0,
            shipping: Number(detailData.priceShipping) || 0,
            tax: Number(detailData.priceTax) || 0,
            total: Number(detailData.totalPrice) || 0,
          },
          notes: detailData.specialNotes || '',
          serialno: detailData.serialNumber || '',
          orderDate: formatOrderDate(detailData.orderTime),
          orderStatus: detailData.orderStatus || '',
          currency: detailData.currency || 'USD',
          history: [],
        });
      }

      const doc = generateBulkOrderPDF(ordersData);
      doc.save(`orders-bulk-${orderIds.length}.pdf`);
    } catch (err) {
      logger.error('Bulk print failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
        <span className="text-sm font-medium text-blue-800">
          {count} order{count !== 1 ? 's' : ''} selected
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[200px] h-8 text-sm bg-white">
              <SelectValue placeholder="Change status to..." />
            </SelectTrigger>
            <SelectContent>
              {orderStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="default"
            onClick={handleApplyStatus}
            disabled={!selectedStatus || updating}
          >
            {updating ? (
              <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Updating...</>
            ) : (
              'Apply Status'
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handlePrintAll}
            disabled={printing}
          >
            {printing ? (
              <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating...</>
            ) : (
              <><Printer className="mr-1.5 h-3.5 w-3.5" /> Print All</>
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change the status of {count} order{count !== 1 ? 's' : ''} to &quot;{selectedStatus}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStatusChange}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
