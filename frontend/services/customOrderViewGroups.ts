import { API_URL, fetchWithRefresh } from './api-config';
import { CustomOrderView } from './customOrderViews';

export interface CustomOrderViewGroup {
  id: number;
  name: string;
  userId: number;
  views: CustomOrderView[];
  createdAt: string;
  updatedAt: string;
}

const BASE = `${API_URL}/api/v1/custom-order-view-groups`;

export async function getCustomOrderViewGroups(): Promise<CustomOrderViewGroup[]> {
  const response = await fetchWithRefresh(BASE, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to fetch view groups: ${response.status}`);
  return response.json();
}

export async function getCustomOrderViewGroup(id: number): Promise<CustomOrderViewGroup> {
  const response = await fetchWithRefresh(`${BASE}/${id}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to fetch view group: ${response.status}`);
  return response.json();
}

export async function createCustomOrderViewGroup(data: { name: string }): Promise<CustomOrderViewGroup> {
  const response = await fetchWithRefresh(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Failed to create view group: ${response.status}`);
  }
  return response.json();
}

export async function updateCustomOrderViewGroup(
  id: number,
  data: { name?: string },
): Promise<CustomOrderViewGroup> {
  const response = await fetchWithRefresh(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update view group: ${response.status}`);
  }
  return response.json();
}

export async function deleteCustomOrderViewGroup(id: number): Promise<void> {
  const response = await fetchWithRefresh(`${BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to delete view group: ${response.status}`);
}
