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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ChevronRight, Search, User, Package, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { fetchOrderDetail, updateOrder, createOrderFromPayload, type OrderDetailData, type UpdateOrderPayload } from '@/services/enrichedOrders';
import { API_URL } from '@/services/api-config';

interface EditFormOptions {
  fitters: Array<{ id: number; username: string; fullName: string }>;
  saddles: Array<{ id: number; brand: string; modelName: string; displayName: string }>;
  leatherTypes: Array<{ id: number; name: string }>;
  options: Array<{ optionId: number; optionName: string; sequence: number; group: string | null }>;
  optionItems: Array<{ id: number; name: string; optionId: number }>;
  statuses: Array<{ id: number; name: string }>;
  presets: Array<{ id: number; name: string; sequence: number }>;
  presetItems: Array<{ presetId: number; optionId: number; itemId: number }>;
}

// Leather option IDs - these use leather_types instead of options_items
const LEATHER_OPTION_IDS = [5, 6, 10, 11, 12, 13, 14, 21, 22];

interface ComprehensiveEditOrderProps {
  order?: {
    id: string;
    orderId: number;
  };
  isDuplicate?: boolean;
  draftOrderId?: number;
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  onBack?: () => void;
}

const steps = [
  { id: 1, title: 'Saddle Information', icon: Package },
  { id: 2, title: 'Customer Information', icon: User },
  { id: 3, title: 'Order overview', icon: Settings },
];

// Currency map (integer to code)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const currencyMap: Record<number, string> = {
  0: 'USD', 1: 'USD', 2: 'EUR', 3: 'GBP', 4: 'AUD', 5: 'CAD', 6: 'CHF', 7: 'DE',
};

export function ComprehensiveEditOrder({ order, isDuplicate = false, draftOrderId, isLoading = false, error, onClose, onBack }: ComprehensiveEditOrderProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetched data
  const [orderDetail, setOrderDetail] = useState<OrderDetailData | null>(null);
  const [editOptions, setEditOptions] = useState<EditFormOptions | null>(null);

  // Form state - saddle info
  const [fitterId, setFitterId] = useState<string>('');
  const [saddleId, setSaddleId] = useState<string>('');
  const [leatherId, setLeatherId] = useState<string>('');
  const [isStock, setIsStock] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [isRepair, setIsRepair] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isSponsored, setIsSponsored] = useState(false);
  const [specialNotes, setSpecialNotes] = useState('');

  // Saddle option selections: optionId -> selected value
  const [optionSelections, setOptionSelections] = useState<Record<number, string>>({});
  const [optionCustom, setOptionCustom] = useState<Record<number, string>>({});

  // Form state - pricing
  const [priceSaddle, setPriceSaddle] = useState('0.00');
  const [priceTradein, setPriceTradein] = useState('0.00');
  const [priceDeposit, setPriceDeposit] = useState('0.00');
  const [priceDiscount, setPriceDiscount] = useState('0.00');
  const [priceFittingeval, setPriceFittingeval] = useState('0.00');
  const [priceCallfee, setPriceCallfee] = useState('0.00');
  const [priceGirth, setPriceGirth] = useState('0.00');
  const [priceAdditional, setPriceAdditional] = useState('0.00');
  const [priceShipping, setPriceShipping] = useState('');
  const [priceTax, setPriceTax] = useState('');

  // Form state - customer
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Form state - fitter (Step 2)
  const [fitterSearchTerm, setFitterSearchTerm] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  const [fitterSearchResults, setFitterSearchResults] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [fitterSearchLoading, setFitterSearchLoading] = useState(false);

  // Shipping address
  const [shipName, setShipName] = useState('');
  const [shipAddress, setShipAddress] = useState('');
  const [shipCity, setShipCity] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [shipState, setShipState] = useState('');
  const [shipZipcode, setShipZipcode] = useState('');
  const [shipCountry, setShipCountry] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [shippingMethod, setShippingMethod] = useState('');

  // Form state - order overview
  const [orderReference, setOrderReference] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');

  const orderId = order?.orderId || Number(order?.id) || 0;

  // Fetch edit options filtered by saddleId
  const fetchEditOptions = useCallback(async (forSaddleId?: string): Promise<EditFormOptions | null> => {
    const url = forSaddleId
      ? `${API_URL}/api/v1/enriched_orders/edit-options?saddleId=${forSaddleId}`
      : `${API_URL}/api/v1/enriched_orders/edit-options`;
    try {
      const r = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      });
      if (!r.ok) throw new Error(`Failed to fetch options: ${r.status}`);
      return r.json() as Promise<EditFormOptions>;
    } catch (err) {
      logger.warn('Failed to fetch edit options:', err);
      return null;
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    setDataError(null);

    try {
      // First fetch order detail to get saddleId
      const detail = await fetchOrderDetail(orderId);
      const detailSaddleId = detail.saddleId ? String(detail.saddleId) : undefined;

      // Then fetch options filtered by the order's saddle
      const options = await fetchEditOptions(detailSaddleId);

      setOrderDetail(detail);
      setEditOptions(options);

      // Populate form state from order detail
      setFitterId(String(detail.fitterId || ''));
      setSaddleId(String(detail.saddleId || ''));
      setLeatherId(String(detail.leatherId || ''));
      setIsStock(!!detail.fitterStock);
      setIsDemo(detail.demo);
      setIsRepair(detail.repair);
      setIsUrgent(detail.urgent);
      setIsSponsored(detail.sponsored);
      setSpecialNotes(detail.specialNotes || '');

      // Populate saddle option selections
      const selections: Record<number, string> = {};
      const customs: Record<number, string> = {};
      for (const spec of detail.saddleSpecs) {
        selections[spec.optionId] = String(spec.optionItemId);
        if (spec.custom) {
          customs[spec.optionId] = spec.custom;
        }
      }
      setOptionSelections(selections);
      setOptionCustom(customs);

      // Pricing
      setPriceSaddle(String(detail.priceSaddle ?? '0.00'));
      setPriceTradein(String(detail.priceTradein ?? '0.00'));
      setPriceDeposit(String(detail.priceDeposit ?? '0.00'));
      setPriceDiscount(String(detail.priceDiscount ?? '0.00'));
      setPriceFittingeval(String(detail.priceFittingeval ?? '0.00'));
      setPriceCallfee(String(detail.priceCallfee ?? '0.00'));
      setPriceGirth(String(detail.priceGirth ?? '0.00'));
      setPriceAdditional(String(detail.priceAdditional ?? '0.00'));
      setPriceShipping(detail.priceShipping ? String(detail.priceShipping) : '');
      setPriceTax(detail.priceTax ? String(detail.priceTax) : '');

      // Customer
      if (detail.customerName) {
        setSelectedCustomer({
          id: detail.customerId,
          name: detail.customerName,
          email: detail.customerEmail,
          address: detail.customerAddress,
          city: detail.customerCity,
          state: detail.customerState,
          zipcode: detail.customerZipcode,
          country: detail.customerCountry,
          phone: detail.customerPhone,
          cell: detail.customerCell,
        });
        setCustomerSearchTerm(detail.customerName);
      }

      // Fitter search term
      if (detail.fitterName) {
        setFitterSearchTerm(detail.fitterName);
      }

      // Shipping
      setShipName(detail.shipName || '');
      setShipAddress(detail.shipAddress || '');
      setShipCity(detail.shipCity || '');
      setShipState(detail.shipState || '');
      setShipZipcode(detail.shipZipcode || '');
      setShipCountry(detail.shipCountry || '');

      // Order overview
      setOrderReference(isDuplicate ? '' : (detail.fitterReference || ''));
      setOrderStatus(isDuplicate ? 'Unordered' : (detail.orderStatus || ''));
      setSpecialNotes(detail.specialNotes || '');

      // Reset certain fields for duplicate
      if (isDuplicate) {
        setPriceTradein('0.00');
        setPriceDeposit('0.00');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load order data';
      logger.error('Error loading order data:', err);
      setDataError(errorMessage);
    } finally {
      setLoadingData(false);
    }
  }, [orderId, isDuplicate, fetchEditOptions]);

  // Load order data and edit options
  useEffect(() => {
    if (orderId) {
      loadData();
    }
  }, [orderId, loadData]);

  // Customer search
  useEffect(() => {
    if (customerSearchTerm.length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCustomerSearchLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/customers?search=${encodeURIComponent(customerSearchTerm)}&limit=10`, {
          headers: {
            'Accept': 'application/json',
          },
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setCustomerSearchResults(data['hydra:member'] || []);
        }
      } catch { /* ignore */ }
      setCustomerSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearchTerm]);

  // Fitter search
  useEffect(() => {
    if (fitterSearchTerm.length < 2) {
      setFitterSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setFitterSearchLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/fitters?search=${encodeURIComponent(fitterSearchTerm)}&limit=10`, {
          headers: {
            'Accept': 'application/json',
          },
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setFitterSearchResults(data['hydra:member'] || []);
        }
      } catch { /* ignore */ }
      setFitterSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [fitterSearchTerm]);

  const handleSubmit = async () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      return;
    }

    setSaving(true);
    try {
      // Build saddle options array from current selections merged with original specs
      const saddleOptions: UpdateOrderPayload['saddleOptions'] = [];
      if (orderDetail) {
        const allOptionIds = new Set<number>();
        // Collect IDs from original specs
        for (const spec of orderDetail.saddleSpecs) {
          allOptionIds.add(spec.optionId);
        }
        // Collect IDs from user selections
        for (const key of Object.keys(optionSelections)) {
          allOptionIds.add(Number(key));
        }
        for (const optId of allOptionIds) {
          const selectedItemId = optionSelections[optId];
          const originalSpec = orderDetail.saddleSpecs.find(s => s.optionId === optId);
          const itemId = selectedItemId
            ? parseInt(selectedItemId, 10)
            : originalSpec?.optionItemId;
          if (itemId) {
            saddleOptions.push({
              optionId: optId,
              optionItemId: itemId,
              custom: optionCustom[optId] || originalSpec?.custom || '',
            });
          }
        }
      }

      const payload: UpdateOrderPayload = {
        fitterId: fitterId ? parseInt(fitterId, 10) : undefined,
        saddleId: saddleId ? parseInt(saddleId, 10) : undefined,
        leatherId: leatherId ? parseInt(leatherId, 10) : undefined,
        fitterStock: isStock,
        demo: isDemo,
        repair: isRepair,
        rushed: isUrgent,
        sponsored: isSponsored,
        specialNotes,
        // Customer fields
        customerName: selectedCustomer?.name || undefined,
        customerEmail: selectedCustomer?.email || undefined,
        customerAddress: selectedCustomer?.address || undefined,
        customerCity: selectedCustomer?.city || undefined,
        customerState: selectedCustomer?.state || undefined,
        customerZipcode: selectedCustomer?.zipcode || undefined,
        customerCountry: selectedCustomer?.country || undefined,
        customerPhone: selectedCustomer?.phone || undefined,
        customerCell: selectedCustomer?.cell || undefined,
        customerId: selectedCustomer?.id || undefined,
        // Shipping fields
        shipName: shipName || undefined,
        shipAddress: shipAddress || undefined,
        shipCity: shipCity || undefined,
        shipZipcode: shipZipcode || undefined,
        shipCountry: shipCountry || undefined,
        // Order overview
        orderReference: orderReference || undefined,
        orderStatus: orderStatus || undefined,
        // Pricing (as floats - server converts to cents)
        priceSaddle: parseFloat(priceSaddle) || 0,
        priceTradein: parseFloat(priceTradein) || 0,
        priceDeposit: parseFloat(priceDeposit) || 0,
        priceDiscount: parseFloat(priceDiscount) || 0,
        priceFittingeval: parseFloat(priceFittingeval) || 0,
        priceCallfee: parseFloat(priceCallfee) || 0,
        priceGirth: parseFloat(priceGirth) || 0,
        priceShipping: parseFloat(priceShipping) || 0,
        priceTax: parseFloat(priceTax) || 0,
        priceAdditional: parseFloat(priceAdditional) || 0,
        saddleOptions,
      };

      if (isDuplicate && draftOrderId) {
        await updateOrder(draftOrderId, payload);
        toast.success(`Order duplicated successfully! New order #${draftOrderId}`);
      } else if (isDuplicate) {
        const result = await createOrderFromPayload(payload);
        toast.success(`Order duplicated successfully! New order #${result.orderId}`);
      } else {
        await updateOrder(orderId, payload);
        toast.success(`Order #${orderId} updated successfully`);
      }
      onClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save order';
      logger.error('Error saving order:', error);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else if (onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  // Get display value for a saddle option
  const getOptionDisplayValue = (optionId: number): string => {
    const spec = orderDetail?.saddleSpecs.find(s => s.optionId === optionId);
    return spec?.displayValue || '';
  };

  const getOptionItemId = (optionId: number): string => {
    const spec = orderDetail?.saddleSpecs.find(s => s.optionId === optionId);
    return spec ? String(spec.optionItemId) : '';
  };

  const getOptionCustom = (optionId: number): string => {
    const spec = orderDetail?.saddleSpecs.find(s => s.optionId === optionId);
    return spec?.custom || '';
  };

  // Get available items for a given option
  const getItemsForOption = (optionId: number): Array<{ id: number; name: string }> => {
    if (!editOptions) return [];
    if (LEATHER_OPTION_IDS.includes(optionId)) {
      return editOptions.leatherTypes;
    }
    return editOptions.optionItems.filter(i => i.optionId === optionId);
  };

  // Check if an option has custom input (Tree Size or certain options with custom text)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const hasCustomInput = (optionId: number): boolean => {
    const spec = orderDetail?.saddleSpecs.find(s => s.optionId === optionId);
    return !!(spec?.custom);
  };

  // Sorted options by sequence
  const sortedOptions = editOptions?.options?.sort((a, b) => a.sequence - b.sequence) || [];

  // Currency display
  const currencyCode = orderDetail?.currency || 'USD';

  // Calculate total
  const total = (
    parseFloat(priceSaddle || '0') -
    parseFloat(priceTradein || '0') -
    parseFloat(priceDeposit || '0') -
    parseFloat(priceDiscount || '0') +
    parseFloat(priceFittingeval || '0') +
    parseFloat(priceCallfee || '0') +
    parseFloat(priceGirth || '0') +
    parseFloat(priceAdditional || '0') +
    parseFloat(priceShipping || '0') +
    parseFloat(priceTax || '0')
  ).toFixed(2);

  // Get saddle display name
  const saddleDisplay = orderDetail
    ? `${orderDetail.brandName || ''} ${orderDetail.modelName || ''}`.trim()
    : '';

  return (
    <DialogContent className="h-[90vh] p-0 flex flex-col" style={{ maxWidth: '95vw', width: '95vw' }}>
      <DialogHeader className="px-6 py-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-sm"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Back to Orders' : 'Back'}
          </Button>
          <DialogTitle className="text-lg">
            {isDuplicate ? `New Order #${draftOrderId || orderId} (from #${orderId})` : (order ? `Edit Order #${orderId}` : 'New Order')} | Step {currentStep}: {steps[currentStep - 1].title}
          </DialogTitle>
          <div className="w-32" />
        </div>
      </DialogHeader>

      {/* Persistent Status Bar - visible across all steps */}
      {order && (
        <div className="bg-white border-b px-6 py-2 flex items-center gap-4 flex-shrink-0">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <Select value={orderStatus} onValueChange={setOrderStatus}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Select status..." />
            </SelectTrigger>
            <SelectContent>
              {editOptions?.statuses?.map(s => (
                <SelectItem key={s.id} value={s.name}>
                  {s.name}
                </SelectItem>
              )) || (
                <SelectItem value={orderStatus}>{orderStatus}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Step Indicator */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-center">
                <button
                  className={`flex items-center ${
                    currentStep >= step.id ? 'text-[#8B0000]' : 'text-gray-400'
                  }`}
                  onClick={() => setCurrentStep(step.id)}
                >
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-2
                    ${currentStep >= step.id ? 'border-[#8B0000] bg-[#8B0000] text-white' : 'border-gray-300'}
                  `}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="ml-3 text-sm font-medium">{step.title}</span>
                </button>
                {index < steps.length - 1 && (
                  <ChevronRight className={`mx-6 ${
                    currentStep > step.id ? 'text-[#8B0000]' : 'text-gray-300'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading and Error States */}
      {(isLoading || loadingData) && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B0000] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading order data...</p>
          </div>
        </div>
      )}

      {(error || dataError) && !isLoading && !loadingData && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading order data</p>
            <p className="text-sm text-gray-600 mt-1">{error || dataError}</p>
            <Button onClick={loadData} size="sm" variant="outline" className="mt-3">
              Retry
            </Button>
          </div>
        </div>
      )}

      {!isLoading && !loadingData && !error && !dataError && orderDetail && (
        <div className="flex-1 overflow-auto p-6 w-full">
          {/* Step 1: Saddle Information */}
          {currentStep === 1 && (
            <div className="grid gap-6 min-w-0 w-full" style={{ gridTemplateColumns: '1fr 320px' }}>
              {/* Left Column - Saddle Specifications */}
              <div className="bg-white rounded-lg border p-4 min-w-0 overflow-hidden">
                <h3 className="font-semibold mb-4 text-lg">Saddle Specifications</h3>
                <div className="space-y-3">
                  {/* Fitter */}
                  <div className="grid grid-cols-[160px,1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">
                      Fitter: <span className="text-red-500">*</span>
                    </Label>
                    <Select value={fitterId} onValueChange={setFitterId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select fitter..." />
                      </SelectTrigger>
                      <SelectContent>
                        {editOptions?.fitters?.map(f => (
                          <SelectItem key={f.id} value={String(f.id)}>
                            {f.fullName || f.username}
                          </SelectItem>
                        )) || (
                          <SelectItem value={fitterId}>
                            {orderDetail.fitterName || 'Unknown'}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Flags */}
                  <div className="grid grid-cols-[160px,1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Stock:</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="stock" checked={isStock} onCheckedChange={(c) => setIsStock(!!c)} />
                      <label className="text-sm" htmlFor="stock">This saddle will be added to my own inventory.</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px,1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Demo:</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="demo" checked={isDemo} onCheckedChange={(c) => setIsDemo(!!c)} />
                      <label className="text-sm" htmlFor="demo">This saddle will be used for demo-purposes only.</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px,1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Repair:</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="repair" checked={isRepair} onCheckedChange={(c) => setIsRepair(!!c)} />
                      <label className="text-sm" htmlFor="repair">This saddle will be repaired. Please add your repair instructions to the special notes field.</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px,1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Urgent:</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="urgent" checked={isUrgent} onCheckedChange={(c) => setIsUrgent(!!c)} />
                      <label className="text-sm" htmlFor="urgent">- Give this order high priority -</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px,1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Sponsored:</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="sponsored" checked={isSponsored} onCheckedChange={(c) => setIsSponsored(!!c)} />
                      <label className="text-sm" htmlFor="sponsored"></label>
                    </div>
                  </div>

                  {/* Brand & Model */}
                  <div className="grid grid-cols-[160px,1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">
                      Brand & Model: <span className="text-red-500">*</span>
                    </Label>
                    <Select value={saddleId} onValueChange={async (val) => {
                      setSaddleId(val);
                      setOptionSelections({});
                      setOptionCustom({});
                      const newOptions = await fetchEditOptions(val);
                      if (newOptions) setEditOptions(newOptions);
                    }}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select model..." />
                      </SelectTrigger>
                      <SelectContent>
                        {editOptions?.saddles?.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.displayName}
                          </SelectItem>
                        )) || (
                          <SelectItem value={saddleId}>
                            {saddleDisplay}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preset */}
                  <div className="grid grid-cols-[160px,1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Preset:</Label>
                    <Select
                      defaultValue="none"
                      onValueChange={(val) => {
                        if (val === 'none' || !editOptions?.presetItems) return;
                        const presetId = parseInt(val, 10);
                        const items = editOptions.presetItems.filter(pi => pi.presetId === presetId);
                        if (items.length > 0) {
                          const newSelections: Record<number, string> = { ...optionSelections };
                          for (const item of items) {
                            newSelections[item.optionId] = String(item.itemId);
                          }
                          setOptionSelections(newSelections);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">- No preset selected -</SelectItem>
                        {editOptions?.presets?.map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Leathertype */}
                  <div className="grid grid-cols-[160px,1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">
                      Leathertype: <span className="text-red-500">*</span>
                    </Label>
                    <div className="space-y-1">
                      <Select value={leatherId} onValueChange={setLeatherId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select leather type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {editOptions?.leatherTypes?.map(lt => (
                            <SelectItem key={lt.id} value={String(lt.id)}>
                              {lt.name}
                            </SelectItem>
                          )) || (
                            <SelectItem value={leatherId}>
                              {orderDetail.leatherName || 'Unknown'}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <div className="text-sm font-medium text-gray-700">
                        Price: {priceSaddle}
                      </div>
                    </div>
                  </div>

                  {/* Dynamic saddle options from orders_info */}
                  {sortedOptions.map(opt => {
                    const currentItemId = getOptionItemId(opt.optionId);
                    const currentDisplay = getOptionDisplayValue(opt.optionId);
                    const currentCustom = getOptionCustom(opt.optionId);
                    const items = getItemsForOption(opt.optionId);

                    // Skip options that are not in the order's specs and have no items
                    if (!currentItemId && items.length === 0) return null;

                    return (
                      <div key={opt.optionId}>
                        <div className="grid grid-cols-[160px,1fr] gap-2 items-start">
                          <Label className="text-sm font-medium pt-2">
                            {opt.optionName}: <span className="text-red-500">*</span>
                          </Label>
                          <div className="space-y-1">
                            <Select
                              value={optionSelections[opt.optionId] || currentItemId}
                              onValueChange={(val) => setOptionSelections(prev => ({ ...prev, [opt.optionId]: val }))}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder={currentDisplay || 'Select...'} />
                              </SelectTrigger>
                              <SelectContent>
                                {items.length > 0 ? (
                                  items.map(item => (
                                    <SelectItem key={item.id} value={String(item.id)}>
                                      {item.name}
                                    </SelectItem>
                                  ))
                                ) : (
                                  currentItemId && (
                                    <SelectItem value={currentItemId}>
                                      {currentDisplay}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                            {/* Custom input field */}
                            {currentCustom && (
                              <div className="ml-4 p-2 bg-gray-50 rounded">
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs font-medium text-gray-600 whitespace-nowrap">Please specify:</Label>
                                  <span className="text-red-500">*</span>
                                  <Input
                                    className="h-8 text-sm flex-1"
                                    value={optionCustom[opt.optionId] || currentCustom}
                                    onChange={(e) => setOptionCustom(prev => ({ ...prev, [opt.optionId]: e.target.value }))}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Special Notes */}
                  <div className="border-t border-gray-200 mt-6 pt-4">
                    <Label className="text-sm font-medium">Special notes:</Label>
                    <textarea
                      className="w-full h-24 p-2 border rounded-md text-sm resize-none mt-2"
                      value={specialNotes}
                      onChange={(e) => setSpecialNotes(e.target.value)}
                      placeholder="Enter any special notes or instructions..."
                    />
                  </div>
                </div>
              </div>

              {/* Right Column - Pricing */}
              <div className="bg-white rounded-lg border p-4 min-w-0 overflow-hidden self-start">
                <h3 className="font-semibold mb-3 text-base">Pricing</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Saddle price:</Label>
                    <Input className="h-8 text-right text-sm w-24" type="number" step="0.01"
                      value={priceSaddle} onChange={(e) => setPriceSaddle(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Trade in: <span className="text-red-500">*</span></Label>
                    <div className="flex items-center gap-1">
                      <Input className="h-8 text-right text-sm w-20" type="number" step="0.01"
                        value={priceTradein} onChange={(e) => setPriceTradein(e.target.value)} />
                      <span className="text-sm text-gray-500">-</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Deposit: <span className="text-red-500">*</span></Label>
                    <div className="flex items-center gap-1">
                      <Input className="h-8 text-right text-sm w-20" type="number" step="0.01"
                        value={priceDeposit} onChange={(e) => setPriceDeposit(e.target.value)} />
                      <span className="text-sm text-gray-500">-</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Discount: <span className="text-red-500">*</span></Label>
                    <div className="flex items-center gap-1">
                      <Input className="h-8 text-right text-sm w-20" type="number" step="0.01"
                        value={priceDiscount} onChange={(e) => setPriceDiscount(e.target.value)} />
                      <span className="text-sm text-gray-500">-</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Fitting/Eval: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-20" type="number" step="0.01"
                      value={priceFittingeval} onChange={(e) => setPriceFittingeval(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Call fee: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-20" type="number" step="0.01"
                      value={priceCallfee} onChange={(e) => setPriceCallfee(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Girth: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-20" type="number" step="0.01"
                      value={priceGirth} onChange={(e) => setPriceGirth(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Additional costs: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-20" type="number" step="0.01"
                      value={priceAdditional} onChange={(e) => setPriceAdditional(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Shipping: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-16" type="text" placeholder="-"
                      value={priceShipping} onChange={(e) => setPriceShipping(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Tax: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-16" type="text" placeholder="-"
                      value={priceTax} onChange={(e) => setPriceTax(e.target.value)} />
                  </div>

                  <div className="text-xs text-gray-600 mt-1 mb-1">
                    Shipping and Taxes will be determined by Custom Saddlery.
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm font-semibold whitespace-nowrap">Total ({currencyCode}):</Label>
                      <Input className="h-8 text-right font-semibold text-sm w-24"
                        type="number" readOnly value={total} />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Your deposit is non-refundable if your order is canceled.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Customer & Shipping */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Selection */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Select Customer</h3>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Type customer name or email..."
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {customerSearchLoading && (
                    <p className="text-sm text-gray-500">Searching...</p>
                  )}
                  {customerSearchResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border rounded-md">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {customerSearchResults.map((c: any) => (
                        <button
                          key={c.id}
                          className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearchTerm(c.name || c.customerName || '');
                            setCustomerSearchResults([]);
                          }}
                        >
                          <div className="font-medium">{c.name || c.customerName}</div>
                          {(c.email || c.customerEmail) && (
                            <div className="text-sm text-gray-600">{c.email || c.customerEmail}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Customer information edit */}
                  {selectedCustomer && (
                    <div className="border-t pt-4 mt-4">
                      <h4 className="text-sm font-semibold text-[#8B0000] mb-3">Customer information</h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-[100px,1fr] gap-2 items-center">
                          <Label className="text-sm font-medium">Name:</Label>
                          <Input
                            value={selectedCustomer.name || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, name: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[100px,1fr] gap-2 items-center">
                          <Label className="text-sm font-medium">Address:</Label>
                          <Input
                            value={selectedCustomer.address || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, address: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[100px,1fr] gap-2 items-center">
                          <Label className="text-sm font-medium">City:</Label>
                          <Input
                            value={selectedCustomer.city || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, city: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[100px,1fr] gap-2 items-center">
                          <Label className="text-sm font-medium">State:</Label>
                          <Input
                            value={selectedCustomer.state || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, state: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[100px,1fr] gap-2 items-center">
                          <Label className="text-sm font-medium">Zipcode:</Label>
                          <Input
                            value={selectedCustomer.zipcode || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, zipcode: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[100px,1fr] gap-2 items-center">
                          <Label className="text-sm font-medium">Country:</Label>
                          <Input
                            value={selectedCustomer.country || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, country: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[100px,1fr] gap-2 items-center">
                          <Label className="text-sm font-medium">Email:</Label>
                          <Input
                            type="email"
                            value={selectedCustomer.email || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[100px,1fr] gap-2 items-center">
                          <Label className="text-sm font-medium">Phone:</Label>
                          <Input
                            value={selectedCustomer.phone || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[100px,1fr] gap-2 items-center">
                          <Label className="text-sm font-medium">Cell:</Label>
                          <Input
                            value={selectedCustomer.cell || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, cell: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-6">
                {/* Your order reference */}
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-semibold mb-4 text-lg">Your order reference</h3>
                  <div className="grid grid-cols-[100px,1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Your reference:</Label>
                    <Input
                      value={orderReference}
                      onChange={(e) => setOrderReference(e.target.value)}
                    />
                  </div>
                </div>

                {/* Shipping address */}
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-semibold mb-2 text-lg">Shipping address</h3>
                  <p className="text-sm text-gray-500 mb-4">(if different than under &quot;customer information or Inventory&quot;)</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-[80px,1fr] gap-2 items-center">
                      <Label className="text-sm font-medium">Name:</Label>
                      <Input value={shipName} onChange={(e) => setShipName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-[80px,1fr] gap-2 items-center">
                      <Label className="text-sm font-medium">Address:</Label>
                      <Input value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-[80px,1fr] gap-2 items-center">
                      <Label className="text-sm font-medium">City:</Label>
                      <Input value={shipCity} onChange={(e) => setShipCity(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-[80px,1fr] gap-2 items-center">
                      <Label className="text-sm font-medium">Country:</Label>
                      <Input value={shipCountry} onChange={(e) => setShipCountry(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-[80px,1fr] gap-2 items-center">
                      <Label className="text-sm font-medium">Zipcode:</Label>
                      <Input value={shipZipcode} onChange={(e) => setShipZipcode(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Order overview */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Order Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Reference</Label>
                    <Input
                      value={orderReference}
                      onChange={(e) => setOrderReference(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Requested Delivery Date</Label>
                    <Input
                      type="date"
                      value={requestedDeliveryDate}
                      onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Flags</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox checked={isUrgent} onCheckedChange={(c) => setIsUrgent(!!c)} />
                    <Label>Urgent</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox checked={isStock} onCheckedChange={(c) => setIsStock(!!c)} />
                    <Label>Stock</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox checked={isDemo} onCheckedChange={(c) => setIsDemo(!!c)} />
                    <Label>Demo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox checked={isSponsored} onCheckedChange={(c) => setIsSponsored(!!c)} />
                    <Label>Sponsored</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox checked={isRepair} onCheckedChange={(c) => setIsRepair(!!c)} />
                    <Label>Repair</Label>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Special Notes</h3>
                <div>
                  <Textarea
                    placeholder="Add any special instructions for the order..."
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Actions */}
      <div className="border-t p-4 bg-gray-50 flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={saving}>
          {currentStep === 1 ? 'Cancel' : 'Previous Step'}
        </Button>
        <div className="space-x-2">
          <Button variant="outline" disabled={saving}>
            Save as Draft
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[#8B0000] hover:bg-[#6B0000] text-white"
          >
            {saving ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </div>
            ) : (
              currentStep === 3
                ? (isDuplicate ? 'Duplicate Order' : (order ? 'Update Order' : 'Create Order'))
                : 'Next Step'
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
