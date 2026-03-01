import { API_URL, fetchWithRefresh } from './api-config';

export interface SavedFilter {
  id: number;
  userId: number;
  name: string;
  filters: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getSavedFilters(): Promise<SavedFilter[]> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/report-saved-filters`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to fetch saved filters: ${response.status}`);
  return response.json();
}

export async function getDefaultFilter(): Promise<SavedFilter | null> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/report-saved-filters/default`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch default filter: ${response.status}`);
  const data = await response.json();
  return data || null;
}

export async function createSavedFilter(data: {
  name: string;
  filters: Record<string, unknown>;
  isDefault?: boolean;
}): Promise<SavedFilter> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/report-saved-filters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Failed to create saved filter: ${response.status}`);
  }
  return response.json();
}

export async function updateSavedFilter(
  id: number,
  data: { name?: string; filters?: Record<string, unknown>; isDefault?: boolean },
): Promise<SavedFilter> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/report-saved-filters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update saved filter: ${response.status}`);
  }
  return response.json();
}

export async function deleteSavedFilter(id: number): Promise<void> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/report-saved-filters/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to delete saved filter: ${response.status}`);
}
