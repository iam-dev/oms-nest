import { API_URL, fetchWithRefresh } from './api-config';
import type { SaddleSpec } from '@/utils/customViewColumns';

export async function getBatchSaddleSpecs(
  orderIds: number[],
): Promise<Record<number, SaddleSpec[]>> {
  if (orderIds.length === 0) return {};

  const response = await fetchWithRefresh(
    `${API_URL}/api/v1/enriched_orders/batch-saddle-specs?orderIds=${orderIds.join(',')}`,
    {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch batch saddle specs: ${response.status}`);
  }

  return response.json();
}
