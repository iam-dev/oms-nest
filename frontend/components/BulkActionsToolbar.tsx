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
import { toast } from 'sonner';
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

/**
 * Run tasks with at most `concurrency` in-flight at a time.
 * Returns results in the same order as inputs, mirroring Promise.allSettled.
 */
async function limitedAllSettled<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
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
        // FE-023: replace alert() with toast
        toast.error(`Updated ${result.updated} orders. ${result.failed} failed.`);
      } else {
        toast.success(`Updated ${result.updated} order${result.updated !== 1 ? 's' : ''} to "${selectedStatus}".`);
      }
      onStatusUpdated();
      onClearSelection();
    } catch (err) {
      logger.error('Bulk status update failed:', err);
      // FE-023: replace alert() with toast
      toast.error(err instanceof Error ? err.message : 'Failed to update statuses');
    } finally {
      setUpdating(false);
    }
  };

  const handlePrintAll = async () => {
    setPrinting(true);
    try {
      const orderIds = Array.from(selectedOrderIds);

      // FE-022: fetch all order details concurrently (max 5 in-flight) instead of serially.
      const fetchTasks = orderIds.map((orderId) => () => fetchOrderDetail(orderId));
      const settled = await limitedAllSettled(fetchTasks, 5);

      const ordersData: OrderData[] = [];
      let fetchFailed = 0;

      for (const result of settled) {
        if (result.status === 'rejected') {
          fetchFailed++;
          continue;
        }
        const detailData = result.value;

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

      // FE-022: report partial failures without discarding successes
      if (fetchFailed > 0) {
        toast.error(`${fetchFailed} order${fetchFailed !== 1 ? 's' : ''} could not be fetched and will be skipped in the PDF.`);
      }

      if (ordersData.length === 0) {
        toast.error('No order data could be loaded — PDF generation aborted.');
        return;
      }

      const doc = generateBulkOrderPDF(ordersData);
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
      // TODO(FE-023): prefer an iframe → window.print() pattern to avoid popup blockers
    } catch (err) {
      logger.error('Bulk print failed:', err);
      // FE-023: replace alert() with toast
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF');
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
