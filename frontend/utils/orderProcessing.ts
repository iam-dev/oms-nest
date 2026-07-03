// Shared order processing utilities
import { fetchEntities } from '@/services/api';
import { orderFilterSchema, validateData, sanitizeObject } from '@/schemas/validation';
import { logger } from '@/utils/logger';
import type { Order } from '@/types/Order';

// Type definitions for order processing
export interface OrderTableRow {
  id: number;
  reference: string;
  seatSize: string;
  customer: string;
  fitter: string;
  factory: string;
  orderStatus: string;
  orderTime: string;
  createdAt: string;
  status: string;
  urgent: boolean;
  seatSizes?: string[];
  name?: string;
  isUrgent?: boolean;
  // Allow additional properties from the API response (brandName, modelName, customerName, etc.)
  [key: string]: unknown;
}

export interface HeaderFilters {
  [key: string]: string;
}

// Helper functions from Dashboard and Orders components
export function getCustomerName(order: Order): string {
  if (order.customerName) return String(order.customerName);
  if (order.customer) {
    if (typeof order.customer === 'string') return order.customer;
    if (typeof order.customer === 'object' && order.customer !== null) {
      const c = order.customer as unknown as Record<string, unknown>;
      if (typeof c.name === 'string') return c.name;
      if (typeof c.firstName === 'string' && typeof c.lastName === 'string') {
        return `${c.firstName} ${c.lastName}`;
      }
    }
  }
  return '';
}

export function getFitterName(order: Order): string {
  if (order.fitterName) return String(order.fitterName);
  if (order.fitter) {
    if (typeof order.fitter === 'string') return order.fitter;
    if (typeof order.fitter === 'object' && order.fitter !== null) {
      const f = order.fitter as unknown as Record<string, unknown>;
      if (typeof f.name === 'string') return f.name;
      if (typeof f.firstName === 'string' && typeof f.lastName === 'string') {
        return `${f.firstName} ${f.lastName}`;
      }
    }
  }
  return '';
}

export function getSupplierName(order: Order): string {
  if (order.supplierName) return String(order.supplierName);
  if (order.supplier) {
    if (typeof order.supplier === 'string') return order.supplier;
    if (typeof order.supplier === 'object' && order.supplier !== null) {
      const s = order.supplier as Record<string, unknown>;
      if (typeof s.name === 'string') return s.name;
      if (typeof s.firstName === 'string' && typeof s.lastName === 'string') {
        return `${s.firstName} ${s.lastName}`;
      }
    }
  }
  return '';
}

// Build comprehensive filters from headerFilters with validation
export function buildOrderFilters(headerFilters: HeaderFilters): Record<string, unknown> {
  // Sanitize the input first
  const sanitizedFilters = sanitizeObject(headerFilters);

  // Validate the filters
  const validation = validateData(orderFilterSchema, sanitizedFilters);
  if (!validation.success) {
    logger.warn('Invalid order filters:', validation.errors);
    return {}; // Return empty filters if validation fails
  }

  const validFilters = validation.data;
  const filters: Record<string, unknown> = {};

  Object.keys(validFilters).forEach(key => {
    const value = validFilters[key as keyof typeof validFilters];
    if (value && value !== '') {
      // Map frontend filter keys to API keys if needed
      if (key === 'id') {
        // ID filter - send as id for exact match
        filters.id = value;
      } else if (key === 'orderId') {
        filters.orderId = value;
      } else if (key === 'reference' || key === 'saddle') {
        // Saddle/reference filter - use searchTerm for general search
        filters.searchTerm = value;
      } else if (key === 'searchTerm') {
        // General search term - searches across customer, factory, fitter, brand, etc.
        filters.searchTerm = value;
      } else if (key === 'customer') {
        filters.customer = value;
      } else if (key === 'status') {
        filters.orderStatus = value;
      } else if (key === 'fitter') {
        filters.fitter = value;
      } else if (key === 'factory' || key === 'supplier') {
        filters.factory = value;
      } else if (key === 'urgent') {
        // Convert string boolean to actual boolean for API Platform BooleanFilter
        if (value === 'true') {
          filters.urgent = true;
        } else if (value === 'false') {
          filters.urgent = false;
        }
        // Don't set filter if empty/undefined to show all records
      } else if (key === 'seatSize') {
        filters.seatSizes = value;
      } else if (key === 'orderIds') {
        filters.orderIds = value;
      } else if (key === 'dateFrom') {
        filters.dateFrom = value;
      } else if (key === 'dateTo') {
        filters.dateTo = value;
      }
    }
  });
  
  return filters;
}

// Extract seat sizes from order (handles both snake_case and camelCase)
export function extractSeatSizes(order: Order): string {
  if (!order) return '';

  // Check for seat_sizes from backend (snake_case, JSONB array)
  if (Array.isArray(order.seat_sizes) && order.seat_sizes.length > 0) {
    return order.seat_sizes.map(normalizeSeatSize).join(', ');
  }

  // Check for seatSizes array (camelCase)
  if (Array.isArray(order.seatSizes) && order.seatSizes.length > 0) {
    return order.seatSizes.map(normalizeSeatSize).join(', ');
  }

  // Extract from reference if available (match both dot and comma notation)
  if (order.reference) {
    const match = order.reference.match(/(\d{2}(?:[.,]5)?)/g);
    if (match && match.length > 0) {
      return match.map(normalizeSeatSize).join(', ');
    }
  }

  // Fallback to seatSize property
  if (order.seatSize) {
    if (Array.isArray(order.seatSize)) {
      return order.seatSize.map(normalizeSeatSize).join(', ');
    }
    return normalizeSeatSize(String(order.seatSize));
  }

  return '';
}

// Normalize seat size format (European comma to dot notation for display)
export function normalizeSeatSize(size: string): string {
  if (!size) return '';
  // Convert European comma notation to dot notation (17,5 -> 17.5)
  return String(size).replace(',', '.');
}

// Extract seat sizes from text (special_notes or comments)
export function extractSeatSizesFromText(text: string): string[] {
  if (!text) return [];
  const sizes: string[] = [];
  // Match patterns like "seat size 17.5", "size 18", "17,5 seat", etc.
  const patterns = [
    /seat\s*size[:\s]*(\d{1,2}[.,]?\d?)/gi,
    /size[:\s]*(\d{1,2}[.,]?\d?)/gi,
    /(\d{1,2}[.,]5?)\s*(?:seat|inch|")/gi,
  ];
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const size = match[1];
      const numericSize = parseFloat(size.replace(',', '.'));
      // Only include valid seat sizes (14-20 range)
      if (numericSize >= 14 && numericSize <= 20) {
        sizes.push(normalizeSeatSize(size));
      }
    }
  }
  return sizes;
}

// Extract unique factory names from orders array
export function extractDynamicFactories(orders: Order[]): Array<{label: string, value: string}> {
  const factories = new Set<string>();

  orders.forEach(order => {
    // Check various factory/supplier name fields
    const factoryName = order.factoryName || order.factory_name ||
                       order.supplierName || order.supplier_name;
    if (factoryName && typeof factoryName === 'string' && factoryName.trim()) {
      factories.add(factoryName.trim());
    } else if (order.factory) {
      if (typeof order.factory === 'object') {
        const f = order.factory as { name?: string };
        if (f.name) factories.add(f.name);
      } else if (typeof order.factory === 'string' && order.factory.trim()) {
        factories.add(order.factory.trim());
      }
    } else if (order.supplier) {
      if (typeof order.supplier === 'object') {
        const s = order.supplier as { name?: string };
        if (s.name) factories.add(s.name);
      } else if (typeof order.supplier === 'string' && order.supplier.trim()) {
        factories.add(order.supplier.trim());
      }
    }
  });

  return Array.from(factories)
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ label: name, value: name }));
}

// Extract unique seat sizes from orders array
export function extractDynamicSeatSizes(orders: Order[]): string[] {
  const sizes = new Set<string>();

  orders.forEach(order => {
    // Check seat_sizes from backend (JSONB array)
    const seatSizesRaw = order['seat_sizes'];
    if (Array.isArray(seatSizesRaw) && seatSizesRaw.length > 0) {
      seatSizesRaw.forEach((size: unknown) => sizes.add(normalizeSeatSize(String(size))));
    }
    // Check seatSizes (camelCase)
    else if (Array.isArray(order.seatSizes) && order.seatSizes.length > 0) {
      order.seatSizes.forEach((size: unknown) => sizes.add(normalizeSeatSize(String(size))));
    } else if (order.seatSize) {
      sizes.add(normalizeSeatSize(String(order.seatSize)));
    }
    // Extract from special_notes or comments
    else if (order.special_notes || order.comments) {
      const noteText = String(order.special_notes || order.comments);
      const extracted = extractSeatSizesFromText(noteText);
      extracted.forEach(size => sizes.add(size));
    }
    // Fallback to reference field
    else if (order.reference) {
      const match = order.reference.match(/(\d{2}(?:[.,]5)?)/g);
      if (match) match.forEach((size: string) => sizes.add(normalizeSeatSize(size)));
    }
  });

  return Array.from(sizes).sort((a, b) => parseFloat(a) - parseFloat(b));
}

// Process orders for Dashboard display
export function processDashboardOrders(data: Record<string, unknown>): Order[] {
  const members = data['hydra:member'];
  const orders = Array.isArray(members) ? (members as Order[]) : [];
  return orders.map((order: Order) => {
    // Extract and normalize data from the hydra response
    const processedOrder = {
      ...order, // Keep all original API data
      // Add computed fields for compatibility, but don't override existing data
      id: Number(order.id) || 0,
      saddle: order.reference || '',
      date: order.orderTime || order.createdAt || '',
      status: order.orderStatus || order.status || '',
      orderStatus: order.orderStatus || order.status || '',
      orderTime: order.orderTime || order.createdAt || '',
      isUrgent: order.urgent || false,
      // Extract seat sizes from reference or seatSizes array if not already present
      seatSize: order.seatSizes ?
        (Array.isArray(order.seatSizes) ? order.seatSizes.join(', ') : order.seatSizes) :
        extractSeatSizes(order),
      // Only add computed names if the direct fields aren't available
      ...(order.customerName ? {} : { customer: getCustomerName(order) || '' }),
      ...(order.fitterName ? {} : { fitter: getFitterName(order) || '' }),
      ...(order.factoryName || order.supplierName ? {} : { factory: getSupplierName(order) || '' })
    };
    return processedOrder as unknown as Order;
  });
}

// Process orders for Orders table display
export function processOrdersTableData(orders: Order[]): OrderTableRow[] {
  return (orders || []).map((order: Order): OrderTableRow => {
    // Get the customer, fitter, and factory names
    const customerName = getCustomerName(order) || '';
    const fitterName = getFitterName(order) || '';
    const factoryName = getSupplierName(order) || '';

    // Ensure all required fields are present and correctly typed
    // IMPORTANT: Spread original order first to preserve all API fields (brandName, modelName,
    // customerName, fitterName, etc.) that column render functions expect
    return {
      ...order,  // Preserve all original API fields for column render functions
      id: Number(order.id) || 0,
      reference: order.reference || '',
      seatSize: Array.isArray(order.seatSize) ? order.seatSize.join(', ') : (order.seatSize ? String(order.seatSize) : ''),
      customer: typeof customerName === 'string' ? customerName : '',
      fitter: typeof fitterName === 'string' ? fitterName : '',
      factory: typeof factoryName === 'string' ? factoryName : '',
      orderStatus: order.orderStatus || '',
      orderTime: order.orderTime ? String(order.orderTime) : (order.createdAt ? String(order.createdAt) : ''),
      createdAt: order.createdAt ? String(order.createdAt) : '',
      status: order.orderStatus || 'pending',
      urgent: Boolean(order.urgent),
      // Include any additional fields that might be needed; always override seatSizes to drop null
      seatSizes: order.seatSizes != null ? (Array.isArray(order.seatSizes) ? order.seatSizes.map(String) : []) : undefined,
      ...(order.name != null ? { name: String(order.name) } : {}),
      ...(order.isUrgent !== undefined ? { isUrgent: Boolean(order.isUrgent) } : {})
    };
  });
}

// Process supplier/factory data for dropdown options
export function processSupplierData(suppliersData: Record<string, unknown>[]): Array<{label: string, value: string}> {
  if (!suppliersData || !Array.isArray(suppliersData)) {
    return [];
  }
  return suppliersData
    .filter((supplier: Record<string, unknown>) => supplier) // Filter out null/undefined
    .map((supplier: Record<string, unknown>) => {
      // Support multiple naming conventions: name, displayName, username
      const label = (supplier.name as string | undefined) ||
                   (supplier.displayName as string | undefined) ||
                   (supplier.username as string | undefined) ||
                   (supplier.city ? `Factory in ${String(supplier.city)}` : null) ||
                   'Unknown Factory';
      return {
        label,
        value: (supplier.name as string | undefined) ||
               (supplier.displayName as string | undefined) ||
               (supplier.username as string | undefined) ||
               String(supplier.id)
      };
    });
}

// Fetch complete order data by INTEGER ID
export async function fetchCompleteOrderData(
  order: Order,
  setIsLoadingOrderData: (loading: boolean) => void,
  setOrderDataError: (error: string | null) => void
): Promise<Order> {
  setIsLoadingOrderData(true);
  setOrderDataError(null);

  try {
    const orderId = Number(order.id) || 0;
    logger.log('Fetching complete order data for ID:', orderId);

    if (!orderId) {
      throw new Error('Invalid order ID');
    }

    const result = await fetchEntities({
      entity: 'enriched_orders',
      extraParams: { id: orderId },
      partial: false
    }) as Record<string, Order[]>;

    if (result['hydra:member'] && result['hydra:member'].length > 0) {
      logger.log('Successfully fetched order:', orderId);
      return result['hydra:member'][0];
    }

    throw new Error(`Order not found with ID: ${orderId}`);

  } catch (error) {
    logger.error('Error fetching complete order data:', error);
    setOrderDataError(error instanceof Error ? error.message : 'Failed to load order data');

    // Return the original order data as fallback
    logger.log('Falling back to table row data');
    return order;
  } finally {
    setIsLoadingOrderData(false);
  }
}