import { fetchEntities } from './api';
import { API_URL, fetchWithRefresh } from './api-config';
import { logger } from '@/utils/logger';

/**
 * A factory ("supplier" in older UI code). Address data lives on the
 * `factories` row; name, username, enabled and lastLogin come from the linked
 * login account and are attached by the backend.
 */
export interface Supplier {
  id: number; // INTEGER - matching legacy database
  userId?: number;
  name: string;
  username: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  state?: string;
  zipcode?: string;
  phoneNo?: string;
  cellNo?: string;
  /** Legacy currency id (factories.currency); not editable in the UI */
  currency?: number;
  enabled?: boolean;
  lastLogin?: string | number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Body accepted by POST/PATCH /factories (mirrors the backend Create/UpdateFactoryDto).
 * Note the backend field is `emailaddress`, not `email`.
 */
export interface FactoryApiPayload {
  username?: string;
  name?: string;
  emailaddress?: string;
  address?: string;
  city?: string;
  country?: string;
  state?: string;
  zipcode?: string;
  phoneNo?: string;
  cellNo?: string;
  enabled?: boolean;
}

/**
 * Translate the edit/create form's Supplier shape into the backend DTO shape.
 *
 * The backend validation pipe runs with `whitelist: true`, so any key the DTO
 * does not declare is dropped *silently*: sending `email` instead of
 * `emailaddress` returns 200 while the change is lost. Funnel every save
 * through this helper so the two field vocabularies cannot drift.
 * Undefined values are omitted so a PATCH never blanks untouched columns.
 */
export function toFactoryApiPayload(supplier: Partial<Supplier>): FactoryApiPayload {
  const payload: FactoryApiPayload = {
    username: supplier.username,
    name: supplier.name,
    emailaddress: supplier.email,
    address: supplier.address,
    city: supplier.city,
    country: supplier.country,
    state: supplier.state,
    zipcode: supplier.zipcode,
    phoneNo: supplier.phoneNo,
    cellNo: supplier.cellNo,
    enabled: supplier.enabled,
  };
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as FactoryApiPayload;
}

/**
 * Build a readable Error from a failed factory API response. NestJS returns
 * `{ message }` for 400/404 and `{ errors: { field: msg } }` for 422.
 */
async function factoryApiError(action: string, response: Response): Promise<Error> {
  const text = await response.text();
  logger.error(`Factory ${action} failed:`, response.status, text);
  let detail = `${response.status} ${response.statusText}`;
  try {
    const parsed = JSON.parse(text) as { message?: string; errors?: Record<string, string> };
    if (parsed.errors && typeof parsed.errors === 'object') {
      detail = Object.values(parsed.errors).join(', ');
    } else if (typeof parsed.message === 'string') {
      detail = parsed.message;
    }
  } catch {
    // non-JSON body: keep the status text
  }
  return new Error(`Failed to ${action} factory: ${detail}`);
}

export interface SuppliersResponse {
  'hydra:member': Supplier[];
  'hydra:totalItems': number;
  'hydra:view'?: {
    '@id': string;
    'hydra:first'?: string;
    'hydra:last'?: string;
    'hydra:next'?: string;
    'hydra:previous'?: string;
  };
}

export async function fetchSuppliers({
  page = 1,
  searchTerm = '',
  filters = {},
  orderBy = 'name',
  order = 'asc'
}: {
  page?: number;
  searchTerm?: string;
  filters?: Record<string, string>;
  orderBy?: string;
  order?: 'asc' | 'desc';
} = {}): Promise<SuppliersResponse> {
  logger.log('fetchSuppliers: Called with params:', { page, searchTerm, filters, orderBy, order });
  
  // Build filter parameters for API Platform
  const extraParams: Record<string, string | number | boolean> = {};

  // Handle search term by filtering on name and username
  if (searchTerm && searchTerm.trim()) {
    logger.log(`fetchSuppliers: Processing searchTerm:`, searchTerm);
    // Use name filter for partial matching (the API should support partial matching on name)
    extraParams['name'] = searchTerm.trim();
  }

  // Handle individual field filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim()) {
      logger.log(`fetchSuppliers: Processing filter ${key}:`, value);
      // For text fields, use partial matching
      if (key === 'name' || key === 'username' || key === 'city' || key === 'country') {
        extraParams[key] = value;
      }
      // For status/enabled field
      else if (key === 'status') {
        extraParams['enabled'] = value === 'ACTIVE';
      }
      // For other exact matches
      else {
        extraParams[key] = value;
      }
    }
  });

  logger.log('fetchSuppliers: Calling fetchEntities with entity "factories" and params:', extraParams);

  return await fetchEntities({
    entity: 'factories',
    page,
    orderBy,
    order,
    extraParams
  });
}

export async function createSupplier(supplierData: Partial<Supplier>): Promise<Supplier> {
  const payload = toFactoryApiPayload(supplierData);
  logger.log('Creating factory with data:', payload);

  const response = await fetchWithRefresh(`${API_URL}/api/v1/factories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await factoryApiError('create', response);
  }

  const result = await response.json();
  logger.log('Factory creation successful:', result);
  return result;
}

export async function updateSupplier(id: number | string, supplierData: Partial<Supplier>): Promise<Supplier> {
  // The login name is immutable once created, so never send it on update.
  const { username: _username, ...editable } = supplierData;
  void _username;
  const payload = toFactoryApiPayload(editable);
  logger.log('Updating factory with ID:', id, 'Data:', payload);

  const response = await fetchWithRefresh(`${API_URL}/api/v1/factories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await factoryApiError('update', response);
  }

  const result = await response.json();
  logger.log('Factory update successful:', result);
  return result;
}

export async function blockFactory(id: number | string): Promise<{ enabled: boolean }> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/factories/${id}/toggle-block`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw await factoryApiError('block/unblock', response);
  }

  return response.json();
}

export async function deleteSupplier(id: number | string): Promise<void> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/factories/${id}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw await factoryApiError('delete', response);
  }
}
