import { fetchEntities } from './api';
import { API_URL } from './api-config';
import { logger } from '@/utils/logger';

export interface Customer {
  id: string;
  name: string;
  email?: string;
  city?: string;
  country?: string;
  address?: string;
  zipcode?: string;
  state?: string;
  cellNo?: string;
  phoneNo?: string;
  horseName?: string;
  /** Legacy fitters.id the customer belongs to (customers.fitter_id, NOT NULL) */
  fitterId?: number;
  fitter?: {
    id: string;
    name: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomersResponse {
  'hydra:member': Customer[];
  'hydra:totalItems': number;
  'hydra:view'?: {
    '@id': string;
    'hydra:first'?: string;
    'hydra:last'?: string;
    'hydra:next'?: string;
    'hydra:previous'?: string;
  };
}

export async function fetchCustomers({
  page = 1,
  limit,
  searchTerm = '',
  filters = {},
  orderBy = 'name',
  order = 'asc'
}: {
  page?: number;
  // Page size; keep in step with the caller's itemsPerPage so LAST/NEXT land
  // on pages the backend actually has.
  limit?: number;
  searchTerm?: string;
  filters?: Record<string, string>;
  orderBy?: string;
  order?: 'asc' | 'desc';
} = {}): Promise<CustomersResponse> {
  logger.log('fetchCustomers: Called with params:', { page, searchTerm, filters, orderBy, order });
  
  // Build filter parameters for NestJS backend
  const extraParams: Record<string, string | number | boolean> = {};

  // Handle individual field filters (NestJS uses plain query params with ILIKE)
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim()) {
      logger.log(`fetchCustomers: Processing filter ${key}:`, value);
      if (key === 'name' || key === 'email' || key === 'city' || key === 'country') {
        extraParams[key] = value;
      } else if (key === 'id') {
        extraParams['id'] = value;
      } else if (key === 'fitter') {
        extraParams['fitterId'] = value;
      } else {
        extraParams[key] = value;
      }
    }
  });

  if (limit) {
    extraParams.limit = limit;
  }

  logger.log('fetchCustomers: Calling fetchEntities with entity "customers" and params:', extraParams);

  // Pass searchTerm directly to fetchEntities (it appends &search= to the URL).
  // Also pass extraParams which may contain field-specific filters.
  return await fetchEntities({
    entity: 'customers',
    page,
    searchTerm,
    orderBy,
    order,
    extraParams
  });
}

/**
 * Turn a failed customers API response into a message a user can act on.
 * The backend ValidationPipe answers 422 with `{ errors: { field: message } }`
 * and other exceptions with `{ message }`; statusText is empty over HTTP/2,
 * so without reading the body all the user would see is a bare status code.
 */
function describeApiError(action: string, status: number, statusText: string, body: string): string {
  try {
    const parsed = JSON.parse(body) as { errors?: Record<string, string>; message?: string | string[] };
    if (parsed.errors && typeof parsed.errors === 'object') {
      const details = Object.values(parsed.errors).join('; ');
      if (details) return `${action}: ${details}`;
    }
    if (parsed.message) {
      const message = Array.isArray(parsed.message) ? parsed.message.join('; ') : parsed.message;
      return `${action}: ${message}`;
    }
  } catch {
    // Not JSON — fall through to the status line
  }
  return `${action}: ${status} ${statusText}`.trimEnd();
}

export async function createCustomer(customerData: Partial<Customer>): Promise<Customer> {

  logger.log('Creating customer with data:', customerData);

  const response = await fetch(`${API_URL}/api/v1/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(customerData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Customer creation failed:', response.status, errorText);
    throw new Error(describeApiError('Failed to create customer', response.status, response.statusText, errorText));
  }

  const result = await response.json();
  logger.log('Customer creation successful:', result);
  return result;
}

export async function updateCustomer(id: string, customerData: Partial<Customer>): Promise<Customer> {
  logger.log('Updating customer with ID:', id, 'Data:', customerData);

  const response = await fetch(`${API_URL}/api/v1/customers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(customerData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Customer update failed:', response.status, errorText);
    throw new Error(describeApiError('Failed to update customer', response.status, response.statusText, errorText));
  }

  const result = await response.json();
  logger.log('Customer update successful:', result);
  return result;
}


export async function deleteCustomer(id: string): Promise<void> {
  logger.log('Deleting customer with ID:', id);

  const response = await fetch(`${API_URL}/api/v1/customers/${id}`, {
    method: 'DELETE',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Customer deletion failed:', response.status, errorText);
    throw new Error(describeApiError('Failed to delete customer', response.status, response.statusText, errorText));
  }

  logger.log('Customer deletion successful');
}

