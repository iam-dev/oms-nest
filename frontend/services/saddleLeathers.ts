import { API_URL } from './api-config';
import { logger } from '@/utils/logger';

export interface SaddleLeather {
  id: number;
  saddleId: number;
  leatherId: number;
  price1?: number;
  price2?: number;
  price3?: number;
  price4?: number;
  price5?: number;
  price6?: number;
  price7?: number;
  sequence?: number;
  deleted?: number;
  isActive?: boolean;
}

export async function fetchSaddleLeathersBySaddleId(saddleId: number): Promise<SaddleLeather[]> {


  const response = await fetch(`${API_URL}/api/v1/saddle-leathers/saddle/${saddleId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to fetch saddle leathers:', errorText);
    throw new Error(`Failed to fetch saddle leathers: ${response.status}`);
  }

  return await response.json();
}

export async function createSaddleLeather(data: {
  saddleId: number;
  leatherId: number;
  price1?: number;
  price2?: number;
  price3?: number;
  price4?: number;
  price5?: number;
  price6?: number;
  price7?: number;
  sequence?: number;
}): Promise<SaddleLeather> {


  const response = await fetch(`${API_URL}/api/v1/saddle-leathers`, {
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
    logger.error('Failed to create saddle leather:', errorText);
    throw new Error(`Failed to create saddle leather: ${response.status}`);
  }

  return await response.json();
}

export async function updateSaddleLeather(id: number, data: Partial<SaddleLeather>): Promise<SaddleLeather> {


  const response = await fetch(`${API_URL}/api/v1/saddle-leathers/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to update saddle leather:', errorText);
    throw new Error(`Failed to update saddle leather: ${response.status}`);
  }

  return await response.json();
}

export async function deleteSaddleLeather(id: number): Promise<void> {


  const response = await fetch(`${API_URL}/api/v1/saddle-leathers/${id}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to delete saddle leather:', errorText);
    throw new Error(`Failed to delete saddle leather: ${response.status}`);
  }
}
