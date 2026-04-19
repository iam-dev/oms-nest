import { fetchEntities } from './api';
import { API_URL, fetchWithRefresh } from './api-config';
import { logger } from '@/utils/logger';

export interface Fitter {
  id: number;
  name: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  state?: string;
  zipcode?: string;
  phoneNo?: string;
  cellNo?: string;
  enabled?: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FittersResponse {
  'hydra:member': Fitter[];
  'hydra:totalItems': number;
  'hydra:view'?: {
    '@id': string;
    'hydra:first'?: string;
    'hydra:last'?: string;
    'hydra:next'?: string;
    'hydra:previous'?: string;
  };
}

export async function fetchFitters({
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
} = {}): Promise<FittersResponse> {
  logger.log('fetchFitters: Called with params:', { page, searchTerm, filters, orderBy, order });

  // Build filter parameters for API Platform
  const extraParams: Record<string, string | number | boolean> = {};

  // Handle individual field filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim()) {
      logger.log(`fetchFitters: Processing filter ${key}:`, value);
      // For text fields, use partial matching with API Platform filters
      if (key === 'name') {
        extraParams['name[contains]'] = value;
      } else if (key === 'username') {
        extraParams['username[contains]'] = value;
      } else if (key === 'city') {
        extraParams['city[contains]'] = value;
      } else if (key === 'country') {
        extraParams['country[contains]'] = value;
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

  logger.log('fetchFitters: Calling fetchEntities with entity "fitters" and params:', extraParams);

  return await fetchEntities({
    entity: 'fitters',
    page,
    partial: false, // Required for hydra:totalItems in API Platform 2.5.7
    searchTerm,
    orderBy,
    order,
    extraParams
  });
}

export async function fetchFitterCountries(): Promise<string[]> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/fitters/countries`, {
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) return [];
  return response.json();
}

export async function createFitter(fitterData: Record<string, unknown>): Promise<Fitter> {
  logger.log('Creating fitter with data:', fitterData);

  const response = await fetchWithRefresh(`${API_URL}/api/v1/fitters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(fitterData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Fitter creation failed:', response.status, errorText);
    throw new Error(`Failed to create fitter: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  logger.log('Fitter creation successful:', result);
  return result;
}

export async function updateFitter(id: number, fitterData: Partial<Fitter>): Promise<Fitter> {
  logger.log('Updating fitter with ID:', id, 'Data:', fitterData);

  const response = await fetchWithRefresh(`${API_URL}/api/v1/fitters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(fitterData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Fitter update failed:', response.status, errorText);
    throw new Error(`Failed to update fitter: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  logger.log('Fitter update successful:', result);
  return result;
}

export async function blockFitter(id: number): Promise<{ enabled: boolean }> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/fitters/${id}/toggle-block`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Fitter block toggle failed:', response.status, errorText);
    throw new Error(`Failed to toggle fitter block: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function deleteFitter(id: number): Promise<void> {
  logger.log('Deleting fitter with ID:', id);

  const response = await fetchWithRefresh(`${API_URL}/api/v1/fitters/${id}`, {
    method: 'DELETE',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Fitter deletion failed:', response.status, errorText);
    throw new Error(`Failed to delete fitter: ${response.status} ${response.statusText}`);
  }

  logger.log('Fitter deletion successful');
}

/**
 * Get the total count of fitters (for pagination display)
 */
export async function fetchFitterCount(): Promise<number> {
  try {
    logger.log('fetchFitterCount: Getting total fitter count');

    // Get total count using minimal data transfer (limit=1) with full pagination metadata
    const result = await fetchEntities({
      entity: 'fitters',
      page: 1,
      partial: false, // Required for hydra:totalItems in API Platform 2.5.7
      extraParams: {
        'limit': 1, // Minimize data transfer
      },
    });

    // Return the total count if available
    if (result['hydra:totalItems'] !== undefined && result['hydra:totalItems'] !== null) {
      logger.log('Got total fitter count from API:', result['hydra:totalItems']);
      return result['hydra:totalItems'];
    }

    logger.warn('Could not get fitter count from API, using fallback');
    return 0;
  } catch (error) {
    logger.error('Error fetching fitter count:', error);
    return 0;
  }
}
