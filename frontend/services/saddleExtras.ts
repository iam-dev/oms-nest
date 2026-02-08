import { API_URL } from './api-config';
import { logger } from '@/utils/logger';

export interface SaddleExtra {
  id: number;
  saddleId: number;
  extraId: number;
  deleted?: number;
  isActive?: boolean;
}

export async function fetchSaddleExtrasBySaddleId(saddleId: number): Promise<SaddleExtra[]> {


  const response = await fetch(`${API_URL}/api/v1/saddle-extras/saddle/${saddleId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to fetch saddle extras:', errorText);
    throw new Error(`Failed to fetch saddle extras: ${response.status}`);
  }

  return await response.json();
}

export async function createSaddleExtra(data: {
  saddleId: number;
  extraId: number;
}): Promise<SaddleExtra> {


  const response = await fetch(`${API_URL}/api/v1/saddle-extras`, {
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
    logger.error('Failed to create saddle extra:', errorText);
    throw new Error(`Failed to create saddle extra: ${response.status}`);
  }

  return await response.json();
}

export async function deleteSaddleExtra(id: number): Promise<void> {


  const response = await fetch(`${API_URL}/api/v1/saddle-extras/${id}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to delete saddle extra:', errorText);
    throw new Error(`Failed to delete saddle extra: ${response.status}`);
  }
}
