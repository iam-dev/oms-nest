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
import { fetchOrderEditData, searchCustomers, searchFitters, saveOrderEditData } from '@/services/orderEditView';
import { createOrder } from '@/services/api';
import { 
  ComprehensiveOrderData, 
  OrderEditFormState,
  Customer,
  Fitter,
  OrderStatus
} from '@/types/ComprehensiveOrder';
import { logger } from '@/utils/logger';

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

const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UNORDERED', label: 'Unordered' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'CHANGED', label: 'Changed' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'IN_PRODUCTION_P1', label: 'In Production P1' },
  { value: 'IN_PRODUCTION_P2', label: 'In Production P2' },
  { value: 'IN_PRODUCTION_P3', label: 'In Production P3' },
  { value: 'SHIPPED_TO_FITTER', label: 'Shipped to Fitter' },
  { value: 'SHIPPED_TO_CUSTOMER', label: 'Shipped to Customer' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'ON_TRIAL', label: 'On Trial' },
  { value: 'COMPLETED_SALE', label: 'Completed Sale' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

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
    status: 'DRAFT',
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
  
  // Fitter search state
  const [fitterSearchTerm, setFitterSearchTerm] = useState('');
  const [fitterSearchResults, setFitterSearchResults] = useState<Fitter[]>([]);
  const [fitterSearchLoading, setFitterSearchLoading] = useState(false);

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
            status: 'DRAFT',
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
        orderLines: data.orderLines || [],
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
        fitterAddress: (data.order as any).fitterAddress,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shippingAddress: (data.order as any).shippingAddress,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shippingMethod: (data.order as any).shippingMethod,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reference: (data.order as any).reference,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: ((data.order as any).status || 'DRAFT') as OrderStatus,
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
          status: 'DRAFT' as OrderStatus,
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
          status: 'DRAFT',
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
      loadOrderData();
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
        setCustomerSearchResults(results);
      } catch (error) {
        logger.error('Error searching customers:', error);
        setCustomerSearchResults([]);
      } finally {
        setCustomerSearchLoading(false);
      }
    },
    []
  );

  // Fitter search with debouncing
  const searchFittersDebounced = useCallback(
    async (searchTerm: string) => {
      if (searchTerm.length < 2) {
        setFitterSearchResults([]);
        return;
      }
      
      setFitterSearchLoading(true);
      try {
        const results = await searchFitters(searchTerm);
        setFitterSearchResults(results);
      } catch (error) {
        logger.error('Error searching fitters:', error);
        setFitterSearchResults([]);
      } finally {
        setFitterSearchLoading(false);
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

  // Debounced fitter search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      searchFittersDebounced(fitterSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [fitterSearchTerm, searchFittersDebounced]);

  const handleSubmit = async () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      setSaving(true);
      try {
        const orderToSave = {
          ...comprehensiveData?.order,
          ...formData,
          id: isDuplicate ? undefined : order?.id,
        };

        if (isDuplicate) {
          await createOrder(orderToSave);
          logger.log('Duplicate order created successfully');
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      customer,
      customerAddress: customer.address
    }));
    setCustomerSearchTerm(customer.name);
    setCustomerSearchResults([]);
  };

  const selectFitter = (fitter: Fitter) => {
    setFormData(prev => ({
      ...prev,
      fitter,
      fitterAddress: fitter.address
    }));
    setFitterSearchTerm(fitter.name);
    setFitterSearchResults([]);
  };

  const updateFormData = (updates: Partial<OrderEditFormState>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

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
                <div className="grid grid-cols-[120px,1fr] gap-4 items-start">
                  <Label className="text-sm font-medium pt-2">
                    Fitter: <span className="text-red-500">*</span>
                  </Label>
                  <Select defaultValue="Engie Kwakkel">
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Robyn Drake">Robyn Drake</SelectItem>
                      <SelectItem value="Engie Kwakkel">Engie Kwakkel</SelectItem>
                    </SelectContent>
                  </Select>

                  <Label className="text-sm font-medium pt-1">Stock:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="stock" />
                    <label className="text-sm" htmlFor="stock">
                      This saddle will be added to my own inventory.
                    </label>
                  </div>

                  <Label className="text-sm font-medium pt-1">Demo:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="demo" />
                    <label className="text-sm" htmlFor="demo">
                      This saddle will be used for demo-purposes only.
                    </label>
                  </div>

                  <Label className="text-sm font-medium pt-1">Repair:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="repair" />
                    <label className="text-sm" htmlFor="repair">
                      This saddle will be repaired. Please add your repair instructions to the special notes field.
                    </label>
                  </div>

                  <Label className="text-sm font-medium pt-1">Urgent:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="urgent" defaultChecked />
                    <label className="text-sm" htmlFor="urgent">- Give this order high priority -</label>
                  </div>

                  <Label className="text-sm font-medium pt-1">Sponsored:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="sponsored" />
                    <label className="text-sm" htmlFor="sponsored"></label>
                  </div>

                  <Label className="text-sm font-medium pt-2">
                    Brand & Model: <span className="text-red-500">*</span>
                  </Label>
                  <Select defaultValue="Icon Flight">
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Custom Advantage R">Custom Advantage R</SelectItem>
                      <SelectItem value="Icon Flight">Icon Flight(OM wool laced in)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Label className="text-sm font-medium pt-2">Preset:</Label>
                  <Select defaultValue="none">
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">- No preset selected -</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right Column - Pricing */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Pricing</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium min-w-fit">Saddle price:</Label>
                    <Input className="h-8 text-right text-sm w-24" type="number" defaultValue="3795.00" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium min-w-fit">Trade in: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-24" type="number" defaultValue="0.00" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium min-w-fit">Deposit: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-24" type="number" defaultValue="0.00" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium min-w-fit">Discount: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-24" type="number" defaultValue="0.00" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium min-w-fit">Fitting/Eval: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-24" type="number" defaultValue="0.00" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium min-w-fit">Call fee: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-24" type="number" defaultValue="0.00" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium min-w-fit">Girth: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-24" type="number" defaultValue="0.00" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium min-w-fit">Additional costs: <span className="text-red-500">*</span></Label>
                    <Input className="h-8 text-right text-sm w-24" type="number" defaultValue="0.00" />
                  </div>
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
                    <Label className="text-sm font-medium min-w-fit">Total (EUR):</Label>
                    <span className="text-sm">3795.00</span>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  </div>
                  
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

              {/* Fitter Selection */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Fitter</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Search Fitter</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Type fitter name..."
                        value={fitterSearchTerm}
                        onChange={(e) => setFitterSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {fitterSearchLoading && (
                      <p className="text-sm text-gray-500 mt-2">Searching...</p>
                    )}
                    {fitterSearchResults.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
                        {fitterSearchResults.map((fitter) => (
                          <button
                            key={fitter.id}
                            className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0"
                            onClick={() => selectFitter(fitter)}
                          >
                            <div className="font-medium">{fitter.name}</div>
                            {fitter.email && (
                              <div className="text-sm text-gray-600">{fitter.email}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {formData.fitter && (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h4 className="font-medium">{formData.fitter.name}</h4>
                      {formData.fitter.email && (
                        <p className="text-sm text-gray-600">{formData.fitter.email}</p>
                      )}
                      {formData.fitter.phone && (
                        <p className="text-sm text-gray-600">{formData.fitter.phone}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-lg border p-6 lg:col-span-2">
                <h3 className="font-semibold mb-4 text-lg">Shipping Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Street Address</Label>
                    <Input
                      value={formData.shippingAddress?.street || ''}
                      onChange={(e) => updateFormData({
                        shippingAddress: { ...formData.shippingAddress, street: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input
                      value={formData.shippingAddress?.city || ''}
                      onChange={(e) => updateFormData({
                        shippingAddress: { ...formData.shippingAddress, city: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <Label>State/Province</Label>
                    <Input
                      value={formData.shippingAddress?.state || ''}
                      onChange={(e) => updateFormData({
                        shippingAddress: { ...formData.shippingAddress, state: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <Label>ZIP/Postal Code</Label>
                    <Input
                      value={formData.shippingAddress?.zipCode || ''}
                      onChange={(e) => updateFormData({
                        shippingAddress: { ...formData.shippingAddress, zipCode: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input
                      value={formData.shippingAddress?.country || ''}
                      onChange={(e) => updateFormData({
                        shippingAddress: { ...formData.shippingAddress, country: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <Label>Shipping Method</Label>
                    <Input
                      value={formData.shippingMethod || ''}
                      onChange={(e) => updateFormData({ shippingMethod: e.target.value })}
                    />
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
                      onValueChange={(value) => updateFormData({ status: value as OrderStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
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

              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Flags</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { key: 'isUrgent', label: 'Urgent' },
                    { key: 'isStock', label: 'Stock' },
                    { key: 'isDemo', label: 'Demo' },
                    { key: 'isSponsored', label: 'Sponsored' },
                    { key: 'isRepair', label: 'Repair' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData[key as keyof OrderEditFormState] as boolean}
                        onCheckedChange={(checked) => updateFormData({ [key]: checked })}
                      />
                      <Label>{label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4 text-lg">Notes</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Customer Notes</Label>
                    <Textarea
                      value={formData.notes || ''}
                      onChange={(e) => updateFormData({ notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Internal Notes</Label>
                    <Textarea
                      value={formData.internalNotes || ''}
                      onChange={(e) => updateFormData({ internalNotes: e.target.value })}
                      rows={3}
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