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

export async function getCellOverrides(orderIds?: number[]): Promise<CellOverride[]> {
  const params = orderIds?.length ? `?orderIds=${orderIds.join(',')}` : '';
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-cell-overrides${params}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to fetch cell overrides: ${response.status}`);
  return response.json();
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
  const response = await fetchWithRefresh(
    `${API_URL}/api/v1/custom-order-cell-overrides/order/${orderId}/column/${columnKey}`,
    { method: 'DELETE', credentials: 'include' },
  );
  if (!response.ok) throw new Error(`Failed to delete override: ${response.status}`);
}
