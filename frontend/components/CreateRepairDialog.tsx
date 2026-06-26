"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import {
  fetchOrderDetail,
  createOrderFromPayload,
  getEnrichedOrders,
  type OrderDetailData,
  type UpdateOrderPayload,
} from '@/services/enrichedOrders';

interface CreateRepairDialogProps {
  /** If provided, skip Phase 1 and go directly to the repair form for this order */
  sourceOrderId?: number;
  sourceDisplayOrderId?: number;
  onClose: () => void;
}

interface OrderSearchResult {
  id: number;
  orderId: number;
  saddleBrand: string;
  saddleModel: string;
  customerName: string;
  fitterName: string;
  orderDate: string;
  orderStatus: string;
}

export function CreateRepairDialog({ sourceOrderId, sourceDisplayOrderId, onClose }: CreateRepairDialogProps) {
  // Phase state: 'search' or 'form'
  const [phase, setPhase] = useState<'search' | 'form'>(sourceOrderId ? 'form' : 'search');

  // Phase 1: Search
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<OrderSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Phase 2: Repair form
  const [selectedOrderId, setSelectedOrderId] = useState<number>(sourceOrderId || 0);
  const [displayOrderId, setDisplayOrderId] = useState<number>(sourceDisplayOrderId || 0);
  const [orderDetail, setOrderDetail] = useState<OrderDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Repair form fields
  const [checkedOptions, setCheckedOptions] = useState<Record<number, boolean>>({});
  const [repairNotes, setRepairNotes] = useState('');
  const [repairPrice, setRepairPrice] = useState('0.00');
  const [saving, setSaving] = useState(false);

  // Search for orders
  // FE-025: raise min length to 3 for non-numeric input; add AbortController to cancel
  // in-flight requests when searchTerm changes before the debounce fires.
  useEffect(() => {
    const trimmed = searchTerm.trim();
    const isNumeric = /^\d+$/.test(trimmed);

    // Numeric (order ID) search still starts at 1 character; text search requires 3+
    const minLength = isNumeric ? 1 : 3;

    if (phase !== 'search' || trimmed.length < minLength) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        // Smart detection: if input is all digits, search by order ID filter
        // (searchTerm only does ILIKE on text fields, not on o.id)
        const response = await getEnrichedOrders(
          isNumeric
            ? { filters: { orderId: trimmed }, page: 1 }
            : { searchTerm: trimmed, page: 1, filters: {} },
        );

        // Bail out if this request was superseded
        if (controller.signal.aborted) return;

        const members = response['hydra:member'] || [];
        const results: OrderSearchResult[] = members.slice(0, 15).map((order: Record<string, unknown>) => ({
          id: Number(order.id),
          orderId: Number(order.orderId || order.id),
          saddleBrand: String(order.saddleBrand || ''),
          saddleModel: String(order.saddleModel || ''),
          customerName: String(order.customerName || order.name || '-'),
          fitterName: String(order.fitterName || '-'),
          orderDate: order.orderTime ? new Date(String(order.orderTime)).toLocaleDateString() : '-',
          orderStatus: String(order.orderStatus || '-'),
        }));

        setSearchResults(results);
      } catch (err) {
        if (controller.signal.aborted) return;
        logger.warn('Order search failed:', err);
        setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, phase]);

  // Load order detail when entering Phase 2
  const loadOrderDetail = useCallback(async (orderId: number) => {
    setLoadingDetail(true);
    setDetailError(null);

    try {
      const detail = await fetchOrderDetail(orderId);
      setOrderDetail(detail);

      // Initialize all options as unchecked
      const initialChecked: Record<number, boolean> = {};
      for (const spec of detail.saddleSpecs) {
        initialChecked[spec.optionId] = false;
      }
      setCheckedOptions(initialChecked);

      // Pre-populate repair notes
      const orderRef = detail.orderId || orderId;
      setRepairNotes(`Repair of Order #${orderRef}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load order details';
      logger.error('Error loading order for repair:', err);
      setDetailError(msg);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Load detail when sourceOrderId is provided directly
  useEffect(() => {
    if (sourceOrderId && phase === 'form') {
      loadOrderDetail(sourceOrderId);
    }
  }, [sourceOrderId, phase, loadOrderDetail]);

  // Handle selecting an order from search results
  const handleSelectOrder = (result: OrderSearchResult) => {
    setSelectedOrderId(result.id);
    setDisplayOrderId(result.orderId);
    setPhase('form');
    loadOrderDetail(result.id);
  };

  // Handle going back to search
  const handleBackToSearch = () => {
    setPhase('search');
    setOrderDetail(null);
    setCheckedOptions({});
    setRepairNotes('');
    setRepairPrice('0.00');
  };

  // Toggle an option checkbox
  const toggleOption = (optionId: number) => {
    setCheckedOptions(prev => ({ ...prev, [optionId]: !prev[optionId] }));
  };

  // Check/uncheck all
  const toggleAll = (checked: boolean) => {
    if (!orderDetail) return;
    const updated: Record<number, boolean> = {};
    for (const spec of orderDetail.saddleSpecs) {
      updated[spec.optionId] = checked;
    }
    setCheckedOptions(updated);
  };

  const checkedCount = Object.values(checkedOptions).filter(Boolean).length;
  const totalOptions = orderDetail?.saddleSpecs.length || 0;

  // Submit repair order
  const handleSubmit = async () => {
    if (!orderDetail) return;

    // Build saddleOptions from checked items only
    const saddleOptions: UpdateOrderPayload['saddleOptions'] = [];
    for (const spec of orderDetail.saddleSpecs) {
      if (checkedOptions[spec.optionId]) {
        saddleOptions.push({
          optionId: spec.optionId,
          optionItemId: spec.optionItemId,
          custom: spec.custom || '',
        });
      }
    }

    const payload: UpdateOrderPayload = {
      // Copy from original order
      fitterId: orderDetail.fitterId || undefined,
      saddleId: orderDetail.saddleId || undefined,
      leatherId: orderDetail.leatherId || undefined,
      customerId: orderDetail.customerId || undefined,
      customerName: orderDetail.customerName || undefined,
      customerEmail: orderDetail.customerEmail || undefined,
      customerAddress: orderDetail.customerAddress || undefined,
      customerCity: orderDetail.customerCity || undefined,
      customerState: orderDetail.customerState || undefined,
      customerZipcode: orderDetail.customerZipcode || undefined,
      customerCountry: orderDetail.customerCountry || undefined,
      customerPhone: orderDetail.customerPhone || undefined,
      customerCell: orderDetail.customerCell || undefined,
      shipName: orderDetail.shipName || undefined,
      shipAddress: orderDetail.shipAddress || undefined,
      shipCity: orderDetail.shipCity || undefined,
      shipZipcode: orderDetail.shipZipcode || undefined,
      shipCountry: orderDetail.shipCountry || undefined,

      // Repair-specific
      repair: true,
      repairSourceOrderId: selectedOrderId || undefined,
      orderStatus: 'Unordered',
      specialNotes: repairNotes,
      saddleOptions,

      // Pricing: only repair price, rest zeroed
      priceSaddle: parseFloat(repairPrice) || 0,
      priceTradein: 0,
      priceDeposit: 0,
      priceDiscount: 0,
      priceFittingeval: 0,
      priceCallfee: 0,
      priceGirth: 0,
      priceShipping: 0,
      priceTax: 0,
      priceAdditional: 0,

      // Flags
      fitterStock: false,
      demo: false,
      sponsored: false,
      rushed: false,
    };

    setSaving(true);
    try {
      const result = await createOrderFromPayload(payload);
      toast.success(`Repair order #${result.orderId} created successfully!`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create repair order';
      logger.error('Error creating repair order:', err);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const saddleDisplay = orderDetail
    ? `${orderDetail.brandName || ''} ${orderDetail.modelName || ''}`.trim()
    : '';

  return (
    <DialogContent className="h-[85vh] p-0 flex flex-col" style={{ maxWidth: '900px', width: '900px' }}>
      <DialogHeader className="px-6 py-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          {phase === 'form' && !sourceOrderId && (
            <Button variant="ghost" size="sm" className="h-8 px-3" onClick={handleBackToSearch}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <Wrench className="h-5 w-5 text-[#8B0000]" />
          <DialogTitle className="text-lg">
            {phase === 'search'
              ? 'Create Repair — Select Original Order'
              : `Create Repair for Order #${displayOrderId}`}
          </DialogTitle>
        </div>
      </DialogHeader>

      {/* Phase 1: Search for order */}
      {phase === 'search' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <p className="text-sm text-gray-600">
              Search for the original order to create a repair from. You can search by order ID, customer name, or saddle model.
            </p>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Enter order ID, customer name, or saddle model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {searching && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#8B0000]"></div>
                Searching...
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Order ID</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Saddle</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Customer</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Fitter</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((result) => (
                      <tr
                        key={result.id}
                        className="border-b last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => handleSelectOrder(result)}
                      >
                        <td className="px-3 py-2 font-medium">{result.orderId}</td>
                        <td className="px-3 py-2">{`${result.saddleBrand} ${result.saddleModel}`.trim() || '-'}</td>
                        <td className="px-3 py-2">{result.customerName}</td>
                        <td className="px-3 py-2">{result.fitterName}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {result.orderStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {searchTerm.trim().length > 0 && searchTerm.trim().length < (/^\d+$/.test(searchTerm.trim()) ? 1 : 3) && (
              <p className="text-sm text-gray-400 text-center py-4">Enter at least 3 characters to search</p>
            )}

            {searchTerm.trim().length >= (/^\d+$/.test(searchTerm.trim()) ? 1 : 3) && !searching && searchResults.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No orders found matching &quot;{searchTerm}&quot;</p>
            )}
          </div>
        </div>
      )}

      {/* Phase 2: Repair form */}
      {phase === 'form' && (
        <>
          {loadingDetail && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B0000] mx-auto mb-4"></div>
                <p className="text-gray-600">Loading order details...</p>
              </div>
            </div>
          )}

          {detailError && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-red-600">
                <p className="font-semibold">Error loading order</p>
                <p className="text-sm text-gray-600 mt-1">{detailError}</p>
                <Button onClick={() => loadOrderDetail(selectedOrderId)} size="sm" variant="outline" className="mt-3">
                  Retry
                </Button>
              </div>
            </div>
          )}

          {!loadingDetail && !detailError && orderDetail && (
            <div className="flex-1 overflow-auto p-6">
              <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 300px' }}>
                {/* Left: Parts to repair */}
                <div className="bg-white rounded-lg border p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">Parts to Repair</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">{checkedCount}/{totalOptions} selected</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => toggleAll(checkedCount < totalOptions)}
                      >
                        {checkedCount < totalOptions ? 'Select all' : 'Deselect all'}
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 mb-4">
                    Check the parts that need to be repaired. Only checked items will be included in the repair order.
                  </p>

                  <div className="space-y-1">
                    {orderDetail.saddleSpecs
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((spec) => (
                        <label
                          key={spec.optionId}
                          className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                            checkedOptions[spec.optionId]
                              ? 'bg-red-50 border border-red-200'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <Checkbox
                            checked={!!checkedOptions[spec.optionId]}
                            onCheckedChange={() => toggleOption(spec.optionId)}
                          />
                          <span className="text-sm font-medium text-gray-700 w-36 shrink-0">
                            {spec.optionName}:
                          </span>
                          <span className="text-sm text-gray-900">
                            {spec.displayValue || spec.itemName || '-'}
                            {spec.custom && (
                              <span className="text-gray-500 ml-1">({spec.custom})</span>
                            )}
                          </span>
                        </label>
                      ))}
                  </div>

                  {orderDetail.saddleSpecs.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">
                      No saddle specifications found for this order.
                    </p>
                  )}
                </div>

                {/* Right: Repair details */}
                <div className="space-y-4">
                  {/* Order summary */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-3">Original Order</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Order #:</span>
                        <span className="font-medium">{displayOrderId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Saddle:</span>
                        <span className="font-medium">{saddleDisplay || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Leather:</span>
                        <span>{orderDetail.leatherName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fitter:</span>
                        <span>{orderDetail.fitterName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customer:</span>
                        <span>{orderDetail.customerName || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Repair notes */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-3">Repair Notes</h3>
                    <textarea
                      className="w-full h-28 p-2 border rounded-md text-sm resize-none"
                      value={repairNotes}
                      onChange={(e) => setRepairNotes(e.target.value)}
                      placeholder="Describe what needs to be repaired..."
                    />
                  </div>

                  {/* Repair price */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-3">Repair Price</h3>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600">Amount:</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={repairPrice}
                        onChange={(e) => setRepairPrice(e.target.value)}
                        className="h-8 text-right w-28"
                      />
                      <span className="text-sm text-gray-500">
                        {orderDetail.currency || 'USD'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          {!loadingDetail && !detailError && orderDetail && (
            <div className="border-t p-4 bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {checkedCount === 0
                  ? 'Select at least one part to repair'
                  : `${checkedCount} part${checkedCount !== 1 ? 's' : ''} selected for repair`}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={saving || checkedCount === 0}
                  className="bg-[#8B0000] hover:bg-[#6B0000] text-white"
                >
                  {saving ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </div>
                  ) : (
                    `Create Repair Order`
                  )}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer for search phase */}
      {phase === 'search' && (
        <div className="border-t p-4 bg-gray-50 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      )}
    </DialogContent>
  );
}
