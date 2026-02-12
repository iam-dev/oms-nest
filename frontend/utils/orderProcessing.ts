// Shared order processing utilities
import { fetchEntities } from '@/services/api';
import { orderFilterSchema, validateData, sanitizeObject } from '@/schemas/validation';
import { logger } from '@/utils/logger';

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
  [key: string]: any;
}

export interface HeaderFilters {
  [key: string]: string;
}

// Helper functions from Dashboard and Orders components
export function getCustomerName(order: any): string {
  if (order.customerName) return order.customerName;
  if (order.customer) {
    if (typeof order.customer === 'string') return order.customer;
    if (order.customer.name) return order.customer.name;
    if (order.customer.firstName && order.customer.lastName) {
      return `${order.customer.firstName} ${order.customer.lastName}`;
    }
  }
  return '';
}

export function getFitterName(order: any): string {
  if (order.fitterName) return order.fitterName;
  if (order.fitter) {
    if (typeof order.fitter === 'string') return order.fitter;
    if (order.fitter.name) return order.fitter.name;
    if (order.fitter.firstName && order.fitter.lastName) {
      return `${order.fitter.firstName} ${order.fitter.lastName}`;
    }
  }
  return '';
}

export function getSupplierName(order: any): string {
  if (order.supplierName) return order.supplierName;
  if (order.supplier) {
    if (typeof order.supplier === 'string') return order.supplier;
    if (order.supplier.name) return order.supplier.name;
    if (order.supplier.firstName && order.supplier.lastName) {
      return `${order.supplier.firstName} ${order.supplier.lastName}`;
    }
  }
  return '';
}

// Build comprehensive filters from headerFilters with validation
export function buildOrderFilters(headerFilters: HeaderFilters): Record<string, any> {
  // Sanitize the input first
  const sanitizedFilters = sanitizeObject(headerFilters);
  
  // Validate the filters
  const validation = validateData(orderFilterSchema, sanitizedFilters);
  if (!validation.success) {
    logger.warn('Invalid order filters:', validation.errors);
    return {}; // Return empty filters if validation fails
  }
  
  const validFilters = validation.data;
  const filters: Record<string, any> = {};
  
  Object.keys(validFilters).forEach(key => {
    const value = (validFilters as any)[key];
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
      }
    }
  });
  
  return filters;
}

// Extract seat sizes from order (handles both snake_case and camelCase)
export function extractSeatSizes(order: any): string {
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
export function extractDynamicFactories(orders: any[]): Array<{label: string, value: string}> {
  const factories = new Set<string>();

  orders.forEach(order => {
    // Check various factory/supplier name fields
    const factoryName = order.factoryName || order.factory_name ||
                       order.supplierName || order.supplier_name;
    if (factoryName && typeof factoryName === 'string' && factoryName.trim()) {
      factories.add(factoryName.trim());
    } else if (order.factory) {
      if (typeof order.factory === 'object' && order.factory.name) {
        factories.add(order.factory.name);
      } else if (typeof order.factory === 'string' && order.factory.trim()) {
        factories.add(order.factory.trim());
      }
    } else if (order.supplier) {
      if (typeof order.supplier === 'object' && order.supplier.name) {
        factories.add(order.supplier.name);
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
export function extractDynamicSeatSizes(orders: any[]): string[] {
  const sizes = new Set<string>();

  orders.forEach(order => {
    // Check seat_sizes from backend (JSONB array)
    if (Array.isArray(order.seat_sizes) && order.seat_sizes.length > 0) {
      order.seat_sizes.forEach((size: any) => sizes.add(normalizeSeatSize(String(size))));
    }
    // Check seatSizes (camelCase)
    else if (Array.isArray(order.seatSizes) && order.seatSizes.length > 0) {
      order.seatSizes.forEach((size: any) => sizes.add(normalizeSeatSize(String(size))));
    } else if (order.seatSize) {
      sizes.add(normalizeSeatSize(String(order.seatSize)));
    }
    // Extract from special_notes or comments
    else if (order.special_notes || order.comments) {
      const extracted = extractSeatSizesFromText(order.special_notes || order.comments);
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
export function processDashboardOrders(data: any): any[] {
  return (data['hydra:member'] || []).map((order: any) => {
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
    return processedOrder;
  });
}

// Process orders for Orders table display
export function processOrdersTableData(orders: any[]): OrderTableRow[] {
  return (orders || []).map((order: any): OrderTableRow => {
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
      seatSize: order.seatSize || '',
      customer: typeof customerName === 'string' ? customerName : '',
      fitter: typeof fitterName === 'string' ? fitterName : '',
      factory: typeof factoryName === 'string' ? factoryName : '',
      orderStatus: order.orderStatus || '',
      orderTime: order.orderTime || order.createdAt || '',
      createdAt: order.createdAt || '',
      status: order.orderStatus || 'pending',
      urgent: Boolean(order.urgent),
      // Include any additional fields that might be needed
      ...(order.seatSizes && { seatSizes: Array.isArray(order.seatSizes) ? order.seatSizes.map(String) : [] }),
      ...(order.name && { name: order.name }),
      ...(order.isUrgent !== undefined && { isUrgent: Boolean(order.isUrgent) })
    };
  });
}

// Process supplier/factory data for dropdown options
export function processSupplierData(suppliersData: any[]): Array<{label: string, value: string}> {
  if (!suppliersData || !Array.isArray(suppliersData)) {
    return [];
  }
  return suppliersData
    .filter((supplier: any) => supplier) // Filter out null/undefined
    .map((supplier: any) => {
      // Support multiple naming conventions: name, displayName, username
      const label = supplier.name || supplier.displayName || supplier.username ||
                   (supplier.city ? `Factory in ${supplier.city}` : null) ||
                   'Unknown Factory';
      return {
        label,
        value: supplier.name || supplier.displayName || supplier.username || String(supplier.id)
      };
    });
}

// Fetch complete order data by INTEGER ID
export async function fetchCompleteOrderData(
  order: any,
  setIsLoadingOrderData: (loading: boolean) => void,
  setOrderDataError: (error: string | null) => void
): Promise<any> {
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
    });

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