import { API_URL } from './api-config';
import { logger } from '@/utils/logger';

export interface Factory {
  id: number;
  displayName: string;
  city?: string;
  country?: string;
}

export interface FactoriesResponse {
  'hydra:member': Factory[];
  'hydra:totalItems': number;
}

// Internal response type from NestJS backend
interface NestJSFactoriesResponse {
  data: Array<{
    id: number;
    displayName: string;
    city?: string;
    country?: string;
  }>;
  total: number;
  pages: number;
}

/**
 * Fetch all factories for dropdown/lookup
 */
export async function fetchFactories(): Promise<FactoriesResponse> {
  logger.log('fetchFactories: Fetching factories');

  // Get all factories for dropdown
  const params = new URLSearchParams();
  params.set('page', '1');
  params.set('limit', '100');

  const response = await fetch(`${API_URL}/api/v1/factories?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('fetchFactories: Failed to fetch factories:', errorText);
    throw new Error(`Failed to fetch factories: ${response.status} ${response.statusText}`);
  }

  const factoryData: NestJSFactoriesResponse = await response.json();
  logger.log('fetchFactories: Received factory data:', factoryData);

  // Transform to Hydra format expected by frontend
  const factories: Factory[] = factoryData.data.map(factory => ({
    id: factory.id,
    displayName: factory.displayName,
    city: factory.city,
    country: factory.country,
  }));

  return {
    'hydra:member': factories,
    'hydra:totalItems': factoryData.total,
  };
}

/**
 * Create a lookup map of factory ID to factory name
 */
export function createFactoryLookup(factories: Factory[]): Map<number, string> {
  const lookup = new Map<number, string>();
  factories.forEach(factory => {
    lookup.set(factory.id, factory.displayName);
  });
  return lookup;
}
