import { fetchEntities } from './api';
import { API_URL } from './api-config';
import { logger } from '@/utils/logger';

export interface Extra {
  id: string;
  name: string;
  sequence?: number;
  active?: boolean;
  price1?: number;
  price2?: number;
  price3?: number;
  price4?: number;
  price5?: number;
  price6?: number;
  price7?: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExtrasResponse {
  'hydra:member': Extra[];
  'hydra:totalItems': number;
  'hydra:view'?: {
    '@id': string;
    'hydra:first'?: string;
    'hydra:last'?: string;
    'hydra:next'?: string;
    'hydra:previous'?: string;
  };
}

export async function fetchExtras({
  page = 1,
  searchTerm = '',
  filters = {},
  orderBy = 'sequence',
  order = 'asc'
}: {
  page?: number;
  searchTerm?: string;
  filters?: Record<string, string>;
  orderBy?: string;
  order?: 'asc' | 'desc';
} = {}): Promise<ExtrasResponse> {
  logger.log('fetchExtras: Called with params:', { page, searchTerm, filters, orderBy, order });

  // Build filter parameters for API Platform
  const extraParams: Record<string, string | number | boolean> = {};

  // Handle individual field filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim()) {
      logger.log(`fetchExtras: Processing filter ${key}:`, value);
      if (key === 'name') {
        extraParams['name[contains]'] = value;
      } else if (key === 'description') {
        extraParams['description[contains]'] = value;
      } else if (key === 'active') {
        extraParams['active'] = value === 'true';
      } else if (key === 'sequence') {
        extraParams['sequence'] = parseInt(value);
      } else {
        extraParams[key] = value;
      }
    }
  });

  logger.log('fetchExtras: Calling fetchEntities with entity "extras" and params:', extraParams);

  return await fetchEntities({
    entity: 'extras',
    page,
    searchTerm,
    orderBy,
    order,
    extraParams
  });
}

export async function createExtra(extraData: Partial<Extra>): Promise<Extra> {
  const payload = {
    name: extraData.name,
    sequence: extraData.sequence || 0,
    description: extraData.description,
    price1: extraData.price1 ?? 0,
    price2: extraData.price2 ?? 0,
    price3: extraData.price3 ?? 0,
    price4: extraData.price4 ?? 0,
    price5: extraData.price5 ?? 0,
    price6: extraData.price6 ?? 0,
    price7: extraData.price7 ?? 0,
  };

  const response = await fetch(`${API_URL}/api/v1/extras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Extra creation failed:', errorText);
    throw new Error(`Failed to create extra: ${response.statusText}`);
  }

  return await response.json();
}

export async function updateExtra(id: string, extraData: Partial<Extra>): Promise<Extra> {
  const payload: Record<string, any> = {};
  if (extraData.name !== undefined) payload.name = extraData.name;
  if (extraData.description !== undefined) payload.description = extraData.description;
  if (extraData.sequence !== undefined) payload.sequence = extraData.sequence;
  if (extraData.price1 !== undefined) payload.price1 = extraData.price1;
  if (extraData.price2 !== undefined) payload.price2 = extraData.price2;
  if (extraData.price3 !== undefined) payload.price3 = extraData.price3;
  if (extraData.price4 !== undefined) payload.price4 = extraData.price4;
  if (extraData.price5 !== undefined) payload.price5 = extraData.price5;
  if (extraData.price6 !== undefined) payload.price6 = extraData.price6;
  if (extraData.price7 !== undefined) payload.price7 = extraData.price7;

  const response = await fetch(`${API_URL}/api/v1/extras/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Extra update failed:', errorText);
    throw new Error(`Failed to update extra: ${response.statusText}`);
  }

  return await response.json();
}

export async function deleteExtra(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/extras/${id}`, {
    method: 'DELETE',
    headers: { 'Accept': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete extra: ${response.statusText}`);
  }
}
