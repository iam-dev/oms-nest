"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ComprehensiveEditOrder } from './ComprehensiveEditOrder';
import { CreateRepairDialog } from './CreateRepairDialog';
import { generateOrderPDF, generateLabelPDF } from '@/lib/generate-pdf';
import { fetchOrderDetail, createDraftOrder, bulkCreateDraftOrders, type OrderDetailData } from '@/services/enrichedOrders';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportOrderToXlsx } from '@/utils/exportXlsx';
import { renderLegacyLogContent } from '@/utils/legacyLogContent';
import { logger } from '@/utils/logger';
import { API_URL } from '@/services/api-config';

interface OrderDetailsProps {
  order: {
    id: string | number;
    orderId?: number;
    status?: string;
    orderStatus?: string;
  };
  onClose: () => void;
  onOrderChanged?: () => void;
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

function formatCommentDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) + ' | ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function formatPrice(value: number | null | undefined): string {
  if (value == null) return '-';
  return Number(value).toFixed(2);
}

export function OrderDetails({ order, onClose, onOrderChanged }: OrderDetailsProps) {
  const orderId = Number(order.id) || Number(order.orderId) || 0;
  const displayOrderId = order.orderId || orderId;

  const [detailData, setDetailData] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orderStatus, setOrderStatus] = useState(order.orderStatus || order.status || '');
  const [statusChanging, setStatusChanging] = useState(false);
  const [comment, setComment] = useState('');
  const [sendTo, setSendTo] = useState('fitter-factory');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [draftOrderId, setDraftOrderId] = useState<number | null>(null);
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [isBulkDuplicateOpen, setIsBulkDuplicateOpen] = useState(false);
  const [bulkDuplicateCount, setBulkDuplicateCount] = useState(5);
  const [bulkDuplicating, setBulkDuplicating] = useState(false);
  const [copiedSaddle, setCopiedSaddle] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (!orderId) {
      // TODO(react-hooks): Early-exit guard — orderId is 0/falsy only when the parent passes
      // no valid id. Setting error+loading synchronously here is safe: it runs once at mount
      // with a stable falsy orderId and avoids a dangling async fetch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('No order ID provided');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchOrderDetail(orderId);
        if (!cancelled) {
          setDetailData(data);
          if (data.orderStatus) {
            setOrderStatus(data.orderStatus);
          }
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('Failed to load order detail:', err);
          setError(err instanceof Error ? err.message : 'Failed to load order details');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [orderId]);

  // Saddle model and leather type from the order's saddle/leather joins
  const saddleModel = detailData ? `${detailData.brandName || ''} ${detailData.modelName || ''}`.trim() : '';
  const saddleLeatherType = detailData?.leatherName || '';

  // Saddle specifications from API (orders_info + options + options_items/leather_types)
  const saddleSpecs = detailData?.saddleSpecs || [];

  const fitterData = {
    inInventory: 'no',
    userName: detailData?.fitterUsername || '-',
    fullName: detailData?.fitterName || '-',
    address: detailData?.fitterAddress || '-',
    zipcode: detailData?.fitterZipcode || '-',
    state: detailData?.fitterState || '-',
    city: detailData?.fitterCity || '-',
    country: detailData?.fitterCountry || '-',
    phone: detailData?.fitterPhone || '-',
    cell: detailData?.fitterCell || '-',
    currency: detailData?.fitterCurrency || detailData?.currency || '-',
    email: detailData?.fitterEmail || '-',
  };

  const customerData = {
    name: detailData?.customerName || detailData?.orderName || '-',
    address: detailData?.customerAddress || detailData?.orderAddress || '',
    city: detailData?.customerCity || detailData?.orderCity || '',
    zipcode: detailData?.customerZipcode || detailData?.orderZipcode || '',
    country: detailData?.customerCountry || detailData?.orderCountry || '',
    email: detailData?.customerEmail || detailData?.orderEmail || '-',
  };

  const priceData = {
    saddlePrice: Number(detailData?.priceSaddle) || 0,
    tradeIn: Number(detailData?.priceTradein) || 0,
    deposit: Number(detailData?.priceDeposit) || 0,
    discount: Number(detailData?.priceDiscount) || 0,
    fittingEval: Number(detailData?.priceFittingeval) || 0,
    callFee: Number(detailData?.priceCallfee) || 0,
    girth: Number(detailData?.priceGirth) || 0,
    additional: Number(detailData?.priceAdditional) || 0,
    shipping: Number(detailData?.priceShipping) || 0,
    tax: Number(detailData?.priceTax) || 0,
    total: Number(detailData?.totalPrice) || 0,
  };

  const serialNumber = detailData?.serialNumber || '';
  const specialNotes = detailData?.specialNotes || '';
  const orderDate = formatOrderDate(detailData?.orderTime || null);

  // Merge log entries (legacy production history) and newer comments
  const logTimelineEntries = (detailData?.logEntries || []).map((entry) => ({
    date: formatCommentDate(entry.createdAt),
    user: entry.userName || 'System',
    action: entry.content || '',
    timestamp: new Date(entry.createdAt).getTime(),
  }));

  const commentTimelineEntries = (detailData?.comments || []).map((c) => ({
    date: formatCommentDate(c.createdAt),
    user: c.userName || 'System',
    action: c.content || '',
    timestamp: new Date(c.createdAt).getTime(),
  }));

  // Combine both sources and sort by timestamp descending (newest first)
  const comments = [...logTimelineEntries, ...commentTimelineEntries]
    .sort((a, b) => b.timestamp - a.timestamp);

  // Handle adding a comment
  const handleAddComment = async () => {
    if (!comment.trim() || !orderId) return;

    const typeMap: Record<string, string> = {
      'fitter-factory': 'general',
      'fitter': 'customer',
      'factory': 'production',
    };

    setSubmittingComment(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId,
          content: comment.trim(),
          type: typeMap[sendTo] || 'general',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add comment: ${errorText}`);
      }

      setComment('');
      // Reload order detail to show the new comment
      const data = await fetchOrderDetail(orderId);
      setDetailData(data);
    } catch (err) {
      logger.error('Failed to add comment:', err);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Handle order status change
  const handleChangeOrderStatus = async () => {
    if (!orderStatus || !detailData) return;

    setStatusChanging(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/enriched_orders/update-status/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: orderStatus }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Failed to update status (${response.status}): ${body || response.statusText}`);
      }

      // Refetch detail so the rest of the panel reflects what was saved
      const refreshed = await fetchOrderDetail(orderId);
      setDetailData(refreshed);
      if (refreshed.orderStatus) {
        setOrderStatus(refreshed.orderStatus);
      }

      alert(`Order status changed to "${orderStatus}"`);
      onOrderChanged?.();
    } catch (err) {
      logger.error('Failed to change order status:', err);
      alert(`Failed to change order status: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setStatusChanging(false);
    }
  };

  // Build data for PDF generation
  const saddleDataForPdf: Record<string, string> = { model: saddleModel, leatherType: saddleLeatherType };
  for (const spec of saddleSpecs) {
    saddleDataForPdf[spec.optionName] = spec.displayValue || '';
  }
  const orderDataForPdf = {
    orderId: displayOrderId,
    saddle: saddleDataForPdf,
    saddleSpecs,
    fitter: fitterData,
    customer: customerData,
    price: priceData,
    notes: specialNotes,
    serialno: serialNumber,
    orderDate: orderDate,
    orderStatus: orderStatus,
    currency: detailData?.currency || 'USD',
    history: comments,
  };

  const handlePrintOrder = () => {
    const doc = generateOrderPDF(orderDataForPdf);
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  };

  const handlePrintLabel = () => {
    const doc = generateLabelPDF(orderDataForPdf);
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  };

  const handleDuplicateOrder = async () => {
    try {
      const result = await createDraftOrder(orderId);
      setDraftOrderId(result.orderId);
      setIsDuplicateOpen(true);
    } catch (err) {
      logger.error('Failed to create draft order:', err);
    }
  };

  const handleBulkDuplicate = async () => {
    if (bulkDuplicateCount < 1 || bulkDuplicateCount > 50) return;
    try {
      setBulkDuplicating(true);
      const result = await bulkCreateDraftOrders(orderId, bulkDuplicateCount);
      setIsBulkDuplicateOpen(false);
      onOrderChanged?.();
      alert(`Successfully created ${result.orderIds.length} duplicate orders: #${result.orderIds.join(', #')}`);
    } catch (err) {
      logger.error('Failed to bulk duplicate order:', err);
      alert('Failed to bulk duplicate order. Please try again.');
    } finally {
      setBulkDuplicating(false);
    }
  };

  const handleCopySaddleInfo = async () => {
    const lines: string[] = [];
    if (saddleModel) lines.push(`Model\t${saddleModel}`);
    if (saddleLeatherType) lines.push(`Leathertype\t${saddleLeatherType}`);
    if (serialNumber) lines.push(`SerialNumber\t${serialNumber}`);
    for (const spec of saddleSpecs) {
      lines.push(`${spec.optionName}\t${spec.displayValue || ''}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSaddle(true);
      setTimeout(() => setCopiedSaddle(false), 2000);
    } catch {
      logger.error('Failed to copy saddle info to clipboard');
    }
  };

  const handleExportToXlsx = async () => {
    await exportOrderToXlsx({
      orderId: displayOrderId,
      orderDate,
      orderStatus,
      currency: detailData?.currency || 'USD',
      saddleModel,
      saddleLeatherType,
      serialNumber,
      saddleSpecs,
      fitter: fitterData,
      customer: customerData,
      price: priceData,
      notes: specialNotes,
    });
  };

  // Loading state
  if (loading) {
    return (
      <DialogContent className="max-w-[1200px] h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-4 py-2 border-b bg-[#F5F5F5] flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded-full bg-[#8B0000] text-white flex items-center justify-center text-xs">
              D
            </div>
            <span className="text-base">Order {displayOrderId}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B0000] mx-auto mb-3"></div>
            <p className="text-sm text-gray-500">Loading order details...</p>
          </div>
        </div>
      </DialogContent>
    );
  }

  // Error state
  if (error) {
    return (
      <DialogContent className="max-w-[1200px] h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-4 py-2 border-b bg-[#F5F5F5] flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded-full bg-[#8B0000] text-white flex items-center justify-center text-xs">
              D
            </div>
            <span className="text-base">Order {displayOrderId}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-red-600 mb-2">Failed to load order details</p>
            <p className="text-xs text-gray-500">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      </DialogContent>
    );
  }

  return (
    <>
      <DialogContent className="max-w-[1200px] h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-4 py-2 border-b bg-[#F5F5F5] flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded-full bg-[#8B0000] text-white flex items-center justify-center text-xs">
              D
            </div>
            <span className="text-base">Order {displayOrderId}</span>
            {detailData?.repairSourceOrderId && (
              <button
                onClick={() => {
                  onClose?.();
                  window.location.href = `/orders?viewOrder=${detailData.repairSourceOrderId}`;
                }}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 ml-2 hover:bg-amber-200 cursor-pointer transition-colors"
              >
                Repair of #{detailData.repairSourceOrderId} &rarr;
              </button>
            )}
            {detailData?.repairOrderIds && detailData.repairOrderIds.length > 0 && (
              <button
                onClick={() => {
                  onClose?.();
                  window.location.href = `/repairs?viewOrder=${detailData.repairOrderIds![0]}`;
                }}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-2 hover:bg-blue-200 cursor-pointer transition-colors"
              >
                Repair: #{detailData.repairOrderIds[0]} &rarr;
              </button>
            )}
            <span className="text-xs font-normal ml-4">
              Order date: {orderDate}
            </span>
            <span className="ml-auto text-xs">
              Status: {orderStatus}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Left Column - Saddle Information */}
              <div className="space-y-6">
                {/* Your order reference - shown when reference exists */}
                {detailData?.fitterReference && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-sm mb-4">Your order reference</h3>
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-gray-700">Your reference</span>
                      <span className="text-gray-900 italic">{detailData.fitterReference}</span>
                    </div>
                  </div>
                )}

                {/* Saddle information - Model & Leathertype */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm">Saddle information</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={handleCopySaddleInfo}
                    >
                      {copiedSaddle ? 'Copied!' : 'Copy saddle info'}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-gray-700">Model:</span>
                      <span className="text-gray-900 italic">{saddleModel}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-gray-700">Leathertype:</span>
                      <span className="text-gray-900 italic">{saddleLeatherType}</span>
                    </div>
                    {serialNumber && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-gray-700">SerialNumber:</span>
                          <span className="text-gray-900 italic">{serialNumber}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Options section - separate from saddle info */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-sm mb-4">Options</h3>
                  <div className="space-y-3">
                    {saddleSpecs.map((spec, idx) => (
                      <div key={idx} className="flex justify-between text-sm gap-2">
                        <span className="font-bold text-gray-700 shrink-0">{spec.optionName}:</span>
                        <span className="text-gray-900 italic text-right">{spec.displayValue || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Special Notes section - only shown when notes exist */}
                {specialNotes && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-sm mb-4">Special Notes</h3>
                    <p className="text-sm text-gray-900 italic whitespace-pre-wrap">{specialNotes}</p>
                  </div>
                )}
              </div>

              {/* Middle Column - Fitter Information & Customer Information & Order Status */}
              <div className="space-y-6">
                {/* Fitter information section */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-sm mb-4">Fitter information</h3>
                  <div className="space-y-3">
                    {[
                      ['In inventory:', fitterData.inInventory],
                      ['User Name:', fitterData.userName],
                      ['Full Name:', fitterData.fullName],
                      ['Address:', fitterData.address],
                      ['Zipcode:', fitterData.zipcode],
                      ['State:', fitterData.state],
                      ['City:', fitterData.city],
                      ['Country:', fitterData.country],
                      ['Phone:', fitterData.phone],
                      ['Cell:', fitterData.cell],
                      ['Currency:', fitterData.currency],
                      ['Email address:', fitterData.email],
                    ].map(([label, value], idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">{label}</span>
                        <span className="text-gray-900 italic">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer information section */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-sm mb-4">Customer information</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">Customer:</span>
                      <span className="text-gray-900">{customerData.name}</span>
                    </div>
                    {(customerData.address || customerData.city || customerData.country) && (
                      <div className="text-sm text-gray-900">
                        {customerData.address && <>{customerData.address}<br/></>}
                        {(customerData.city || customerData.zipcode) && (
                          <>{customerData.city}{customerData.city && customerData.zipcode ? ', ' : ''}{customerData.zipcode}<br/></>
                        )}
                        {customerData.country}
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">Email address:</span>
                      <span className="text-gray-900 italic">{customerData.email}</span>
                    </div>
                  </div>
                </div>

                {/* Order Status section */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-sm mb-4">Order Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-700 text-sm">Order Status:</span>
                      <Select value={orderStatus} onValueChange={setOrderStatus}>
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unordered">Unordered</SelectItem>
                          <SelectItem value="Ordered">Ordered</SelectItem>
                          <SelectItem value="Approved">Approved</SelectItem>
                          <SelectItem value="In Production P1">In Production P1</SelectItem>
                          <SelectItem value="On hold">On hold</SelectItem>
                          <SelectItem value="Shipped to Fitter">Shipped to Fitter</SelectItem>
                          <SelectItem value="On trial">On trial</SelectItem>
                          <SelectItem value="Completed sale">Completed sale</SelectItem>
                          <SelectItem value="Changed">Changed</SelectItem>
                          <SelectItem value="In Production P2">In Production P2</SelectItem>
                          <SelectItem value="In Production P3">In Production P3</SelectItem>
                          <SelectItem value="Shipped to Customer">Shipped to Customer</SelectItem>
                          <SelectItem value="Inventory Aiken">Inventory Aiken</SelectItem>
                          <SelectItem value="Inventory UK">Inventory UK</SelectItem>
                          <SelectItem value="Inventory HOLLAND">Inventory HOLLAND</SelectItem>
                          <SelectItem value="Awaiting Client Confirmation">Awaiting Client Confirmation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="bg-[#8B0000] h-8 text-xs"
                      onClick={handleChangeOrderStatus}
                      disabled={statusChanging}
                    >
                      {statusChanging ? 'Changing...' : 'Change orderstatus'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Column - Price */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-4">Price</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Saddle price:</span>
                    <span className="text-gray-900">{formatPrice(priceData.saddlePrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Trade in:</span>
                    <span className="text-gray-900">- {formatPrice(priceData.tradeIn)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Deposit:</span>
                    <span className="text-gray-900">- {formatPrice(priceData.deposit)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Discount:</span>
                    <span className="text-gray-900">- {formatPrice(priceData.discount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Fitting/Eval:</span>
                    <span className="text-gray-900">{formatPrice(priceData.fittingEval)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Call fee:</span>
                    <span className="text-gray-900">{formatPrice(priceData.callFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Girth:</span>
                    <span className="text-gray-900">{formatPrice(priceData.girth)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Additional:</span>
                    <span className="text-gray-900">{formatPrice(priceData.additional)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Shipping:</span>
                    <span className="text-gray-900">{formatPrice(priceData.shipping)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Tax:</span>
                    <span className="text-gray-900">{formatPrice(priceData.tax)}</span>
                  </div>
                  <div className="text-xs text-gray-600 py-2">
                    Shippingcosts and Taxes will be determined by Custom Saddlery.
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-base font-semibold">
                      <span>Total ({detailData?.currency || 'USD'}):</span>
                      <span>{formatPrice(priceData.total)}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-2">
                      Your deposit is non-refundable if your order is canceled.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Comments Section */}
            <div className="border rounded-lg p-3">
              <div className="flex gap-3 mb-3">
                <Textarea
                  placeholder="Add your comment here..."
                  className="min-h-[80px] text-xs"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="space-y-2">
                  <Select value={sendTo} onValueChange={setSendTo}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue>
                        {sendTo === 'fitter-factory' && 'Fitter & Factory'}
                        {sendTo === 'fitter' && 'Only Fitter'}
                        {sendTo === 'factory' && 'Only Factory'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fitter-factory">Fitter & Factory</SelectItem>
                      <SelectItem value="fitter">Only Fitter</SelectItem>
                      <SelectItem value="factory">Only Factory</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full bg-[#8B0000] h-8 text-xs"
                    onClick={handleAddComment}
                    disabled={submittingComment || !comment.trim()}
                  >
                    {submittingComment ? 'Adding...' : 'Add comment'}
                  </Button>
                </div>
              </div>

              {/* Comment History */}
              <div className="relative pl-4 border-l-2 border-gray-200">
                {comments.length === 0 && (
                  <div className="text-xs text-gray-400 py-2">No comments yet.</div>
                )}
                {comments.map((entry, index) => (
                  <div key={index} className="mb-2 relative">
                    <div className="absolute -left-[17px] top-2 w-3 h-3 rounded-full bg-gray-200" />
                    <div className="bg-gray-100 rounded-lg p-2">
                      <div className="text-[10px] text-gray-600">{entry.date}</div>
                      <div className="font-medium text-[#8B0000] text-xs">{entry.user}</div>
                      {entry.action && (
                        <div className="text-xs whitespace-pre-wrap">
                          {renderLegacyLogContent(entry.action)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="border-t p-2 bg-[#F5F5F5] flex-shrink-0">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setIsEditOpen(true)}
            >
              Edit order
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handlePrintOrder}
            >
              Print order
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handlePrintLabel}
            >
              Print label
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleDuplicateOrder}
            >
              Duplicate order
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setIsBulkDuplicateOpen(true)}
            >
              Duplicate X times
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleExportToXlsx}
            >
              Export to Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setIsRepairOpen(true)}
            >
              Create repair
            </Button>
          </div>
        </div>
      </DialogContent>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <ComprehensiveEditOrder
          order={{ id: String(orderId), orderId: Number(displayOrderId) }}
          onClose={() => {
            setIsEditOpen(false);
            onOrderChanged?.();
          }}
        />
      </Dialog>

      <Dialog open={isDuplicateOpen} onOpenChange={(open) => {
        setIsDuplicateOpen(open);
        if (!open) setDraftOrderId(null);
      }}>
        {draftOrderId && (
          <ComprehensiveEditOrder
            order={{ id: String(orderId), orderId: Number(displayOrderId) }}
            isDuplicate={true}
            draftOrderId={draftOrderId}
            onClose={() => {
              setIsDuplicateOpen(false);
              setDraftOrderId(null);
              onOrderChanged?.();
            }}
          />
        )}
      </Dialog>

      <Dialog open={isRepairOpen} onOpenChange={setIsRepairOpen}>
        <CreateRepairDialog
          sourceOrderId={orderId}
          sourceDisplayOrderId={Number(displayOrderId)}
          onClose={() => {
            setIsRepairOpen(false);
            onOrderChanged?.();
          }}
        />
      </Dialog>

      <Dialog open={isBulkDuplicateOpen} onOpenChange={setIsBulkDuplicateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Duplicate Order #{displayOrderId} Multiple Times</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-count">Number of copies</Label>
              <Input
                id="bulk-count"
                type="number"
                min={1}
                max={50}
                value={bulkDuplicateCount}
                onChange={(e) => setBulkDuplicateCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">
                Creates {bulkDuplicateCount} duplicate {bulkDuplicateCount === 1 ? 'order' : 'orders'} with status &quot;Unordered&quot;.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkDuplicateOpen(false)}
                disabled={bulkDuplicating}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleBulkDuplicate}
                disabled={bulkDuplicating || bulkDuplicateCount < 1}
              >
                {bulkDuplicating ? 'Duplicating...' : `Duplicate ${bulkDuplicateCount} times`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
