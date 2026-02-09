import { SaddleStockSearchResult } from '@/types/SaddleStock';
import { API_URL } from './api-config';

async function fetchSaddleStock(
  type: 'my' | 'available' | 'all',
  {
    page = 1,
    limit = 30,
    search,
  }: { page?: number; limit?: number; search?: string } = {},
): Promise<SaddleStockSearchResult> {
  const url = new URL(`${API_URL}/api/v1/saddle-stock`);
  url.searchParams.set('type', type);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));
  if (search) {
    url.searchParams.set('search', search);
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${type} saddle stock: ${res.status}`);
  }

  return res.json();
}

export async function fetchMySaddleStock({
  page = 1,
  partial = false,
  orderBy = 'productId',
  order = 'desc',
} = {}): Promise<SaddleStockSearchResult> {
  return fetchSaddleStock('my', { page });
}

export async function fetchAvailableSaddleStock({
  page = 1,
  partial = false,
  orderBy = 'productId',
  order = 'desc',
} = {}): Promise<SaddleStockSearchResult> {
  return fetchSaddleStock('available', { page });
}

export async function fetchAllSaddleStock({
  page = 1,
  search,
}: { page?: number; search?: string } = {}): Promise<SaddleStockSearchResult> {
  return fetchSaddleStock('all', { page, search });
}

export async function getSaddleStockById(id: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/v1/saddle-stock/${id}`, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch saddle stock item: ${res.status}`);
  }

  return res.json();
}
