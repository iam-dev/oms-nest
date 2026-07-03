// Simple Order Detail API Service - Fallback for when comprehensive data isn't available
import { fetchEntities } from './api';
import { API_URL } from './api-config';
import { logger } from '@/utils/logger';
import type { Customer } from '@/types/Customer';
import type { Fitter } from '@/types/Fitter';
import type { PricingDetails } from '@/types/ComprehensiveOrder';

export interface SimpleOrder {
  id: number;
  status: string;
  customerName?: unknown;
  fitterName?: unknown;
  urgent?: unknown;
  pricing: PricingDetails;
  isUrgent: boolean;
  isStock: boolean;
  isDemo: boolean;
  isSponsored: boolean;
  isRepair: boolean;
}

export interface SimpleOrderData {
  order: SimpleOrder;
  customer?: Customer | unknown;
  fitter?: Fitter | unknown;
}

/**
 * Fetch basic order data for editing when comprehensive endpoint fails
 */
export async function fetchSimpleOrderData(orderId: number): Promise<SimpleOrderData> {
  logger.log('Fetching simple order data for:', orderId);

  try {
    // Try to get the order by ID from enriched orders first
    const orderResponse = await fetchEntities({
      entity: 'enriched_orders',
      extraParams: { 'id': orderId, pagination: false }
    });

    if (orderResponse['hydra:member'] && orderResponse['hydra:member'].length > 0) {
      const order: Record<string, unknown> = orderResponse['hydra:member'][0];
      return {
        order: {
          id: Number(order.id),
          status: (typeof order.orderStatus === 'string' ? order.orderStatus : undefined) ?? 'DRAFT',
          customerName: order.customerName,
          fitterName: order.fitterName,
          urgent: order.urgent,
          pricing: {
            subtotal: 0,
            discount: 0,
            tax: 0,
            shipping: 0,
            total: 0,
            currency: 'USD'
          },
          isUrgent: Boolean(order.urgent),
          isStock: false,
          isDemo: false,
          isSponsored: false,
          isRepair: false
        },
        customer: order.customer,
        fitter: order.fitter
      };
    }

    // Fallback to regular orders endpoint
    const fallbackResponse = await fetchEntities({
      entity: 'orders',
      extraParams: { 'id': orderId, pagination: false }
    });

    if (fallbackResponse['hydra:member'] && fallbackResponse['hydra:member'].length > 0) {
      const order: Record<string, unknown> = fallbackResponse['hydra:member'][0];
      return {
        order: {
          id: Number(order.id),
          status: (typeof order.orderStatus === 'string' ? order.orderStatus : undefined) ?? 'DRAFT',
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
        }
      };
    }

    throw new Error('Order not found');

  } catch (error) {
    logger.error('Error fetching simple order data:', error);
    throw error;
  }
}

// Simple search functions
export async function searchCustomers(searchTerm: string): Promise<Record<string, unknown>[]> {
  try {
    const response = await fetchEntities({
      entity: 'customers',
      searchTerm,
      extraParams: { pagination: false }
    });
    return (response['hydra:member'] as Record<string, unknown>[] | undefined) ?? [];
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
    return (response['hydra:member'] as Record<string, unknown>[] | undefined) ?? [];
  } catch (error) {
    logger.error('Error searching fitters:', error);
    return [];
  }
}

export async function saveSimpleOrder(orderId: number, orderData: Record<string, unknown>): Promise<unknown> {
  logger.log('Saving simple order:', orderId, orderData);

  try {
    // Use the enriched orders endpoint for updates
    const response = await fetch(`${API_URL}/api/v1/enriched_orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/merge-patch+json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      throw new Error(`Failed to save order: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error saving simple order:', error);
    throw error;
  }
}
