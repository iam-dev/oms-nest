// Centralized API service for Orders, Reports, Dashboard
import { logger } from '@/utils/logger';
import { API_URL, fetchWithRefresh } from './api-config';

// Default request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT_MS = 30000;

// Helper function to safely escape strings for OData filters
function escapeODataString(str: string): string {
  if (typeof str !== 'string') {
    return String(str).replace(/'/g, "''");
  }
  // Escape single quotes by doubling them (OData standard)
  // Also remove potentially dangerous characters
  return str.replace(/'/g, "''").replace(/[<>]/g, '');
}

// Helper: build REST API filter parameters from filters object
function buildOrderFilterParams(filters: Record<string, string>): Record<string, string> {
  const params: Record<string, string> = {};

  // Status filters (multiple statuses: comma separated)
  if (filters.orderStatus) {
    const statuses = filters.orderStatus.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length > 0) {
      params['orderStatus'] = statuses.join(',');
    }
  }

  // Text search filters
  if (filters.fitter) {
    params['fitter'] = filters.fitter;
  }
  if (filters.customer) {
    params['customer'] = filters.customer;
  }
  if (filters.seatSize) {
    params['seatSize'] = filters.seatSize;
  }

  return params;
}

// Enhanced filter builder for enriched orders using REST API parameters
function buildEnrichedOrderFilters(filters: Record<string, any>): Record<string, any> {
  const apiFilters: Record<string, any> = {};

  // Direct field mappings for NestJS backend
  const directMappings = [
    'orderId', 'orderStatus', 'customerName', 'fitterName',
    'supplierName', 'urgent', 'reference', 'fitterReference'
  ];

  directMappings.forEach(field => {
    if (filters[field] !== undefined && filters[field] !== null && filters[field] !== '') {
      // Handle boolean values specially for urgent field
      if (field === 'urgent' && typeof filters[field] === 'boolean') {
        apiFilters[field] = filters[field];
      } else {
        apiFilters[field] = String(filters[field]);
      }
    }
  });

  // Handle special cases
  if (filters.id) {
    // IDs are now integers - convert to string for API
    apiFilters['id'] = String(filters.id);
  }

  if (filters.seatSizes) {
    apiFilters['seatSizes'] = filters.seatSizes;
  }

  // Handle date ranges for NestJS API
  if (filters.orderTimeAfter) {
    apiFilters['orderTimeAfter'] = filters.orderTimeAfter;
  }

  if (filters.orderTimeBefore) {
    apiFilters['orderTimeBefore'] = filters.orderTimeBefore;
  }

  return apiFilters;
}

// Universal search helper
function buildUniversalSearchFilters(searchTerm: string, entity: string): Record<string, string> {
  const filters: Record<string, string> = {};

  if (!searchTerm) return filters;

  // If it's a number, likely an ID (order ID, user ID, etc.)
  if (/^\d+$/.test(searchTerm)) {
    if (entity === 'enriched_orders') {
      filters['orderId'] = searchTerm;
    } else {
      filters['id'] = searchTerm;
    }
    return filters;
  }

  // For text searches, we'll handle this in the client-side filtering
  // since API Platform doesn't have great cross-field search
  return {};
}

export async function fetchOrders({ page = 1, partial = true, filters = {} } = {}) {
  const url = new URL(`${API_URL}/api/v1/orders`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('order[orderId]', 'desc');

  // Add filters as query parameters
  const filterParams = buildOrderFilterParams(filters);
  Object.entries(filterParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchWithRefresh(url.toString(), {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchOrderStatusStats() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchWithRefresh(`${API_URL}/api/v1/orders/stats`, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('Failed to fetch order status stats');
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Placeholder for future reports API
export async function fetchReports(params: Record<string, any> = {}) {
  // Example endpoint, adjust as needed
  const url = new URL(`${API_URL}/api/v1/reports`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, String(value)));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchWithRefresh(url.toString(), {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('Failed to fetch reports');
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

interface FetchEntitiesParams {
  entity: string;
  page?: number;
  partial?: boolean;
  orderBy?: string;
  filter?: string;
  extraParams?: Record<string, string | number | boolean>;
  order?: 'asc' | 'desc';
  searchTerm?: string;
  dateRange?: {
    field: string;
    from?: Date;
    to?: Date;
  };
  multiSort?: Array<{
    field: string;
    order: 'asc' | 'desc';
  }>;
}

// Generic entity fetcher for any resource (customers, fitters, users, brands, etc)
export async function fetchEntities({
  entity,
  page = 1,
  partial = true,
  orderBy = '',
  filter = '',
  extraParams = {},
  order = 'desc', // Default to descending order
  searchTerm = '',
  dateRange,
  multiSort = [],
}: FetchEntitiesParams) {
  // Check if pagination is explicitly set in extraParams, default to true
  const paginationEnabled = extraParams.pagination !== undefined ? extraParams.pagination : true;
  let url = `${API_URL}/api/v1/${entity}?pagination=${paginationEnabled}&page=${page}&partial=${partial}`;
  
  // Handle multiple sorting (if provided, takes priority over single sort)
  if (multiSort.length > 0) {
    multiSort.forEach(sortItem => {
      url += `&order[${sortItem.field}]=${sortItem.order}`;
    });
  } else if (orderBy) {
    // Handle single sorting
    if (extraParams.order) {
      try {
        const orderObj = JSON.parse(extraParams.order as string);
        const [sortField, sortOrder] = Object.entries(orderObj)[0];
        url += `&order[${sortField}]=${sortOrder}`;
      } catch (e) {
        logger.warn('Invalid order parameter format, using default');
        url += `&order[${orderBy}]=${order}`;
      }
    } else {
      // Otherwise use the orderBy and order parameters
      url += `&order[${orderBy}]=${order}`;
    }
  }
  
  // Handle date range filtering
  if (dateRange) {
    if (dateRange.from) {
      const fromDate = dateRange.from.toISOString().split('T')[0];
      url += `&${dateRange.field}[after]=${encodeURIComponent(fromDate)}`;
    }
    if (dateRange.to) {
      const toDate = dateRange.to.toISOString().split('T')[0];
      url += `&${dateRange.field}[before]=${encodeURIComponent(toDate)}`;
    }
  }
  
  // Handle universal search term
  if (searchTerm) {
    // For text search, we'll use a broad search approach
    // This can be customized per entity type
    if (entity === 'enriched_orders') {
      // For orders, search across multiple text fields
      url += `&search=${encodeURIComponent(searchTerm)}`;
    } else {
      // For other entities, use a generic search parameter
      url += `&search=${encodeURIComponent(searchTerm)}`;
    }
  }
  
  // Add legacy filter if provided
  if (filter) url += `&${filter}`;
  
  // Add any extra parameters
  for (const [k, v] of Object.entries(extraParams)) {
    // Skip parameters we've already handled
    if (k === 'order' || k === 'search' || k === 'pagination') continue;
    url += `&${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;
  }

  logger.log('fetchEntities: Fetching URL:', url.toString());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchWithRefresh(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
      credentials: 'include',
      signal: controller.signal,
    });

    logger.log(`fetchEntities: Response status for ${entity}:`, res.status, res.statusText);
    logger.log('fetchEntities: Response headers:', Object.fromEntries(res.headers.entries()));

    if (!res.ok) {
      let errorResponseText = '';
      try {
        errorResponseText = await res.text();
        logger.error(`fetchEntities: Error response body for ${entity}:`, errorResponseText);
      } catch (e) {
        logger.error(`fetchEntities: Could not read error response body for ${entity}:`, e);
      }

      if (res.status === 401) {
        throw new Error(`Authentication required for ${entity}. Please log in.`);
      } else if (res.status === 403) {
        throw new Error(`Access denied for ${entity}. Insufficient permissions.`);
      } else if (res.status === 500) {
        logger.error(`fetchEntities: 500 Error Details for ${entity}:`, {
          url,
          status: res.status,
          statusText: res.statusText,
          responseBody: errorResponseText,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Server error when fetching ${entity}. Please try again later.`);
      } else {
        throw new Error(`Failed to fetch ${entity}: ${res.status} ${res.statusText}`);
      }
    }

    const result = await res.json();

    // Special handling for users entity to map name to firstName/lastName
    if (entity === 'users' && result['hydra:member'] && Array.isArray(result['hydra:member'])) {
      result['hydra:member'] = result['hydra:member'].map((backendUser: any) => {
        // Split name into firstName and lastName
        const nameParts = (backendUser.name || '').split(' ').filter((part: string) => part.length > 0);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        return {
          ...backendUser,
          firstName: firstName,
          lastName: lastName,
        };
      });
    }

    // Special handling for factories entity to map backend fields to Supplier interface
    if (entity === 'factories' && result.data && Array.isArray(result.data)) {
      // Transform NestJS response format to Hydra format with mapped fields
      result['hydra:member'] = result.data.map((factory: any) => ({
        ...factory,
        name: factory.displayName || factory.name || `Factory ${factory.id}`,
        email: factory.emailaddress || factory.email,
        enabled: factory.isActive ?? true,
        username: factory.emailaddress?.split('@')[0] || `factory${factory.id}`,
      }));
      result['hydra:totalItems'] = result.total || result.data.length;
      // Remove the original data property to avoid confusion
      delete result.data;
    }

    // Special handling for fitters entity to transform NestJS response to Hydra format
    if (entity === 'fitters' && result.data && Array.isArray(result.data)) {
      result['hydra:member'] = result.data.map((fitter: any) => ({
        ...fitter,
        name: fitter.displayName || `Fitter ${fitter.id}`,
        email: fitter.emailaddress || fitter.email,
        enabled: fitter.isActive ?? true,
        username: fitter.emailaddress?.split('@')[0] || `fitter${fitter.id}`,
      }));
      result['hydra:totalItems'] = result.total || result.data.length;
      delete result.data;
    }

    // Special handling for customers entity to transform NestJS response to Hydra format
    if (entity === 'customers' && result.data && Array.isArray(result.data)) {
      result['hydra:member'] = result.data;
      result['hydra:totalItems'] = result.total || result.data.length;
      delete result.data;
    }

    // Special handling for presets entity to map backend fields to frontend interface
    if (entity === 'presets' && result.data && Array.isArray(result.data)) {
      result['hydra:member'] = result.data.map((preset: any) => ({
        ...preset,
        active: preset.isActive ?? (preset.deleted === 0),
      }));
      result['hydra:totalItems'] = result.total || result.data.length;
      delete result.data;
    }

    // Generic transformation for any entity returning NestJS format { data: [], total, pages }
    if (!result['hydra:member'] && result.data && Array.isArray(result.data)) {
      result['hydra:member'] = result.data;
      result['hydra:totalItems'] = result.total || result.data.length;
      delete result.data;
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Function to update an order
export async function updateOrder(orderId: number | string, updateData: Record<string, any>) {
  const url = `${API_URL}/api/v1/orders/${orderId}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchWithRefresh(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updateData),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to update order: ${res.status} ${errorText}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Function to create a new order
export async function createOrder(orderData: Record<string, any>) {
  const url = `${API_URL}/api/v1/orders`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchWithRefresh(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify(orderData),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to create order: ${res.status} ${errorText}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Function to create a new customer
export async function createCustomer(customerData: Record<string, any>) {
  const url = `${API_URL}/api/v1/customers`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchWithRefresh(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify(customerData),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to create customer: ${res.status} ${errorText}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
