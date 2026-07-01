// Order Edit View API Service - Single endpoint for comprehensive order editing
import { fetchEntities } from './api';
import { API_URL } from './api-config';
import { logger } from '@/utils/logger';

export interface OrderEditData {
  // Basic order info (INTEGER ID)
  id: number;
  orderStatus: string;
  reference?: string;
  fitterReference?: string;
  urgent: boolean;
  currency: string;
  orderTime?: string;
  notes?: string;
  internalNotes?: string;

  // Customer info (INTEGER ID)
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerCity?: string;
  customerZipcode?: string;
  customerState?: string;
  customerCountry?: string;
  customerPhoneNo?: string;

  // Fitter info (INTEGER ID)
  fitterId?: number;
  fitterName?: string;
  fitterEmail?: string;

  // Factory info (INTEGER ID)
  factoryId?: number;
  factoryName?: string;
  
  // Pricing
  price: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  
  // Product info
  seatSizes: string[];
  
  // Related data
  orderLines: unknown[];
  comments: unknown[];
  
  // Flags
  isStock: boolean;
  isDemo: boolean;
  isSponsored: boolean;
  isRepair: boolean;
}

/**
 * Fetch comprehensive order data for editing using the new OrderEditView
 */
export async function fetchOrderEditData(orderId: number): Promise<OrderEditData> {
  logger.log('Fetching order edit data for:', orderId);
  
  try {
    const response = await fetch(`${API_URL}/order_edit/${orderId}`, {
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch order edit data: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Transform the response to match our interface
    return {
      id: Number(data.id),
      orderStatus: data.orderStatus || 'DRAFT',
      reference: data.reference,
      fitterReference: data.fitterReference,
      urgent: Boolean(data.urgent),
      currency: data.currency || 'USD',
      orderTime: data.orderTime,
      notes: data.notes,
      internalNotes: data.internalNotes,

      customerId: data.customerId ? Number(data.customerId) : undefined,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerAddress: data.customerAddress,
      customerCity: data.customerCity,
      customerZipcode: data.customerZipcode,
      customerState: data.customerState,
      customerCountry: data.customerCountry,
      customerPhoneNo: data.customerPhoneNo,

      fitterId: data.fitterId ? Number(data.fitterId) : undefined,
      fitterName: data.fitterName,
      fitterEmail: data.fitterEmail,

      factoryId: data.factoryId ? Number(data.factoryId) : undefined,
      factoryName: data.factoryName,
      
      price: parseFloat(data.price || '0'),
      discount: parseFloat(data.discount || '0'),
      tax: parseFloat(data.tax || '0'),
      shipping: parseFloat(data.shipping || '0'),
      total: parseFloat(data.total || '0'),
      
      seatSizes: data.seatSizes || [],
      orderLines: data.orderLines || [],
      comments: data.comments || [],
      
      isStock: Boolean(data.isStock),
      isDemo: Boolean(data.isDemo),
      isSponsored: Boolean(data.isSponsored),
      isRepair: Boolean(data.isRepair),
    };
    
  } catch (error) {
    logger.error('Error fetching order edit data:', error);
    throw error;
  }
}

/**
 * Simple search functions using existing endpoints
 */
export async function searchCustomers(searchTerm: string): Promise<Record<string, unknown>[]> {
  try {
    const response = await fetchEntities({
      entity: 'customers',
      searchTerm,
      extraParams: { pagination: false }
    });
    return response['hydra:member'] || [];
  } catch (error) {
    logger.error('Error searching customers:', error);
    return [];
  }
}

export async function searchFitters(searchTerm: string): Promise<Record<string, unknown>[]> {
  try {
    const response = await fetchEntities({
      entity: 'fitters',
      searchTerm,
      extraParams: { pagination: false }
    });
    return response['hydra:member'] || [];
  } catch (error) {
    logger.error('Error searching fitters:', error);
    return [];
  }
}

/**
 * Save order changes (use existing update order endpoint)
 */
export async function saveOrderEditData(orderId: number, orderData: Partial<OrderEditData>): Promise<unknown> {
  logger.log('Saving order edit data:', orderId, orderData);
  
  try {
    // Use the enriched orders endpoint for updates
    const response = await fetch(`${API_URL}/api/v1/enriched_orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/merge-patch+json',
      },
      credentials: 'include',
      body: JSON.stringify(orderData),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save order: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error('Error saving order edit data:', error);
    throw error;
  }
}