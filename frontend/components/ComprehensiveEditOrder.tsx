// TODO(FE-040): Introduce a Zod schema for the comprehensive order edit payload and
// remove all `any` casts in this file.  Suggested approach:
//   1. Define `comprehensiveOrderSchema = z.object({ ... })` mirroring UpdateOrderPayload.
//   2. Derive the form type with `z.infer<typeof comprehensiveOrderSchema>`.
//   3. Replace manual useState fields with `useForm<ComprehensiveOrderForm>({ resolver: zodResolver(...) })`.
//   4. Replace `Record<string, any>` and untyped API responses with strict types.
// This is a large refactor — do not attempt incrementally without full test coverage.
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
import { ArrowLeft, ChevronRight, Search, User, Package, Settings, ClipboardList } from 'lucide-react';
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
  { id: 4, title: 'Preview & Submit', icon: ClipboardList },
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
  // The status this form loaded with. Sent back as `expectedStatus` so the server
  // can reject the save if someone else moved the order on in the meantime.
  const [loadedStatus, setLoadedStatus] = useState('');
  const [statusChanging, setStatusChanging] = useState(false);
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');

  const orderId = order?.orderId || Number(order?.id) || 0;

  // Fetch edit options filtered by saddleId.
  // includeDiscontinued=true so repair orders can reference legacy/discontinued
  // saddle models that the standard "active" filter would hide.
  const fetchEditOptions = useCallback(async (forSaddleId?: string): Promise<EditFormOptions | null> => {
    const params = new URLSearchParams({ includeDiscontinued: 'true' });
    if (forSaddleId) params.set('saddleId', forSaddleId);
    const url = `${API_URL}/api/v1/enriched_orders/edit-options?${params.toString()}`;
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
      // Legacy DB stores "-1" as a sentinel for an unset country; treat it as empty.
      setShipCountry(detail.shipCountry && detail.shipCountry !== '-1' ? detail.shipCountry : '');

      // Order overview
      setOrderReference(isDuplicate ? '' : (detail.fitterReference || ''));
      setOrderStatus(isDuplicate ? 'Unordered' : (detail.orderStatus || ''));
      setLoadedStatus(isDuplicate ? 'Unordered' : (detail.orderStatus || ''));
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
      // TODO(react-hooks): loadData() is async — all setState calls happen after await, not synchronously in the effect body.
      loadData(); // eslint-disable-line react-hooks/set-state-in-effect -- async; setState runs after await
    }
  }, [orderId, loadData]);

  // Customer search — debounced with 300 ms.
  // FE-043: abort the in-flight fetch on each keystroke to avoid stale result races.
  // The synchronous setCustomerSearchResults([]) on the early-return path is a stale-results
  // cleanup; suppressed because refactoring into the timer callback would delay clearing by 300 ms.
  useEffect(() => {
    if (customerSearchTerm.length < 2) {
      // TODO(react-hooks): synchronous setState clears stale results immediately when term < 2 chars.
      setCustomerSearchResults([]); // eslint-disable-line react-hooks/set-state-in-effect -- immediate cleanup when search term is too short
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCustomerSearchLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/customers?search=${encodeURIComponent(customerSearchTerm)}&limit=10`, {
          headers: { 'Accept': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setCustomerSearchResults(data['hydra:member'] || []);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
      setCustomerSearchLoading(false);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [customerSearchTerm]);

  // Fitter search — debounced with 300 ms. Same rationale as customer search above.
  // FE-043: abort the in-flight fetch on each keystroke to avoid stale result races.
  useEffect(() => {
    if (fitterSearchTerm.length < 2) {
      // TODO(react-hooks): synchronous setState clears stale results immediately when term < 2 chars.
      setFitterSearchResults([]); // eslint-disable-line react-hooks/set-state-in-effect -- immediate cleanup when search term is too short
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setFitterSearchLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/fitters?search=${encodeURIComponent(fitterSearchTerm)}&limit=10`, {
          headers: { 'Accept': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setFitterSearchResults(data['hydra:member'] || []);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
      setFitterSearchLoading(false);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fitterSearchTerm]);

  const handleSubmit = async () => {
    if (currentStep < 4) {
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

      // Only submit order_status when the user actually touched the status control.
      // The form snapshots the status when it opens, so resubmitting it on every save
      // used to silently revert a status another user had changed in the meantime.
      const isDraftUpdate = isDuplicate && !!draftOrderId;
      const statusDirty = orderStatus !== loadedStatus;
      // A brand-new duplicate needs its status; a draft already exists as Unordered.
      const submitStatus = isDuplicate ? !isDraftUpdate : statusDirty;

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
        orderStatus: submitStatus ? orderStatus || undefined : undefined,
        expectedStatus:
          !isDuplicate && statusDirty ? loadedStatus || undefined : undefined,
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
      logger.error('Error saving order:', error);
      // Match on name rather than instanceof: the error can cross module boundaries
      // (bundling, test mocks) where the class identity no longer matches.
      if (error instanceof Error && error.name === 'OrderStatusConflictError') {
        // Someone else moved this order on while the form was open. Don't clobber
        // their change — tell the user to reload and reapply.
        toast.error(
          `Order status was changed by someone else while you were editing. ` +
            `Your changes were not saved. Reload the order and try again.`,
        );
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to save order');
      }
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

  // Handle order status change
  const handleChangeOrderStatus = async () => {
    if (!orderStatus || !orderId) return;
    setStatusChanging(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/enriched_orders/update-status/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: orderStatus }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Failed to update status (${response.status}): ${body || response.statusText}`);
      }
      // The dedicated endpoint already persisted this, so a later save must not
      // treat it as a pending change.
      setLoadedStatus(orderStatus);
      toast.success(`Order status changed to "${orderStatus}"`);
    } catch (err) {
      logger.error('Failed to change order status:', err);
      toast.error(`Failed to change order status: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setStatusChanging(false);
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


      {/* Step Indicator */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
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
                    w-8 h-8 rounded-full flex items-center justify-center border-2
                    ${currentStep >= step.id ? 'border-[#8B0000] bg-[#8B0000] text-white' : 'border-gray-300'}
                  `}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="ml-2 text-xs font-medium hidden sm:inline">{step.title}</span>
                </button>
                {index < steps.length - 1 && (
                  <ChevronRight className={`mx-3 h-4 w-4 ${
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
                  <div className="grid grid-cols-[160px_1fr] gap-2 items-center">
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
                          fitterId && <SelectItem value={fitterId}>
                            {orderDetail.fitterName || 'Unknown'}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Flags */}
                  <div className="grid grid-cols-[160px_1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Stock:</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="stock" checked={isStock} onCheckedChange={(c) => setIsStock(!!c)} />
                      <label className="text-sm" htmlFor="stock">This saddle will be added to my own inventory.</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px_1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Demo:</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="demo" checked={isDemo} onCheckedChange={(c) => setIsDemo(!!c)} />
                      <label className="text-sm" htmlFor="demo">This saddle will be used for demo-purposes only.</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px_1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Repair:</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="repair" checked={isRepair} onCheckedChange={(c) => setIsRepair(!!c)} />
                      <label className="text-sm" htmlFor="repair">This saddle will be repaired. Please add your repair instructions to the special notes field.</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px_1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Urgent:</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="urgent" checked={isUrgent} onCheckedChange={(c) => setIsUrgent(!!c)} />
                      <label className="text-sm" htmlFor="urgent">- Give this order high priority -</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px_1fr] gap-2 items-center">
                    <Label className="text-sm font-medium">Sponsored:</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="sponsored" checked={isSponsored} onCheckedChange={(c) => setIsSponsored(!!c)} />
                      <label className="text-sm" htmlFor="sponsored"></label>
                    </div>
                  </div>

                  {/* Brand & Model */}
                  <div className="grid grid-cols-[160px_1fr] gap-2 items-center">
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
                          saddleId && <SelectItem value={saddleId}>
                            {saddleDisplay}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preset */}
                  <div className="grid grid-cols-[160px_1fr] gap-2 items-center">
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
                  <div className="grid grid-cols-[160px_1fr] gap-2 items-center">
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
                            leatherId && <SelectItem value={leatherId}>
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
                        <div className="grid grid-cols-[160px_1fr] gap-2 items-start">
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

              {/* Right Column - Order Status & Pricing */}
              <div className="space-y-6 self-start">
                {/* Order Status */}
                {order && (
                  <div className="bg-white rounded-lg border p-4">
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
                )}

                {/* Pricing */}
                <div className="bg-white rounded-lg border p-4 min-w-0 overflow-hidden">
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
                    <div className="border-t pt-3 mt-3">
                      <h4 className="text-sm font-semibold text-[#8B0000] mb-2">Customer information</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div className="grid grid-cols-[70px_1fr] gap-1 items-center">
                          <Label className="text-xs font-medium">Name:</Label>
                          <Input className="h-7 text-sm"
                            value={selectedCustomer.name || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, name: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[70px_1fr] gap-1 items-center">
                          <Label className="text-xs font-medium">Email:</Label>
                          <Input className="h-7 text-sm" type="email"
                            value={selectedCustomer.email || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[70px_1fr] gap-1 items-center">
                          <Label className="text-xs font-medium">Address:</Label>
                          <Input className="h-7 text-sm"
                            value={selectedCustomer.address || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, address: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[70px_1fr] gap-1 items-center">
                          <Label className="text-xs font-medium">Phone:</Label>
                          <Input className="h-7 text-sm"
                            value={selectedCustomer.phone || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[70px_1fr] gap-1 items-center">
                          <Label className="text-xs font-medium">City:</Label>
                          <Input className="h-7 text-sm"
                            value={selectedCustomer.city || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, city: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[70px_1fr] gap-1 items-center">
                          <Label className="text-xs font-medium">Cell:</Label>
                          <Input className="h-7 text-sm"
                            value={selectedCustomer.cell || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, cell: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[70px_1fr] gap-1 items-center">
                          <Label className="text-xs font-medium">State:</Label>
                          <Input className="h-7 text-sm"
                            value={selectedCustomer.state || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, state: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-[70px_1fr] gap-1 items-center">
                          <Label className="text-xs font-medium">Zipcode:</Label>
                          <Input className="h-7 text-sm"
                            value={selectedCustomer.zipcode || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, zipcode: e.target.value })}
                          />
                        </div>
                        <div className="col-span-2 grid grid-cols-[70px_1fr] gap-1 items-center">
                          <Label className="text-xs font-medium">Country:</Label>
                          <Input className="h-7 text-sm"
                            value={selectedCustomer.country || ''}
                            onChange={(e) => setSelectedCustomer({ ...selectedCustomer, country: e.target.value })}
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
                  <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
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
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <Label className="text-sm font-medium">Name:</Label>
                      <Input value={shipName} onChange={(e) => setShipName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <Label className="text-sm font-medium">Address:</Label>
                      <Input value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <Label className="text-sm font-medium">City:</Label>
                      <Input value={shipCity} onChange={(e) => setShipCity(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <Label className="text-sm font-medium">Country:</Label>
                      <Input value={shipCountry} onChange={(e) => setShipCountry(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
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

          {/* Step 4: Preview & Submit */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Saddle summary */}
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3 text-base text-[#8B0000]">Saddle Information</h3>
                  <dl className="space-y-1.5 text-sm">
                    <div className="grid grid-cols-[130px_1fr]">
                      <dt className="text-gray-500">Brand & Model:</dt>
                      <dd className="font-medium">{saddleDisplay || '—'}</dd>
                    </div>
                    <div className="grid grid-cols-[130px_1fr]">
                      <dt className="text-gray-500">Fitter:</dt>
                      <dd className="font-medium">{editOptions?.fitters?.find(f => String(f.id) === fitterId)?.fullName || orderDetail?.fitterName || '—'}</dd>
                    </div>
                    {sortedOptions.map(opt => {
                      const sel = optionSelections[opt.optionId];
                      const display = sel
                        ? getItemsForOption(opt.optionId).find(i => String(i.id) === sel)?.name || getOptionDisplayValue(opt.optionId)
                        : getOptionDisplayValue(opt.optionId);
                      if (!display) return null;
                      return (
                        <div key={opt.optionId} className="grid grid-cols-[130px_1fr]">
                          <dt className="text-gray-500">{opt.optionName}:</dt>
                          <dd className="font-medium">{display}</dd>
                        </div>
                      );
                    })}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {isStock && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Stock</span>}
                      {isDemo && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Demo</span>}
                      {isRepair && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Repair</span>}
                      {isUrgent && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Urgent</span>}
                      {isSponsored && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Sponsored</span>}
                    </div>
                    {specialNotes && (
                      <div className="pt-1">
                        <dt className="text-gray-500 text-xs">Special notes:</dt>
                        <dd className="text-sm mt-0.5 bg-gray-50 rounded p-1.5">{specialNotes}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Pricing summary */}
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3 text-base text-[#8B0000]">Pricing ({currencyCode})</h3>
                  <dl className="space-y-1.5 text-sm">
                    <div className="grid grid-cols-[140px_1fr]">
                      <dt className="text-gray-500">Saddle price:</dt>
                      <dd className="font-medium text-right">{priceSaddle}</dd>
                    </div>
                    {parseFloat(priceTradein) !== 0 && <div className="grid grid-cols-[140px_1fr]">
                      <dt className="text-gray-500">Trade in:</dt>
                      <dd className="font-medium text-right">-{priceTradein}</dd>
                    </div>}
                    {parseFloat(priceDeposit) !== 0 && <div className="grid grid-cols-[140px_1fr]">
                      <dt className="text-gray-500">Deposit:</dt>
                      <dd className="font-medium text-right">-{priceDeposit}</dd>
                    </div>}
                    {parseFloat(priceDiscount) !== 0 && <div className="grid grid-cols-[140px_1fr]">
                      <dt className="text-gray-500">Discount:</dt>
                      <dd className="font-medium text-right">-{priceDiscount}</dd>
                    </div>}
                    {parseFloat(priceFittingeval) !== 0 && <div className="grid grid-cols-[140px_1fr]">
                      <dt className="text-gray-500">Fitting/Eval:</dt>
                      <dd className="font-medium text-right">{priceFittingeval}</dd>
                    </div>}
                    {parseFloat(priceCallfee) !== 0 && <div className="grid grid-cols-[140px_1fr]">
                      <dt className="text-gray-500">Call fee:</dt>
                      <dd className="font-medium text-right">{priceCallfee}</dd>
                    </div>}
                    {parseFloat(priceGirth) !== 0 && <div className="grid grid-cols-[140px_1fr]">
                      <dt className="text-gray-500">Girth:</dt>
                      <dd className="font-medium text-right">{priceGirth}</dd>
                    </div>}
                    {parseFloat(priceAdditional) !== 0 && <div className="grid grid-cols-[140px_1fr]">
                      <dt className="text-gray-500">Additional:</dt>
                      <dd className="font-medium text-right">{priceAdditional}</dd>
                    </div>}
                    {priceShipping && <div className="grid grid-cols-[140px_1fr]">
                      <dt className="text-gray-500">Shipping:</dt>
                      <dd className="font-medium text-right">{priceShipping}</dd>
                    </div>}
                    {priceTax && <div className="grid grid-cols-[140px_1fr]">
                      <dt className="text-gray-500">Tax:</dt>
                      <dd className="font-medium text-right">{priceTax}</dd>
                    </div>}
                    <div className="grid grid-cols-[140px_1fr] border-t pt-1.5 font-semibold">
                      <dt>Total:</dt>
                      <dd className="text-right">{total}</dd>
                    </div>
                  </dl>
                </div>

                {/* Customer summary */}
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3 text-base text-[#8B0000]">Customer Information</h3>
                  {selectedCustomer ? (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      {selectedCustomer.name && <div className="grid grid-cols-[70px_1fr]">
                        <dt className="text-gray-500">Name:</dt><dd className="font-medium truncate">{selectedCustomer.name}</dd>
                      </div>}
                      {selectedCustomer.email && <div className="grid grid-cols-[70px_1fr]">
                        <dt className="text-gray-500">Email:</dt><dd className="font-medium truncate">{selectedCustomer.email}</dd>
                      </div>}
                      {selectedCustomer.address && <div className="grid grid-cols-[70px_1fr]">
                        <dt className="text-gray-500">Address:</dt><dd className="font-medium truncate">{selectedCustomer.address}</dd>
                      </div>}
                      {selectedCustomer.phone && <div className="grid grid-cols-[70px_1fr]">
                        <dt className="text-gray-500">Phone:</dt><dd className="font-medium truncate">{selectedCustomer.phone}</dd>
                      </div>}
                      {selectedCustomer.city && <div className="grid grid-cols-[70px_1fr]">
                        <dt className="text-gray-500">City:</dt><dd className="font-medium truncate">{selectedCustomer.city}</dd>
                      </div>}
                      {selectedCustomer.state && <div className="grid grid-cols-[70px_1fr]">
                        <dt className="text-gray-500">State:</dt><dd className="font-medium truncate">{selectedCustomer.state}</dd>
                      </div>}
                      {selectedCustomer.country && <div className="grid grid-cols-[70px_1fr]">
                        <dt className="text-gray-500">Country:</dt><dd className="font-medium truncate">{selectedCustomer.country}</dd>
                      </div>}
                    </dl>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No customer selected</p>
                  )}
                  {orderReference && (
                    <div className="mt-2 pt-2 border-t text-sm grid grid-cols-[130px_1fr]">
                      <span className="text-gray-500">Your reference:</span>
                      <span className="font-medium">{orderReference}</span>
                    </div>
                  )}
                </div>

                {/* Shipping & Order details summary */}
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold mb-3 text-base text-[#8B0000]">Shipping & Order Details</h3>
                  <dl className="space-y-1.5 text-sm">
                    {(shipName || shipAddress || shipCity || shipCountry) && (
                      <>
                        <dt className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Shipping address</dt>
                        {shipName && <div className="grid grid-cols-[80px_1fr]">
                          <dt className="text-gray-500">Name:</dt><dd className="font-medium">{shipName}</dd>
                        </div>}
                        {shipAddress && <div className="grid grid-cols-[80px_1fr]">
                          <dt className="text-gray-500">Address:</dt><dd className="font-medium">{shipAddress}</dd>
                        </div>}
                        {shipCity && <div className="grid grid-cols-[80px_1fr]">
                          <dt className="text-gray-500">City:</dt><dd className="font-medium">{shipCity}</dd>
                        </div>}
                        {shipCountry && <div className="grid grid-cols-[80px_1fr]">
                          <dt className="text-gray-500">Country:</dt><dd className="font-medium">{shipCountry}</dd>
                        </div>}
                        {shipZipcode && <div className="grid grid-cols-[80px_1fr]">
                          <dt className="text-gray-500">Zipcode:</dt><dd className="font-medium">{shipZipcode}</dd>
                        </div>}
                      </>
                    )}
                    {requestedDeliveryDate && (
                      <div className="grid grid-cols-[130px_1fr] mt-2 pt-2 border-t">
                        <dt className="text-gray-500">Delivery date:</dt>
                        <dd className="font-medium">{requestedDeliveryDate}</dd>
                      </div>
                    )}
                    {orderStatus && (
                      <div className="grid grid-cols-[130px_1fr]">
                        <dt className="text-gray-500">Order status:</dt>
                        <dd className="font-medium">{orderStatus}</dd>
                      </div>
                    )}
                  </dl>
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
              currentStep === 4
                ? (isDuplicate ? 'Duplicate Order' : (order ? 'Update Order' : 'Create Order'))
                : 'Next Step'
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
