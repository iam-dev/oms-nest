// Service for fetching enriched orders data from the enriched_order API resource
import { fetchEntities } from './api';
import { API_URL } from './api-config';
import { logger } from '@/utils/logger';
import type { EnrichedOrder } from '@/types/EnrichedOrder';

/** Hydra JSON-LD paginated collection response */
export interface HydraResponse<T> {
  'hydra:member': T[];
  'hydra:totalItems': number;
  'hydra:view'?: {
    '@id'?: string;
    'hydra:first'?: string;
    'hydra:last'?: string;
    'hydra:next'?: string;
    'hydra:previous'?: string;
  };
}

/**
 * The enriched-orders API returns a flat row with `orderId` (the legacy
 * business key) alongside `id` (the primary key).  Extend `EnrichedOrder`
 * to capture that extra runtime field without loosening to `any`.
 */
export interface EnrichedOrderRow extends EnrichedOrder {
  orderId?: number;
  orderStatus?: string;
}

interface GetEnrichedOrdersParams {
  page?: number;
  partial?: boolean;
  filters?: Record<string, string>;
  orderBy?: string;
  order?: 'asc' | 'desc';
  fromDate?: Date;
  toDate?: Date;
  searchTerm?: string;
  bustCache?: boolean;
}

interface SearchFilters {
  orderId?: string | number;
  id?: number;
  orderStatus?: string;
  customerName?: string;
  fitterName?: string;
  supplierName?: string;
  urgent?: boolean;
  saddleFilter?: string;
  fromDate?: Date;
  toDate?: Date;
}

// Function to search for a specific order by ID through multiple pages
export async function searchForOrderByPages(orderId: string | number): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Starting paginated search for order ID:', orderId);
  
  // We'll try the first 10 pages to find the order
  const targetOrderId = Number(orderId);
  const pageLimit = 10;

  for (let page = 1; page <= pageLimit; page++) {
    logger.log(`Searching page ${page} for order ID ${orderId}`);
    
    try {
      // Get the specific page of results
      const response = await fetchEntities({
        entity: 'enriched_orders',
        page,
        extraParams: {
          'order[orderId]': 'desc', // Always sort by orderId descending to make search more efficient
        },
      });
      
      if (!response['hydra:member'] || response['hydra:member'].length === 0) {
        logger.log(`No results on page ${page}, stopping search`);
        break;
      }
      
      logger.log(`Page ${page} has ${response['hydra:member'].length} orders`);
      
      // Check for the order on this page
      const foundOrder = response['hydra:member'].find((order: EnrichedOrderRow) => {
        const currentOrderId = Number(order.orderId);
        return currentOrderId === targetOrderId;
      });

      // Sample a few orders to see what's on this page
      if (page === 1 || page % 3 === 0) { // Log first page and every third page
        const orderIds = response['hydra:member'].map((order: EnrichedOrderRow) => Number(order.orderId)).sort((a: number, b: number) => a - b);
        logger.log(`Sample order IDs on page ${page}: ${orderIds.slice(0, 5)}...`);
        logger.log(`Order ID range on page ${page}: ${Math.min(...orderIds)} - ${Math.max(...orderIds)}`);
      }
      
      if (foundOrder) {
        logger.log(`Found order ${orderId} on page ${page}:`, foundOrder);
        
        // Return a properly formatted response with just the found order
        return {
          'hydra:member': [foundOrder],
          'hydra:totalItems': 1,
          'hydra:view': response['hydra:view'] ? {
            'hydra:first': response['hydra:view']['hydra:first'],
            'hydra:last': response['hydra:view']['hydra:first']
          } : undefined
        };
      }
      
      // Check if we've gone past where the order would be
      // Since we're sorting by orderId desc, if the lowest orderId on this page is already less than our target
      // then we won't find it in later pages either
      const lowestOrderIdOnPage = Math.min(...response['hydra:member'].map((order: EnrichedOrderRow) => Number(order.orderId)));
      
      if (lowestOrderIdOnPage < targetOrderId) {
        logger.log(`Lowest order ID on page ${page} (${lowestOrderIdOnPage}) is already below target ${targetOrderId}, stopping search`);
        break;
      }
    } catch (error) {
      logger.error(`Error searching page ${page}:`, error);
      throw error;
    }
  }
  
  logger.log(`Order ${orderId} not found after searching ${pageLimit} pages`);
  
  // Return empty result if order not found
  return {
    'hydra:member': [],
    'hydra:totalItems': 0
  };
}

// Accept filters and pass to fetchEntities for the enriched_order entity
export async function getEnrichedOrders(params: GetEnrichedOrdersParams = {}) {
  logger.log('enrichedOrders.ts: getEnrichedOrders called with params:', params);
  
  // Format filters for API Platform
  const formattedFilters = { ...params.filters };
  logger.log('enrichedOrders.ts: Initial formattedFilters:', formattedFilters);

  // Fitter filtering is handled server-side via RLS and the authenticated cookie session

  // Order ID search: pass orderId directly to the backend API which supports exact match filtering
  // (Previously used searchForOrderByPages which was limited to scanning 10 pages client-side)

  // Extract searchTerm from filters to pass as top-level parameter
  // This ensures it gets converted to the 'search' parameter the backend expects
  const searchTermFromFilters = formattedFilters.searchTerm;
  delete formattedFilters.searchTerm;

  // Process filter parameters for API Platform
  // Remove array notation that prevents server-side filtering
  const cleanedFilters: Record<string, string> = {};

  Object.keys(formattedFilters).forEach(key => {
    const value = formattedFilters[key];
    if (value !== undefined && value !== null && value !== '') {
      logger.log(`Filtering by ${key}:`, value);
      // Use direct field names without array notation for proper API Platform filtering
      cleanedFilters[key] = value;
    }
  });

  // Replace formattedFilters with cleaned version
  Object.keys(formattedFilters).forEach(key => delete formattedFilters[key]);
  Object.assign(formattedFilters, cleanedFilters);

  // Add sorting parameters for the enriched_orders NestJS endpoint
  if (params.orderBy) {
    formattedFilters['orderBy'] = params.orderBy;
    formattedFilters['orderDirection'] = params.order === 'asc' ? 'ASC' : 'DESC';
  }

  // Use searchTerm from either the filters or the top-level param
  const effectiveSearchTerm = searchTermFromFilters || params.searchTerm;
  logger.log('enrichedOrders.ts: Final API request parameters:', formattedFilters, 'searchTerm:', effectiveSearchTerm);

  // When bustCache is true, pass noCache to bypass backend Redis cache entirely
  const extraParams = params.bustCache
    ? { ...formattedFilters, noCache: 'true' }
    : formattedFilters;

  const response = await fetchEntities({
    entity: 'enriched_orders',
    page: params.page,
    partial: params.partial,
    extraParams,
    searchTerm: effectiveSearchTerm,
  });
  
  logger.log('enrichedOrders.ts: API response received:', {
    totalItems: response['hydra:totalItems'],
    memberCount: response['hydra:member']?.length,
    firstOrderStatuses: response['hydra:member']?.slice(0, 3).map((order: EnrichedOrderRow) => order.orderStatus)
  });
  
  // Server-side filtering should now work properly without array notation
  logger.log('enrichedOrders.ts: Server-side filtering should handle the request properly');
  
  return response;
}

// ========== FILTER OPTIONS ==========

export interface FilterOptions {
  fitters: string[];
  customers: string[];
  saddles: string[];
  customerCountries: string[];
  fitterCountries: string[];
  kneeRolls: string[];
  leatherTypes: string[];
  factories: string[];
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const response = await fetch(`${API_URL}/api/v1/enriched_orders/filter-options`, {
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch filter options: ${response.status}`);
  }

  return response.json();
}

// ========== BULK STATUS UPDATE ==========

export async function bulkUpdateOrderStatus(
  orderIds: number[],
  status: string,
): Promise<{ success: boolean; updated: number; failed: number; results: Array<{ orderId: number; success: boolean; error?: string }> }> {
  logger.log('Bulk updating order statuses:', { orderIds, status });

  const response = await fetch(`${API_URL}/api/v1/enriched_orders/bulk-update-status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ orderIds, status }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to bulk update statuses: ${response.status}`);
  }

  return response.json();
}

// ========== UPDATE ORDER ==========

export interface UpdateOrderPayload {
  fitterId?: number;
  saddleId?: number;
  leatherId?: number;
  fitterStock?: boolean;
  demo?: boolean;
  repair?: boolean;
  rushed?: boolean;
  sponsored?: boolean;
  customOrder?: boolean;
  specialNotes?: string;
  horseName?: string;
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerZipcode?: string;
  customerCountry?: string;
  customerPhone?: string;
  customerCell?: string;
  customerId?: number;
  shipName?: string;
  shipAddress?: string;
  shipCity?: string;
  shipState?: string;
  shipZipcode?: string;
  shipCountry?: string;
  orderReference?: string;
  orderStatus?: string;
  /**
   * Optimistic-concurrency precondition sent alongside `orderStatus`: the status the
   * order was in when the edit form loaded. The server rejects the update with 409
   * if the order has since moved to a different status.
   */
  expectedStatus?: string;
  priceSaddle?: number;
  priceTradein?: number;
  priceDeposit?: number;
  priceDiscount?: number;
  priceFittingeval?: number;
  priceCallfee?: number;
  priceGirth?: number;
  priceShipping?: number;
  priceTax?: number;
  priceAdditional?: number;
  saddleOptions?: Array<{
    optionId: number;
    optionItemId: number;
    custom?: string;
  }>;
  seatSizes?: string[];
  repairSourceOrderId?: number;
}

export async function createOrderFromPayload(
  payload: UpdateOrderPayload,
): Promise<{ success: boolean; orderId: number }> {
  logger.log('Creating new order');

  const response = await fetch(`${API_URL}/api/v1/enriched_orders/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create order: ${response.status}`);
  }

  return response.json();
}

export async function createDraftOrder(
  sourceOrderId: number,
): Promise<{ success: boolean; orderId: number }> {
  logger.log('Creating draft order from source:', sourceOrderId);

  const response = await fetch(`${API_URL}/api/v1/enriched_orders/draft-from/${sourceOrderId}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create draft order: ${response.status}`);
  }

  return response.json();
}

export async function bulkCreateDraftOrders(
  sourceOrderId: number,
  count: number,
): Promise<{ success: boolean; orderIds: number[] }> {
  logger.log('Creating bulk draft orders from source:', sourceOrderId, 'count:', count);

  const response = await fetch(`${API_URL}/api/v1/enriched_orders/bulk-draft-from/${sourceOrderId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ count }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to bulk create draft orders: ${response.status}`);
  }

  return response.json();
}

/**
 * Thrown when the server rejects an update because the order's status moved on
 * while the edit form was open (HTTP 409).
 */
export class OrderStatusConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderStatusConflictError';
  }
}

export async function updateOrder(
  orderId: number,
  payload: UpdateOrderPayload,
): Promise<{ success: boolean; orderId: number }> {
  logger.log('Updating order:', orderId);

  const response = await fetch(`${API_URL}/api/v1/enriched_orders/update/${orderId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 409) {
      throw new OrderStatusConflictError(
        errorData.message || 'This order was changed by someone else.',
      );
    }
    throw new Error(errorData.message || `Failed to update order: ${response.status}`);
  }

  return response.json();
}

// ========== SINGLE ORDER DETAIL ==========

export interface OrderDetailData {
  id: number;
  orderId: number;
  orderTime: string | null;
  urgent: boolean;
  specialNotes: string | null;
  serialNumber: string | null;
  customOrder: boolean;
  repair: boolean;
  demo: boolean;
  sponsored: boolean;
  fitterStock: boolean;
  orderStep: number | null;
  currency: string | null;
  fitterReference: string | null;
  orderData: Record<string, unknown> | null;

  // Order address
  orderName: string | null;
  horseName: string | null;
  orderAddress: string | null;
  orderCity: string | null;
  orderState: string | null;
  orderZipcode: string | null;
  orderCountry: string | null;
  orderPhone: string | null;
  orderCell: string | null;
  orderEmail: string | null;

  // Shipping
  shipName: string | null;
  shipAddress: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipZipcode: string | null;
  shipCountry: string | null;

  // Pricing
  priceSaddle: number;
  priceTradein: number;
  priceDeposit: number;
  priceDiscount: number;
  priceFittingeval: number;
  priceCallfee: number;
  priceGirth: number;
  priceShipping: number;
  priceTax: number;
  priceAdditional: number;
  totalPrice: number;

  // Status
  orderStatus: string | null;
  statusId: number | null;

  // Customer
  customerId: number | null;
  customerName: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  customerState: string | null;
  customerZipcode: string | null;
  customerCountry: string | null;
  customerPhone: string | null;
  customerCell: string | null;

  // Fitter
  fitterId: number | null;
  fitterName: string | null;
  fitterUsername: string | null;
  fitterEmail: string | null;
  fitterAddress: string | null;
  fitterCity: string | null;
  fitterState: string | null;
  fitterZipcode: string | null;
  fitterCountry: string | null;
  fitterPhone: string | null;
  fitterCell: string | null;
  fitterCurrency: string | null;

  // Factory
  factoryId: number | null;
  factoryName: string | null;
  factoryUsername: string | null;

  // Saddle
  saddleId: number | null;
  brandName: string | null;
  modelName: string | null;
  saddleType: string | null;

  // Leather
  leatherId: number | null;
  leatherName: string | null;

  // Repair linking
  repairSourceOrderId: number | null;
  repairOrderIds: number[] | null;

  // Saddle specifications from orders_info
  saddleSpecs: Array<{
    optionId: number;
    optionName: string;
    optionItemId: number;
    itemName: string | null;
    leatherName: string | null;
    custom: string;
    sequence: number;
    displayValue: string;
  }>;

  // Related data
  comments: Array<{
    id: number;
    content: string;
    type: string;
    isInternal: boolean;
    createdAt: string;
    updatedAt: string;
    userName: string | null;
  }>;
  logEntries: Array<{
    id: number;
    content: string;
    createdAt: string;
    userName: string | null;
    userType: number;
    onlyFor: number;
  }>;
}

/**
 * Fetch comprehensive order detail data for the order detail view
 */
export async function fetchOrderDetail(orderId: number): Promise<OrderDetailData> {
  logger.log('Fetching order detail for:', orderId);

  const response = await fetch(`${API_URL}/api/v1/enriched_orders/detail/${orderId}`, {
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch order detail: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data as OrderDetailData;
}

// ========== COMPREHENSIVE SEARCH FUNCTIONS ==========

// Search by specific order ID (numeric)
export async function searchByOrderId(orderId: string | number): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Searching by Order ID:', orderId);
  return getEnrichedOrders({
    filters: { orderId: String(orderId) },
    orderBy: 'orderId',
    order: 'desc'
  });
}

// Search by order status
export async function searchByOrderStatus(status: string): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Searching by Order Status:', status);
  
  // Try the exact status first
  let result = await getEnrichedOrders({
    filters: { orderStatus: status },
    orderBy: 'orderId',
    order: 'desc'
  });
  
  // If no results and it looks like a constant format, try variations
  if (result['hydra:totalItems'] === 0 || result['hydra:member']?.length === 0) {
    logger.log('No results for exact status, trying variations for:', status);
    
    // Try lowercase
    const lowerStatus = status.toLowerCase();
    if (lowerStatus !== status) {
      result = await getEnrichedOrders({
        filters: { orderStatus: lowerStatus },
        orderBy: 'orderId',
        order: 'desc'
      });
      
      if (result['hydra:totalItems'] > 0) {
        logger.log('Found results with lowercase status:', lowerStatus);
        return result;
      }
    }
    
    // Try snake_case
    const snakeStatus = status.toLowerCase().replace(/\s+/g, '_');
    if (snakeStatus !== status && snakeStatus !== lowerStatus) {
      result = await getEnrichedOrders({
        filters: { orderStatus: snakeStatus },
        orderBy: 'orderId',
        order: 'desc'
      });
      
      if (result['hydra:totalItems'] > 0) {
        logger.log('Found results with snake_case status:', snakeStatus);
        return result;
      }
    }
    
    // Try replacing underscores with spaces for readable format
    const spaceStatus = status.replace(/_/g, ' ');
    if (spaceStatus !== status) {
      result = await getEnrichedOrders({
        filters: { orderStatus: spaceStatus },
        orderBy: 'orderId',
        order: 'desc'
      });
      
      if (result['hydra:totalItems'] > 0) {
        logger.log('Found results with space-separated status:', spaceStatus);
        return result;
      }
    }
  }
  
  return result;
}

// Search by customer name
export async function searchByCustomerName(customerName: string): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Searching by Customer Name:', customerName);
  return getEnrichedOrders({
    filters: { customerName },
    orderBy: 'orderId',
    order: 'desc'
  });
}

// Search by fitter name
export async function searchByFitterName(fitterName: string): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Searching by Fitter Name:', fitterName);
  return getEnrichedOrders({
    filters: { fitterName },
    orderBy: 'orderId',
    order: 'desc'
  });
}

// Search by supplier name
export async function searchBySupplier(supplierName: string): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Searching by Supplier Name:', supplierName);
  return getEnrichedOrders({
    filters: { supplierName },
    orderBy: 'orderId',
    order: 'desc'
  });
}

// Search by date range
export async function searchByDateRange(fromDate: Date, toDate: Date): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Searching by Date Range:', fromDate, 'to', toDate);
  
  const fromDateStr = fromDate.toISOString().split('T')[0];
  const toDateStr = toDate.toISOString().split('T')[0];
  
  return getEnrichedOrders({
    filters: {
      'orderTime[after]': fromDateStr,
      'orderTime[before]': toDateStr
    },
    orderBy: 'orderTime',
    order: 'desc'
  });
}

// Search by urgent status
export async function searchByUrgentStatus(urgent: boolean): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Searching by Urgent Status:', urgent);
  return getEnrichedOrders({
    filters: { urgent: urgent ? 'true' : 'false' },
    orderBy: 'orderId',
    order: 'desc'
  });
}

// Universal search that tries multiple fields
export async function universalSearch(searchTerm: string): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Performing universal search for:', searchTerm);
  
  // If search term is numeric, search by order ID
  if (/^\d+$/.test(searchTerm)) {
    logger.log('Numeric search term detected, searching by order ID');
    const orderIdResult = await searchByOrderId(searchTerm);
    if (orderIdResult['hydra:member'] && orderIdResult['hydra:member'].length > 0) {
      logger.log('Found results by order ID');
      return orderIdResult;
    }
    logger.log('No results by order ID, continuing with general search');
  }
  
  // For text searches, try multiple strategies
  logger.log('Text search term detected, trying multiple search strategies');
  
  // Strategy 1: Use backend search parameter if available
  try {
    logger.log('Strategy 1: Using backend search parameter');
    const searchResult = await getEnrichedOrders({
      searchTerm,
      orderBy: 'orderId',
      order: 'desc',
      page: 1,
      partial: false
    });
    
    if (searchResult['hydra:member'] && searchResult['hydra:member'].length > 0) {
      logger.log('Backend search returned results:', searchResult['hydra:member'].length);
      return searchResult;
    }
    logger.log('Backend search returned no results, trying individual field searches');
  } catch (error) {
    logger.log('Backend search failed, trying individual field searches:', error);
  }
  
  // Strategy 2: Try individual field searches and combine results
  const searchPromises = [
    searchByCustomerName(searchTerm).catch(() => ({ 'hydra:member': [], 'hydra:totalItems': 0 })),
    searchByFitterName(searchTerm).catch(() => ({ 'hydra:member': [], 'hydra:totalItems': 0 })),
    searchBySupplier(searchTerm).catch(() => ({ 'hydra:member': [], 'hydra:totalItems': 0 }))
  ];
  
  try {
    const results = await Promise.all(searchPromises);
    logger.log('Individual field search results:', results.map(r => r['hydra:totalItems']));
    
    // Combine all results, removing duplicates by orderId
    const allOrders = new Map<number | undefined, EnrichedOrderRow>();
    let totalItems = 0;

    results.forEach(result => {
      if (result['hydra:member']) {
        result['hydra:member'].forEach((order: EnrichedOrderRow) => {
          if (!allOrders.has(order.orderId)) {
            allOrders.set(order.orderId, order);
            totalItems++;
          }
        });
      }
    });
    
    const combinedResults = {
      'hydra:member': Array.from(allOrders.values()),
      'hydra:totalItems': totalItems
    };
    
    logger.log('Combined search results:', combinedResults['hydra:totalItems']);
    return combinedResults;
    
  } catch (error) {
    logger.error('All search strategies failed:', error);
    return {
      'hydra:member': [],
      'hydra:totalItems': 0
    };
  }
}

// Advanced search with multiple filters
export async function advancedSearch(filters: SearchFilters): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Performing advanced search with filters:', filters);
  
  const searchFilters: Record<string, string> = {};
  
  // Add all provided filters
  if (filters.orderId) searchFilters.orderId = String(filters.orderId);
  if (filters.id) searchFilters.id = String(filters.id);
  if (filters.orderStatus) searchFilters.orderStatus = filters.orderStatus;
  if (filters.customerName) searchFilters.customerName = filters.customerName;
  if (filters.fitterName) searchFilters.fitterName = filters.fitterName;
  if (filters.supplierName) searchFilters.supplierName = filters.supplierName;
  if (filters.urgent !== undefined) searchFilters.urgent = String(filters.urgent);
  if (filters.saddleFilter) {
    // Saddle filter could include seat sizes, brands, models, etc.
    searchFilters.seatSizes = filters.saddleFilter;
  }
  
  // Handle date range
  if (filters.fromDate) {
    searchFilters['orderTime[after]'] = filters.fromDate.toISOString().split('T')[0];
  }
  if (filters.toDate) {
    searchFilters['orderTime[before]'] = filters.toDate.toISOString().split('T')[0];
  }
  
  return getEnrichedOrders({
    filters: searchFilters,
    orderBy: 'orderId',
    order: 'desc'
  });
}

// Dashboard-specific search for status filtering
export async function getOrdersByStatus(status: string): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Getting orders by status for dashboard:', status);
  return searchByOrderStatus(status);
}

// Helper function to get all unique status values from the API (for debugging)
export async function getAllStatusValues(): Promise<string[]> {
  try {
    const response = await getEnrichedOrders({
      page: 1,
      partial: false,
      // Get first page without filters to see what status values exist
    });
    
    const statusValues = new Set<string>();
    if (response['hydra:member']) {
      response['hydra:member'].forEach((order: EnrichedOrderRow) => {
        if (order.orderStatus) {
          statusValues.add(order.orderStatus);
        }
      });
    }
    
    const uniqueStatuses = Array.from(statusValues).sort();
    logger.log('getAllStatusValues: Found unique status values:', uniqueStatuses);
    return uniqueStatuses;
  } catch (error) {
    logger.error('getAllStatusValues: Error fetching status values:', error);
    return [];
  }
}

// Search with pagination support for large datasets
export async function paginatedSearch(searchParams: SearchFilters & { page?: number; limit?: number }): Promise<HydraResponse<EnrichedOrderRow>> {
  logger.log('Performing paginated search:', searchParams);
  
  const filters = { ...searchParams };
  delete filters.page;

  return advancedSearch({
    ...filters,
    // Add pagination to the search
  });
}
