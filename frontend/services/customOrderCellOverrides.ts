import { API_URL, fetchWithRefresh } from './api-config';

export interface CellOverride {
  id: number;
  userId: number;
  orderId: number;
  columnKey: string;
  overrideValue: string;
  createdAt: string;
  updatedAt: string;
}

/** Maximum number of order IDs sent per request to avoid URL-length limits. */
const BATCH_SIZE = 100;

export async function getCellOverrides(orderIds?: number[]): Promise<CellOverride[]> {
  // FE-020: chunk large orderIds arrays into batches of ≤100 to avoid URL-length limits.
  if (!orderIds || orderIds.length === 0) {
    const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-cell-overrides`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`Failed to fetch cell overrides: ${response.status}`);
    return response.json();
  }

  const batches: number[][] = [];
  for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
    batches.push(orderIds.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const params = `?orderIds=${batch.join(',')}`;
      const response = await fetchWithRefresh(
        `${API_URL}/api/v1/custom-order-cell-overrides${params}`,
        { headers: { Accept: 'application/json' }, credentials: 'include' },
      );
      if (!response.ok) throw new Error(`Failed to fetch cell overrides: ${response.status}`);
      return response.json() as Promise<CellOverride[]>;
    }),
  );

  return results.flat();
}

export async function getCellOverridesForOrder(orderId: number): Promise<CellOverride[]> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-cell-overrides/order/${orderId}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to fetch overrides for order: ${response.status}`);
  return response.json();
}

export async function upsertCellOverride(data: {
  orderId: number;
  columnKey: string;
  overrideValue: string;
}): Promise<CellOverride> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-cell-overrides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Failed to upsert override: ${response.status}`);
  }
  return response.json();
}

export async function bulkUpsertCellOverrides(
  overrides: Array<{ orderId: number; columnKey: string; overrideValue: string }>,
): Promise<CellOverride[]> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-cell-overrides/bulk`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ overrides }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Failed to bulk upsert overrides: ${response.status}`);
  }
  return response.json();
}

export async function deleteCellOverride(id: number): Promise<void> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-cell-overrides/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to delete override: ${response.status}`);
}

export async function deleteCellOverrideByOrderAndColumn(
  orderId: number,
  columnKey: string,
): Promise<void> {
  // FE-021: encode columnKey so keys containing special characters round-trip safely.
  const response = await fetchWithRefresh(
    `${API_URL}/api/v1/custom-order-cell-overrides/order/${orderId}/column/${encodeURIComponent(columnKey)}`,
    { method: 'DELETE', credentials: 'include' },
  );
  if (!response.ok) throw new Error(`Failed to delete override: ${response.status}`);
}
