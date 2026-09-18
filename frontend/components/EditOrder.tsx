// TODO(FE-040): Introduce a Zod schema for the order edit payload and remove all `any`
// casts in this file.  Suggested approach:
//   1. Define `editOrderSchema = z.object({ ... })` mirroring UpdateOrderPayload.
//   2. Derive the form type with `z.infer<typeof editOrderSchema>`.
//   3. Replace manual state fields with `useForm<EditOrderForm>({ resolver: zodResolver(editOrderSchema) })`.
//   4. Replace `Record<string, any>` with the derived type throughout.
// This is a large refactor — do not attempt incrementally without full test coverage.
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
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
import { ArrowLeft, ChevronRight, Search, User, Package, Settings, Plus } from 'lucide-react';
import { fetchOrderEditData, searchCustomers, saveOrderEditData } from '@/services/orderEditView';
import { createOrderFromPayload, UpdateOrderPayload } from '@/services/enrichedOrders';
import { API_URL } from '@/services/api-config';
import { createCustomer as createCustomerRecord } from '@/services/customers';
import {
  ComprehensiveOrderData,
  OrderEditFormState,
  Customer,
  OrderLine
} from '@/types/ComprehensiveOrder';
import { logger } from '@/utils/logger';
import { slotKey, slotOptionId, slotLabel } from '@/utils/optionSlots';
import { OptionSlotRow } from '@/components/shared/OptionSlotRow';
import { specInputsForItem, type SpecInputs } from '@/utils/optionSpecs';
import { presetSelections } from '@/utils/presetApply';
import type { EditFormOptions } from '@/services/enrichedOrders';
import { saddlePriceFor, orderTotal, currencyCodeFor, formatMoney } from '@/utils/orderPricing';
import { ShippingCountrySelect } from '@/components/shared/ShippingCountrySelect';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DuplicateData = Record<string, any>;

interface EditOrderProps {
  order?: {
    id: string;
    orderId: number;
  };
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  onBack?: () => void;
  isDuplicate?: boolean;
  duplicateData?: DuplicateData;
}

const steps = [
  { id: 1, title: 'Products & Pricing', icon: Package },
  { id: 2, title: 'Customer & Shipping', icon: User },
  { id: 3, title: 'Order Settings', icon: Settings },
];

export function EditOrder({ order, isLoading = false, error, onClose, onBack, isDuplicate = false, duplicateData }: EditOrderProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [comprehensiveData, setComprehensiveData] = useState<ComprehensiveOrderData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<OrderEditFormState>({
    orderLines: [],
    pricing: {
      subtotal: 0,
      discount: 0,
      tax: 0,
      shipping: 0,
      total: 0,
      currency: 'USD'
    },
    status: 'Unordered',
    isUrgent: false,
    isStock: false,
    isDemo: false,
    isSponsored: false,
    isRepair: false
  });

  // Customer search state
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);

  // Shipping name (legacy: separate from the customer's own name)
  const [shipName, setShipName] = useState('');

  // Edit options from backend (fitters, saddles, presets, etc.)
  const [editOptions, setEditOptions] = useState<EditFormOptions | null>(null);
  const [selectedSaddleId, setSelectedSaddleId] = useState<string>('');
  const [selectedFitterId, setSelectedFitterId] = useState<string>('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('none');
  const [selectedLeatherId, setSelectedLeatherId] = useState<string>('');

  // Step-1 pricing panel. Legacy fills Saddle price from saddle_leathers when
  // the Leathertype is chosen; the rest are manual entries with a red asterisk.
  const [prices, setPrices] = useState({
    saddle: '0.00', tradein: '0.00', deposit: '0.00', discount: '0.00',
    fittingeval: '0.00', callfee: '0.00', girth: '0.00', additional: '0.00',
  });
  const setPrice = (key: keyof typeof prices, value: string) => setPrices(prev => ({ ...prev, [key]: value }));

  // Saddle option selections, keyed by slot ("optionId:cloneNumber", see utils/optionSlots)
  const [optionSelections, setOptionSelections] = useState<Record<string, string>>({});
  const [optionCustom, setOptionCustom] = useState<Record<string, string>>({});
  const [optionColor, setOptionColor] = useState<Record<string, string>>({});
  const [optionLeather, setOptionLeather] = useState<Record<string, string>>({});
  // Extra rows open per option, e.g. { 4: [1] } for "CANTLE Option (2)"
  const [optionClones, setOptionClones] = useState<Record<number, number[]>>({});

  // Every open row of an option: the base row plus any extra ("clone") rows
  const getSlots = (optionId: number): number[] => [0, ...(optionClones[optionId] ?? [])];

  const addClone = (optionId: number) => {
    setOptionClones(prev => {
      const existing = prev[optionId] ?? [];
      const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
      return { ...prev, [optionId]: [...existing, next] };
    });
  };

  const removeClone = (optionId: number, clone: number) => {
    const key = slotKey(optionId, clone);
    const without = (m: Record<string, string>) =>
      Object.fromEntries(Object.entries(m).filter(([k]) => k !== key));
    setOptionClones(prev => ({ ...prev, [optionId]: (prev[optionId] ?? []).filter(c => c !== clone) }));
    setOptionSelections(without);
    setOptionCustom(without);
    setOptionColor(without);
    setOptionLeather(without);
  };
  const [selectedExtras, setSelectedExtras] = useState<Record<number, boolean>>({});

  // New customer form state
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerSaving, setNewCustomerSaving] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', address: '', city: '', state: '', zipcode: '', country: '' });

  // Fetch edit options from backend.
  // Active models only, like the legacy new-order form; repairs have their own flow.
  const fetchEditOptions = useCallback(async (forSaddleId?: string): Promise<EditFormOptions | null> => {
    const params = new URLSearchParams();
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

  // Fetch edit options on mount
  useEffect(() => {
    fetchEditOptions().then(opts => {
      if (!opts) return;
      setEditOptions(opts);
      // A fitter's order is always their own: the backend names them in
      // currentFitterId, so pre-fill the (locked) Fitter LOV like legacy does.
      const own = opts.currentFitterId;
      const fitter = own ? opts.fitters.find(f => f.id === own) : undefined;
      if (!own) return;
      setSelectedFitterId(prev => prev || String(own));
      if (fitter) {
        setFormData(prev => prev.fitter ? prev : { ...prev, fitter: { id: fitter.id, name: fitter.fullName || fitter.username } });
      }
    });
  }, [fetchEditOptions]);

  const lockedFitterId = editOptions?.currentFitterId;

  const loadOrderData = useCallback(async () => {
    if (!order?.id) return;
    
    setLoadingData(true);
    setDataError(null);
    
    try {
      logger.log('Loading comprehensive order data for:', order.id);
      
      // Try to fetch comprehensive data, but fallback gracefully
      let data;
      try {
        const orderEditData = await fetchOrderEditData(Number(order.id));

        // Transform to match the expected structure
        data = {
          order: {
            id: orderEditData.id,
            orderId: Number(orderEditData.id),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status: orderEditData.orderStatus as any,
            customer: {
              id: orderEditData.customerId,
              name: orderEditData.customerName,
              email: orderEditData.customerEmail
            },
            fitter: {
              id: orderEditData.fitterId,
              name: orderEditData.fitterName
            },
            pricing: {
              subtotal: orderEditData.price,
              discount: orderEditData.discount,
              tax: orderEditData.tax,
              shipping: orderEditData.shipping,
              total: orderEditData.total,
              currency: orderEditData.currency
            },
            isUrgent: orderEditData.urgent,
            isStock: orderEditData.isStock,
            isDemo: orderEditData.isDemo,
            isSponsored: orderEditData.isSponsored,
            isRepair: orderEditData.isRepair,
            notes: orderEditData.notes,
            reference: orderEditData.reference
          },
          orderLines: orderEditData.orderLines,
          comments: orderEditData.comments,
          options: [],
          productSaddleExtras: [],
          productSaddleItems: [],
          modelItems: [],
          modelLeatherPrices: [],
          fitters: [],
          models: [],
          presets: [],
          customers: [],
          suppliers: [],
          leatherTypes: [],
          productSaddles: []
        };
      } catch (fetchError) {
        logger.warn('Failed to fetch comprehensive data, using order summary:', fetchError);
        // Create minimal data structure from the order object
        data = {
          order: {
            id: order.id,
            orderId: order.orderId,
            status: 'Unordered',
            pricing: {
              subtotal: 0,
              discount: 0,
              tax: 0,
              shipping: 0,
              total: 0,
              currency: 'USD'
            },
            isUrgent: false,
            isStock: false,
            isDemo: false,
            isSponsored: false,
            isRepair: false
          },
          orderLines: [],
          comments: [],
          options: [],
          productSaddleExtras: [],
          productSaddleItems: [],
          modelItems: [],
          modelLeatherPrices: [],
          fitters: [],
          models: [],
          presets: [],
          customers: [],
          suppliers: [],
          leatherTypes: [],
          productSaddles: []
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setComprehensiveData(data as any);
      
      // Initialize form data from comprehensive order data
      setFormData({
        orderLines: (data.orderLines || []) as OrderLine[],
        pricing: data.order.pricing || {
          subtotal: 0,
          discount: 0,
          tax: 0,
          shipping: 0,
          total: 0,
          currency: 'USD'
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customer: (data.order as any).customer,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customerAddress: (data.order as any).customerAddress,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fitter: (data.order as any).fitter,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shippingAddress: (data.order as any).shippingAddress,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reference: (data.order as any).reference,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: (data.order as any).status || 'Unordered',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isUrgent: (data.order as any).isUrgent || false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isStock: (data.order as any).isStock || false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isDemo: (data.order as any).isDemo || false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isSponsored: (data.order as any).isSponsored || false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isRepair: (data.order as any).isRepair || false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        notes: (data.order as any).notes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        internalNotes: (data.order as any).internalNotes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        requestedDeliveryDate: (data.order as any).requestedDeliveryDate
      });

      // Set selected fitter ID for dropdown from loaded data
      const loadedFitter = (data.order as Record<string, unknown>)?.fitter as Record<string, unknown> | undefined;
      if (loadedFitter?.id) setSelectedFitterId(String(loadedFitter.id));

      // Override form data with duplicate data when duplicating an order
      if (isDuplicate && duplicateData) {
        setFormData(prev => ({
          ...prev,
          isUrgent: Boolean(duplicateData.isUrgent),
          isStock: Boolean(duplicateData.isStock),
          isDemo: Boolean(duplicateData.isDemo),
          isSponsored: Boolean(duplicateData.isSponsored),
          isRepair: Boolean(duplicateData.isRepair),
          notes: String(duplicateData.specialNotes || prev.notes || ''),
          status: 'Unordered',
          pricing: {
            subtotal: Number(duplicateData.price) || prev.pricing.subtotal,
            discount: Number(duplicateData.discount) || prev.pricing.discount,
            tax: Number(duplicateData.tax) || prev.pricing.tax,
            shipping: Number(duplicateData.shipping) || prev.pricing.shipping,
            total: Number(duplicateData.price) || prev.pricing.total,
            currency: prev.pricing.currency,
          },
        }));
        if (duplicateData.customerName) {
          setCustomerSearchTerm(String(duplicateData.customerName));
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load order data';
      logger.error('Error loading comprehensive order data:', err);
      
      // If it's an authentication error, provide clear instructions
      if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
        setDataError('Authentication required. Please log in again.');
      } else {
        // For other errors, still allow editing with minimal data
        logger.warn('Non-auth error, continuing with minimal data');
        setDataError(null); // Don't show error, just continue
        
        // Set minimal form data to allow editing
        setFormData({
          orderLines: [],
          pricing: {
            subtotal: 0,
            discount: 0,
            tax: 0,
            shipping: 0,
            total: 0,
            currency: 'USD'
          },
          status: 'Unordered',
          isUrgent: false,
          isStock: false,
          isDemo: false,
          isSponsored: false,
          isRepair: false
        });
      }
    } finally {
      setLoadingData(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  // Load comprehensive order data
  useEffect(() => {
    if (order?.id) {
      // TODO(react-hooks): loadOrderData() is async — all setState calls happen after awaited fetches, not synchronously in the effect body.
      loadOrderData(); // eslint-disable-line react-hooks/set-state-in-effect -- async; setState runs after await
    }
  }, [order?.id, loadOrderData]);

  // Customer search with debouncing
  const searchCustomersDebounced = useCallback(
    async (searchTerm: string) => {
      if (searchTerm.length < 2) {
        setCustomerSearchResults([]);
        return;
      }
      
      setCustomerSearchLoading(true);
      try {
        const results = await searchCustomers(searchTerm);
        setCustomerSearchResults(results as unknown as Customer[]);
      } catch (error) {
        logger.error('Error searching customers:', error);
        setCustomerSearchResults([]);
      } finally {
        setCustomerSearchLoading(false);
      }
    },
    []
  );

  // Debounced customer search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCustomersDebounced(customerSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearchTerm, searchCustomersDebounced]);

  // Every Step-1 field marked with a red asterisk that is still empty, in page order
  // (same rules as ComprehensiveEditOrder.getMissingRequiredFields).
  const getMissingRequiredFields = (): string[] => {
    const missing: string[] = [];
    const blank = (v?: string) => !v || v.trim() === '';
    if (blank(selectedFitterId)) missing.push('Fitter');
    if (blank(selectedSaddleId)) missing.push('Brand & Model');
    if (selectedPresetId !== 'none') {
      if (blank(selectedLeatherId)) missing.push('Leathertype');
      for (const opt of regularOptions) {
        if (getItemsForOption(opt).length === 0) continue;
        for (const clone of getSlots(opt.optionId)) {
          const key = slotKey(opt.optionId, clone);
          const selected = optionSelections[key];
          if (blank(selected)) { missing.push(slotLabel(opt.optionName, clone)); continue; }
          const inputs = getSpecInputs(opt.optionId, selected);
          if ((inputs.custom && blank(optionCustom[key])) || (inputs.color && blank(optionColor[key])) || (inputs.leather && blank(optionLeather[key]))) {
            missing.push(slotLabel(opt.optionName, clone));
          }
        }
      }
    }
    const priceLabels: Array<[keyof typeof prices, string]> = [
      ['tradein', 'Trade in'], ['deposit', 'Deposit'], ['discount', 'Discount'], ['fittingeval', 'Fitting/Eval'],
      ['callfee', 'Call fee'], ['girth', 'Girth'], ['additional', 'Additional costs'],
    ];
    for (const [key, label] of priceLabels) if (blank(prices[key])) missing.push(label);
    return missing;
  };
  const validateSaddleInformation = (): boolean => {
    const missing = getMissingRequiredFields();
    if (missing.length === 0) return true;
    toast.error(`Please fill in the required fields: ${missing.join(', ')}`);
    return false;
  };

  const handleSubmit = async () => {
    if (currentStep < 3) {
      if (currentStep === 1 && !validateSaddleInformation()) return;
      setCurrentStep(currentStep + 1);
    } else {
      setSaving(true);
      try {
        const isNewOrder = !order || isDuplicate;

        if (isNewOrder) {
          // Build payload for createOrderFromPayload (enriched orders endpoint)
          const createPayload: UpdateOrderPayload = {
            orderStatus: formData.status || 'Unordered',
            rushed: formData.isUrgent || false,
            demo: formData.isDemo || false,
            repair: formData.isRepair || false,
            sponsored: formData.isSponsored || false,
            fitterStock: formData.isStock || false,
            specialNotes: formData.notes,
            orderReference: formData.reference,
            // Customer fields — from the selected/created customer only
            customerId: formData.customer?.id ? Number(formData.customer.id) : undefined,
            customerName: formData.customer?.name,
            customerEmail: formData.customer?.email,
            customerPhone: formData.customer?.phone,
            customerAddress: formData.customer?.address,
            customerCity: formData.customer?.city,
            customerState: formData.customer?.state,
            customerZipcode: formData.customer?.zipcode,
            customerCountry: formData.customer?.country,
            // Shipping fields — from the Step 2 shipping block only
            shipName,
            shipAddress: formData.shippingAddress?.street,
            shipCity: formData.shippingAddress?.city,
            shipState: formData.shippingAddress?.state,
            shipZipcode: formData.shippingAddress?.zipCode,
            // Drop the legacy "-1" sentinel so we don't round-trip it on save.
            shipCountry: formData.shippingAddress?.country === '-1' ? undefined : formData.shippingAddress?.country,
            // Fitter
            fitterId: formData.fitter?.id ? Number(formData.fitter.id) : undefined,
            // Saddle
            saddleId: selectedSaddleId ? parseInt(selectedSaddleId, 10) : undefined,
            leatherId: selectedLeatherId ? parseInt(selectedLeatherId, 10) : undefined,
            // Saddle options
            saddleOptions: [
              // Regular option selections: every open slot of every option,
              // renumbered 0..n-1 so orders_info.clone_number has no gaps
              ...Array.from(new Set(Object.keys(optionSelections).map(slotOptionId))).flatMap(optId => {
                let nextClone = 0;
                return getSlots(optId).flatMap(clone => {
                  const key = slotKey(optId, clone);
                  const itemId = optionSelections[key];
                  if (itemId === undefined || itemId === '') return [];
                  const inputs = getSpecInputs(optId, itemId);
                  return [{
                    optionId: optId,
                    optionItemId: Number(itemId),
                    cloneNumber: nextClone++,
                    custom: inputs.custom ? (optionCustom[key] ?? '') : '',
                    color: inputs.color ? (optionColor[key] ?? '') : '',
                    leatherType: inputs.leather ? (optionLeather[key] ?? '') : '',
                  }];
                });
              }),
              // Extras (type=2 options, stored with optionItemId=0)
              ...Object.entries(selectedExtras)
                .filter(([, checked]) => checked)
                .map(([optId]) => ({
                  optionId: Number(optId),
                  optionItemId: 0,
                  custom: '',
                })),
            ],
            // Pricing
            priceSaddle: parseFloat(prices.saddle) || 0,
            priceTradein: parseFloat(prices.tradein) || 0,
            priceDeposit: parseFloat(prices.deposit) || 0,
            priceDiscount: parseFloat(prices.discount) || 0,
            priceFittingeval: parseFloat(prices.fittingeval) || 0,
            priceCallfee: parseFloat(prices.callfee) || 0,
            priceGirth: parseFloat(prices.girth) || 0,
            priceAdditional: parseFloat(prices.additional) || 0,
            priceShipping: 0,
            priceTax: 0,
          };
          await createOrderFromPayload(createPayload);
          logger.log(isDuplicate ? 'Duplicate order created successfully' : 'New order created successfully');
        } else {
          const orderToSave = {
            ...comprehensiveData?.order,
            ...formData,
            id: order?.id,
          };
          await saveOrderEditData(Number(order?.id || 0), orderToSave as unknown as Record<string, unknown>);
          logger.log('Order saved successfully');
        }
        onClose();
      } catch (error) {
        logger.error('Error saving order:', error);
        // Handle error (show toast, etc.)
      } finally {
        setSaving(false);
      }
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

  const selectCustomer = (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      // Rows from searchCustomers carry the phone number as phoneNo (the
      // backend CustomerDto field), not phone — normalise so the payload's
      // customerPhone isn't silently dropped for a searched customer.
      customer: { ...customer, phone: customer.phone ?? customer.phoneNo }
    }));
    setCustomerSearchTerm(customer.name);
    setCustomerSearchResults([]);
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim()) return;
    setNewCustomerSaving(true);
    setNewCustomerError(null);
    try {
      // The customer is filed under the order's fitter (customers.fitter_id is
      // NOT NULL). A fitter-role user has it forced server-side anyway.
      const created = await createCustomerRecord({
        name: newCustomer.name,
        email: newCustomer.email || undefined,
        phoneNo: newCustomer.phone || undefined,
        cellNo: newCustomer.phone || undefined,
        address: newCustomer.address || undefined,
        city: newCustomer.city || undefined,
        state: newCustomer.state || undefined,
        zipcode: newCustomer.zipcode || undefined,
        country: newCustomer.country || undefined,
        fitterId: formData.fitter?.id ? Number(formData.fitter.id) : undefined,
      });
      const customer: Customer = {
        id: Number(created.id),
        name: created.name || newCustomer.name,
        email: created.email || newCustomer.email,
        phone: created.phoneNo || newCustomer.phone,
        address: created.address || newCustomer.address,
        city: created.city || newCustomer.city,
        state: created.state || newCustomer.state,
        zipcode: created.zipcode || newCustomer.zipcode,
        country: created.country || newCustomer.country,
      };
      selectCustomer(customer);
      setShowNewCustomerForm(false);
      setNewCustomer({ name: '', email: '', phone: '', address: '', city: '', state: '', zipcode: '', country: '' });
    } catch (err) {
      logger.error('Error creating customer:', err);
      setNewCustomerError(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setNewCustomerSaving(false);
    }
  };

  const updateFormData = (updates: Partial<OrderEditFormState>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Get available items for a given option. Leather options (type 1) pick a
  // leather_types row (saved as orders_info.leather_id) rather than an options_items row.
  const getItemsForOption = (opt: { optionId: number; type?: number }): Array<{ id: number; name: string }> => {
    if (!editOptions) return [];
    if (opt.type === 1) {
      return (editOptions.optionLeathers ?? [])
        .filter(l => l.optionId === opt.optionId)
        .map(l => ({ id: l.leatherId, name: l.name }));
    }
    return editOptions.optionItems.filter(i => i.optionId === opt.optionId);
  };

  const getSpecInputs = (optionId: number, selectedItemId: string): SpecInputs => {
    const item = editOptions?.optionItems.find(i => i.optionId === optionId && String(i.id) === selectedItemId);
    return specInputsForItem(selectedItemId, item);
  };

  // Sorted options by sequence
  const sortedOptions = editOptions?.options?.sort((a, b) => a.sequence - b.sequence) || [];
  // Separate regular options (type 0/1) from extras (type 2)
  const regularOptions = sortedOptions.filter(o => o.type !== 2);
  const extraOptions = sortedOptions.filter(o => o.type === 2);

  const selectedFitter = editOptions?.fitters.find(f => String(f.id) === selectedFitterId);
  const currencyCode = currencyCodeFor(selectedFitter?.currency);
  const total = formatMoney(orderTotal({ ...prices, shipping: 0, tax: 0 }));

  // Auto-fill option selections from preset.
  // Dep is the whole editOptions object rather than editOptions?.presetItems so the React
  // Compiler can infer an exact match between the source and the memoization boundary.
  const applyPreset = useCallback((presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === 'none' || !editOptions?.presetItems) return;
    // Inlined rather than calling getItemsForOption, which isn't memoized and
    // would otherwise be an unstable useCallback dependency.
    const offeredItemIds = (optionId: number): Array<number | string> => {
      const type = editOptions.options.find(o => o.optionId === optionId)?.type ?? 0;
      if (type === 1) {
        return (editOptions.optionLeathers ?? []).filter(l => l.optionId === optionId).map(l => l.leatherId);
      }
      return editOptions.optionItems.filter(i => i.optionId === optionId).map(i => i.id);
    };
    setOptionSelections(presetSelections(editOptions.presetItems, Number(presetId), offeredItemIds));
    setOptionCustom({});
    setOptionColor({});
    setOptionLeather({});
    setOptionClones({});
    setSelectedExtras({});
  }, [editOptions]);

  return (
    <DialogContent className="max-w-[1400px] h-[90vh] p-0 flex flex-col">
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
            {isDuplicate ? `Duplicate Order #${order?.orderId}` : order ? `Edit Order #${order.orderId}` : 'New Order'} | Step {currentStep}: {steps[currentStep - 1].title}
          </DialogTitle>
          <div className="w-32" />
        </div>
      </DialogHeader>

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
                  onClick={() => {
                    // Jumping forward off Step 1 is gated the same as Next Step;
                    // moving backwards, or between steps 2 and 3, is not.
                    if (currentStep === 1 && step.id > 1 && !validateSaddleInformation()) return;
                    setCurrentStep(step.id);
                  }}
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
                    currentStep > step.id ? 'text-blue-600' : 'text-gray-300'
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading order data...</p>
          </div>
        </div>
      )}
      
      {(error || dataError) && !isLoading && !loadingData && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading order data</p>
            <p className="text-sm text-gray-600 mt-1">{error || dataError}</p>
            <div className="mt-3 space-x-2">
              <Button 
                onClick={loadOrderData} 
                size="sm"
                variant="outline"
              >
                Retry
              </Button>
              {(dataError?.includes('Authentication required') || dataError?.includes('401')) && (
                <Button 
                  onClick={() => window.location.href = '/login'} 
                  size="sm"
                >
                  Go to Login
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {!isLoading && !loadingData && !error && !dataError && (
        <div className="flex-1 overflow-auto p-6">
          {/* Step 1: Products & Pricing */}
          {currentStep === 1 && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column - Saddle Specifications */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold mb-4 text-lg">Saddle Specifications</h3>
                <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
                  <Label className="text-sm font-medium pt-2">
                    Fitter: <span className="text-red-500">*</span>
                  </Label>
                  <Select value={selectedFitterId} disabled={!!lockedFitterId} onValueChange={(val) => {
                    setSelectedFitterId(val);
                    const fitter = editOptions?.fitters?.find(f => String(f.id) === val);
                    if (fitter) {
                      setFormData(prev => ({
                        ...prev,
                        fitter: { id: fitter.id, name: fitter.fullName || fitter.username }
                      }));
                    }
                    // Changing the fitter changes the currency: re-derive the saddle price unless the user overrode it.
                    const leather = editOptions?.leatherTypes.find(lt => String(lt.id) === selectedLeatherId);
                    if (leather && prices.saddle === formatMoney(saddlePriceFor(leather, selectedFitter?.currency))) {
                      setPrice('saddle', formatMoney(saddlePriceFor(leather, fitter?.currency)));
                    }
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="- Choose fitter -" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Inactive fitters can't take new orders; keep only the one already on this order. */}
                      {editOptions?.fitters
                        ?.filter(f => f.active !== false || String(f.id) === selectedFitterId)
                        .map(f => (
                          <SelectItem key={f.id} value={String(f.id)}>
                            {f.fullName || f.username}{f.active === false ? ' (inactive)' : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Label className="text-sm font-medium pt-1">Stock:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="stock"
                      checked={formData.isStock}
                      onCheckedChange={(checked) => updateFormData({ isStock: !!checked })}
                    />
                    <label className="text-sm" htmlFor="stock">
                      This saddle will be added to my own inventory.
                    </label>
                  </div>

                  <Label className="text-sm font-medium pt-1">Demo:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="demo"
                      checked={formData.isDemo}
                      onCheckedChange={(checked) => updateFormData({ isDemo: !!checked })}
                    />
                    <label className="text-sm" htmlFor="demo">
                      This saddle will be used for demo-purposes only.
                    </label>
                  </div>

                  <Label className="text-sm font-medium pt-1">Repair:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="repair"
                      checked={formData.isRepair}
                      onCheckedChange={(checked) => updateFormData({ isRepair: !!checked })}
                    />
                    <label className="text-sm" htmlFor="repair">
                      This saddle will be repaired. Please add your repair instructions to the special notes field.
                    </label>
                  </div>

                  <Label className="text-sm font-medium pt-1">Urgent:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="urgent"
                      checked={formData.isUrgent}
                      onCheckedChange={(checked) => updateFormData({ isUrgent: !!checked })}
                    />
                    <label className="text-sm" htmlFor="urgent">- Give this order high priority -</label>
                  </div>

                  <Label className="text-sm font-medium pt-1">Sponsored:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sponsored"
                      checked={formData.isSponsored}
                      onCheckedChange={(checked) => updateFormData({ isSponsored: !!checked })}
                    />
                    <label className="text-sm" htmlFor="sponsored"></label>
                  </div>

                  <Label className="text-sm font-medium pt-2">
                    Brand & Model: <span className="text-red-500">*</span>
                  </Label>
                  <Select value={selectedSaddleId} onValueChange={async (val) => {
                    setSelectedSaddleId(val);
                    setSelectedPresetId('none');
                    setSelectedLeatherId('');
                    setOptionSelections({});
                    setOptionCustom({});
                    setOptionColor({});
                    setOptionLeather({});
                    setOptionClones({});
                    setSelectedExtras({});
                    // Refetch options filtered by the selected saddle
                    const newOptions = await fetchEditOptions(val);
                    if (newOptions) setEditOptions(newOptions);
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="- Choose model -" />
                    </SelectTrigger>
                    <SelectContent>
                      {editOptions?.saddles?.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label className="text-sm font-medium pt-2">Preset:</Label>
                  <Select value={selectedPresetId} onValueChange={applyPreset}>
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

                  {/* Leathertype - shown when preset is selected */}
                  {selectedPresetId !== 'none' && (
                    <>
                      <Label className="text-sm font-medium pt-2">
                        Leathertype: <span className="text-red-500">*</span>
                      </Label>
                      <Select value={selectedLeatherId} onValueChange={(val) => {
                        setSelectedLeatherId(val);
                        // Legacy fills the saddle price from saddle_leathers.price<fitter currency>.
                        const leather = editOptions?.leatherTypes.find(lt => String(lt.id) === val);
                        setPrice('saddle', formatMoney(saddlePriceFor(leather, selectedFitter?.currency)));
                      }}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="- Choose -" />
                        </SelectTrigger>
                        <SelectContent>
                          {editOptions?.leatherTypes?.map(lt => (
                            <SelectItem key={lt.id} value={String(lt.id)}>
                              {lt.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  {/* Dynamic saddle options - shown when preset is selected.
                      An option with extra_allowed > 0 may have several rows ("CANTLE Option (2)"). */}
                  {selectedPresetId !== 'none' && regularOptions.map(opt => {
                    const items = getItemsForOption(opt);
                    if (items.length === 0) return null;
                    const slots = getSlots(opt.optionId);
                    const extraAllowed = opt.extraAllowed ?? 0;
                    const canAddClone = extraAllowed > 0 && slots.length - 1 < extraAllowed;

                    return (
                      <React.Fragment key={opt.optionId}>
                        {slots.map((clone, slotIdx) => {
                          const key = slotKey(opt.optionId, clone);
                          const label = slotLabel(opt.optionName, clone);
                          const selectedItemId = optionSelections[key] || '';
                          const isLastSlot = slotIdx === slots.length - 1;
                          return (
                            <div key={key} className="col-span-2">
                              <OptionSlotRow
                                label={label}
                                selectedItemId={selectedItemId}
                                placeholder="- Choose -"
                                items={items}
                                inputs={getSpecInputs(opt.optionId, selectedItemId)}
                                custom={optionCustom[key] ?? ''}
                                color={optionColor[key] ?? ''}
                                leather={optionLeather[key] ?? ''}
                                onSelect={(val) => setOptionSelections(prev => ({ ...prev, [key]: val }))}
                                onCustomChange={(v) => setOptionCustom(prev => ({ ...prev, [key]: v }))}
                                onColorChange={(v) => setOptionColor(prev => ({ ...prev, [key]: v }))}
                                onLeatherChange={(v) => setOptionLeather(prev => ({ ...prev, [key]: v }))}
                                onRemove={clone > 0 ? () => removeClone(opt.optionId, clone) : undefined}
                                onAddClone={isLastSlot && canAddClone ? () => addClone(opt.optionId) : undefined}
                                addCloneLabel={`+ Add another ${opt.optionName}`}
                                inputIdPrefix={`spec-${opt.optionId}-${clone}`}
                              />
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}

                  {/* Extras (type=2 options) - shown as checkboxes when preset is selected */}
                  {selectedPresetId !== 'none' && extraOptions.length > 0 && (
                    <>
                      <div className="col-span-2 border-t mt-2 pt-3">
                        <Label className="text-sm font-semibold">Extras:</Label>
                      </div>
                      {extraOptions.map(extra => (
                        <React.Fragment key={extra.optionId}>
                          <div className="col-span-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`extra-${extra.optionId}`}
                                checked={!!selectedExtras[extra.optionId]}
                                onCheckedChange={(checked) => {
                                  setSelectedExtras(prev => ({
                                    ...prev,
                                    [extra.optionId]: !!checked,
                                  }));
                                }}
                              />
                              <label htmlFor={`extra-${extra.optionId}`} className="text-sm">
                                {extra.optionName}
                              </label>
                            </div>
                          </div>
                        </React.Fragment>
                      ))}
                    </>
                  )}
                </div>

                {/* Special Notes - below the grid */}
                <div className="mt-4">
                  <Label className="text-sm font-medium">Special notes:</Label>
                  <Textarea
                    className="mt-1"
                    placeholder=""
                    value={formData.notes || ''}
                    onChange={(e) => updateFormData({ notes: e.target.value })}
                    rows={4}
                  />
                </div>
              </div>

              {/* Right Column - Pricing */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Pricing</h3>
                <div className="space-y-3">
                  {([
                    ['saddle', 'Saddle price:', false],
                    ['tradein', 'Trade in:', true],
                    ['deposit', 'Deposit:', true],
                    ['discount', 'Discount:', true],
                    ['fittingeval', 'Fitting/Eval:', true],
                    ['callfee', 'Call fee:', true],
                    ['girth', 'Girth:', true],
                    ['additional', 'Additional costs:', true],
                  ] as const).map(([key, label, required]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Label htmlFor={`price-${key}`} className="text-sm font-medium min-w-fit">
                        {label}{required && <> <span className="text-red-500">*</span></>}
                      </Label>
                      <Input id={`price-${key}`} className="h-8 text-right text-sm w-24" type="number" step="0.01"
                        value={prices[key]} onChange={(e) => setPrice(key, e.target.value)} />
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium min-w-fit">Shipping: <span className="text-red-500">*</span></Label>
                    <span className="text-sm">-</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium min-w-fit">Tax: <span className="text-red-500">*</span></Label>
                    <span className="text-sm">-</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Shipping and Taxes will be determined by Custom Saddlery.
                  </div>
                  <hr className="my-3" />
                  <div className="flex items-center gap-2 font-semibold">
                    <Label className="text-sm font-medium min-w-fit">Total ({currencyCode}):</Label>
                    <span className="text-sm">{total}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Your deposit is non-refundable if your order is canceled.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legacy Order Lines Section (hidden for now) */}
          {false && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Order Lines</h3>
                {formData.orderLines.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No order lines found</p>
                    <Button className="mt-4" size="sm">
                      Add Product
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.orderLines.map((orderLine, index) => (
                      <div key={orderLine.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">Order Line {index + 1}</h4>
                            <p className="text-sm text-gray-600">
                              Quantity: {orderLine.quantity} | Unit Price: ${orderLine.unitPrice || 0}
                            </p>
                            {orderLine.reference && (
                              <p className="text-sm text-gray-600">Reference: {orderLine.reference}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${orderLine.totalPrice || 0}</p>
                            <Button variant="outline" size="sm" className="mt-2">
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Pricing Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${formData.pricing.subtotal || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-${formData.pricing.discount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>${formData.pricing.tax || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping:</span>
                    <span>${formData.pricing.shipping || 0}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total:</span>
                    <span>${formData.pricing.total || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Customer & Shipping */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 gap-6">
              {/* Customer Selection */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Customer</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Search Customer</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Type customer name..."
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {customerSearchLoading && (
                      <p className="text-sm text-gray-500 mt-2">Searching...</p>
                    )}
                    {customerSearchResults.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
                        {customerSearchResults.map((customer) => (
                          <button
                            key={customer.id}
                            className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0"
                            onClick={() => selectCustomer(customer)}
                          >
                            <div className="font-medium">{customer.name}</div>
                            {customer.email && (
                              <div className="text-sm text-gray-600">{customer.email}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {showNewCustomerForm ? 'Cancel' : 'Add New Customer'}
                    </Button>
                  </div>

                  {showNewCustomerForm && (
                    <div className="border rounded-md p-4 space-y-3 bg-blue-50">
                      <h4 className="font-medium text-sm">New Customer</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <Label className="text-xs">Name <span className="text-red-500">*</span></Label>
                          <Input className="h-8 text-sm" value={newCustomer.name} onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">Email</Label>
                          <Input className="h-8 text-sm" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">Phone</Label>
                          <Input className="h-8 text-sm" value={newCustomer.phone} onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))} />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Address</Label>
                          <Input className="h-8 text-sm" value={newCustomer.address} onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">City</Label>
                          <Input className="h-8 text-sm" value={newCustomer.city} onChange={(e) => setNewCustomer(prev => ({ ...prev, city: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">Zipcode</Label>
                          <Input className="h-8 text-sm" value={newCustomer.zipcode} onChange={(e) => setNewCustomer(prev => ({ ...prev, zipcode: e.target.value }))} />
                        </div>
                        <div className="col-span-2">
                          <ShippingCountrySelect
                            idPrefix="new-customer"
                            country={newCustomer.country}
                            state={newCustomer.state}
                            onCountryChange={(country) => setNewCustomer(prev => ({ ...prev, country }))}
                            onStateChange={(state) => setNewCustomer(prev => ({ ...prev, state }))}
                          />
                        </div>
                      </div>
                      {newCustomerError && (
                        <p className="text-sm text-red-600">{newCustomerError}</p>
                      )}
                      <Button size="sm" onClick={handleCreateCustomer} disabled={!newCustomer.name.trim() || newCustomerSaving}>
                        {newCustomerSaving ? 'Saving...' : 'Create Customer'}
                      </Button>
                    </div>
                  )}

                  {formData.customer && (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h4 className="font-medium">{formData.customer.name}</h4>
                      {formData.customer.email && (
                        <p className="text-sm text-gray-600">{formData.customer.email}</p>
                      )}
                      {formData.customer.phone && (
                        <p className="text-sm text-gray-600">{formData.customer.phone}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg border p-6 lg:col-span-2">
                <h3 className="font-semibold mb-2 text-lg">Shipping address</h3>
                <p className="text-sm text-gray-500 mb-4">(if different than under &quot;customer information or Inventory&quot;)</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                    <Label htmlFor="ship-name" className="text-sm font-medium">Name:</Label>
                    <Input id="ship-name" value={shipName} onChange={(e) => setShipName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                    <Label htmlFor="ship-address" className="text-sm font-medium">Address:</Label>
                    <Input id="ship-address" value={formData.shippingAddress?.street || ''}
                      onChange={(e) => updateFormData({ shippingAddress: { ...formData.shippingAddress, street: e.target.value } })} />
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                    <Label htmlFor="ship-city" className="text-sm font-medium">City:</Label>
                    <Input id="ship-city" value={formData.shippingAddress?.city || ''}
                      onChange={(e) => updateFormData({ shippingAddress: { ...formData.shippingAddress, city: e.target.value } })} />
                  </div>
                  <ShippingCountrySelect
                    country={formData.shippingAddress?.country || ''}
                    state={formData.shippingAddress?.state || ''}
                    onCountryChange={(country) => updateFormData({ shippingAddress: { ...formData.shippingAddress, country } })}
                    onStateChange={(state) => updateFormData({ shippingAddress: { ...formData.shippingAddress, state } })}
                  />
                  <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                    <Label htmlFor="ship-zip" className="text-sm font-medium">Zipcode:</Label>
                    <Input id="ship-zip" value={formData.shippingAddress?.zipCode || ''}
                      onChange={(e) => updateFormData({ shippingAddress: { ...formData.shippingAddress, zipCode: e.target.value } })} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Order Settings */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Order Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Reference</Label>
                    <Input
                      value={formData.reference || ''}
                      onChange={(e) => updateFormData({ reference: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => updateFormData({ status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {editOptions?.statuses?.map(s => (
                          <SelectItem key={s.id} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Requested Delivery Date</Label>
                    <Input
                      type="date"
                      value={formData.requestedDeliveryDate || ''}
                      onChange={(e) => updateFormData({ requestedDeliveryDate: e.target.value })}
                    />
                  </div>
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
            className="btn-primary"
          >
            {saving ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </div>
            ) : (
              currentStep === 3 
                ? (order ? 'Update Order' : 'Create Order')
                : 'Next Step'
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}