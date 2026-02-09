import { API_URL } from './api-config';
import { logger } from '@/utils/logger';

export interface Brand {
  id: string;
  name: string;
  sequence?: number;
  active?: boolean;
  isActive?: boolean;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrandsResponse {
  'hydra:member': Brand[];
  'hydra:totalItems': number;
}

// Internal response type from NestJS backend
interface NestJSBrandsResponse {
  data: Array<{
    id: number;
    name: string;
    isActive: boolean;
    displayName: string;
  }>;
  total: number;
  pages: number;
}

/**
 * Fetch brands from the NestJS backend
 */
export async function fetchBrands({
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
} = {}): Promise<BrandsResponse> {
  logger.log('fetchBrands: Called with params:', { page, searchTerm, filters, orderBy, order });



  // Build query parameters
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '100'); // Get all brands for dropdown

  // Handle search term
  if (searchTerm) {
    params.set('search', searchTerm);
  }

  logger.log('fetchBrands: Calling brands endpoint with params:', params.toString());

  const response = await fetch(`${API_URL}/api/v1/brands?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('fetchBrands: Failed to fetch brands:', errorText);
    throw new Error(`Failed to fetch brands: ${response.status} ${response.statusText}`);
  }

  const brandData: NestJSBrandsResponse = await response.json();
  logger.log('fetchBrands: Received brand data:', brandData);

  // Transform to Hydra format expected by frontend
  const brands: Brand[] = brandData.data.map(brand => ({
    id: String(brand.id),
    name: brand.name,
    isActive: brand.isActive,
    displayName: brand.displayName,
  }));

  // Return in Hydra format expected by frontend components
  return {
    'hydra:member': brands,
    'hydra:totalItems': brandData.total,
  };
}

export async function createBrand(brandData: Partial<Brand>): Promise<Brand> {


  logger.log('Creating brand with data:', brandData);

  const response = await fetch(`${API_URL}/api/v1/brands`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(brandData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Brand creation failed:', errorText);
    throw new Error(`Failed to create brand: ${response.statusText}`);
  }

  const result = await response.json();
  logger.log('Brand creation result:', result);
  return {
    id: String(result.id),
    name: result.name,
    isActive: result.isActive,
    displayName: result.displayName,
  };
}

export async function updateBrand(id: string, brandData: Partial<Brand>): Promise<Brand> {


  logger.log('Updating brand with ID:', id, 'Data:', brandData);

  const response = await fetch(`${API_URL}/api/v1/brands/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(brandData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Brand update failed:', errorText);
    throw new Error(`Failed to update brand: ${response.statusText}`);
  }

  const result = await response.json();
  logger.log('Brand update result:', result);
  return {
    id: String(result.id),
    name: result.name,
    isActive: result.isActive,
    displayName: result.displayName,
  };
}

export async function deleteBrand(id: string): Promise<void> {


  logger.log('Deleting brand with ID:', id);

  const response = await fetch(`${API_URL}/api/v1/brands/${id}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Brand deletion failed:', errorText);
    throw new Error(`Failed to delete brand: ${response.statusText}`);
  }

  logger.log('Brand deletion successful');
}

/**
 * Get the total count of brands (for pagination display)
 */
export async function fetchBrandCount(): Promise<number> {
  try {
    logger.log('📊 fetchBrandCount: Getting total brand count');

    const result = await fetchBrands({ page: 1 });

    if (result['hydra:totalItems'] !== undefined && result['hydra:totalItems'] !== null) {
      logger.log('📊 Got total brand count from API:', result['hydra:totalItems']);
      return result['hydra:totalItems'];
    }

    logger.warn('📊 Could not get brand count from API, using fallback');
    return 0;
  } catch (error) {
    logger.error('📊 Error fetching brand count:', error);
    return 0;
  }
}
