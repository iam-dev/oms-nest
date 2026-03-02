import { API_URL, fetchWithRefresh } from './api-config';

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  order: number;
}

export interface CustomOrderView {
  id: number;
  userId: number;
  name: string;
  columns: ColumnConfig[];
  isDefault: boolean;
  groupId: number | null;
  tabOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function getCustomOrderViews(): Promise<CustomOrderView[]> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-views`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to fetch custom order views: ${response.status}`);
  return response.json();
}

export async function getDefaultCustomOrderView(): Promise<CustomOrderView | null> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-views/default`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch default view: ${response.status}`);
  const data = await response.json();
  return data || null;
}

export async function getCustomOrderView(id: number): Promise<CustomOrderView> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-views/${id}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to fetch view: ${response.status}`);
  return response.json();
}

export async function createCustomOrderView(data: {
  name: string;
  columns: ColumnConfig[];
  isDefault?: boolean;
  groupId?: number;
  tabOrder?: number;
}): Promise<CustomOrderView> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-views`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Failed to create view: ${response.status}`);
  }
  return response.json();
}

export async function updateCustomOrderView(
  id: number,
  data: { name?: string; columns?: ColumnConfig[]; isDefault?: boolean; groupId?: number; tabOrder?: number },
): Promise<CustomOrderView> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-views/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update view: ${response.status}`);
  }
  return response.json();
}

export async function deleteCustomOrderView(id: number): Promise<void> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-views/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to delete view: ${response.status}`);
}

export async function getViewsByGroup(groupId: number): Promise<CustomOrderView[]> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/custom-order-views?groupId=${groupId}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to fetch views by group: ${response.status}`);
  return response.json();
}
