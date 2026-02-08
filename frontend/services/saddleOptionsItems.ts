import { API_URL } from './api-config';
import { logger } from '@/utils/logger';

export interface SaddleOptionsItem {
  id: number;
  saddleId: number;
  optionId: number;
  optionItemId: number;
  leatherId: number;
  sequence?: number;
  deleted?: number;
  isActive?: boolean;
}

export async function fetchSaddleOptionsItemsBySaddleId(saddleId: number): Promise<SaddleOptionsItem[]> {
  const response = await fetch(`${API_URL}/api/v1/saddle-options-items/saddle/${saddleId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to fetch saddle options items:', errorText);
    throw new Error(`Failed to fetch saddle options items: ${response.status}`);
  }

  return await response.json();
}

export async function createSaddleOptionsItem(data: {
  saddleId: number;
  optionId: number;
  optionItemId: number;
  leatherId: number;
  sequence?: number;
}): Promise<SaddleOptionsItem> {
  const response = await fetch(`${API_URL}/api/v1/saddle-options-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to create saddle options item:', errorText);
    throw new Error(`Failed to create saddle options item: ${response.status}`);
  }

  return await response.json();
}

export async function deleteSaddleOptionsItem(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/saddle-options-items/${id}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to delete saddle options item:', errorText);
    throw new Error(`Failed to delete saddle options item: ${response.status}`);
  }
}
