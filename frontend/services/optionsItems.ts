import { API_URL } from './api-config';
import { logger } from '@/utils/logger';

/**
 * A choice within an option (`options_items` row).
 *
 * For leather-type options (`options.type === 1`) the item carries a
 * `leatherId` and usually an empty `name`; display it via the leathertype.
 */
export interface OptionItem {
  id: number;
  optionId: number;
  leatherId: number;
  name: string;
  userColor?: number;
  userLeather?: number;
  price1?: number;
  price2?: number;
  price3?: number;
  price4?: number;
  price5?: number;
  price6?: number;
  price7?: number;
  sequence?: number;
  restrict?: string;
  deleted?: number;
  isActive?: boolean;
}

export async function fetchOptionsItemsByOptionId(optionId: number): Promise<OptionItem[]> {
  const response = await fetch(`${API_URL}/api/v1/option-items/option/${optionId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to fetch option items:', errorText);
    throw new Error(`Failed to fetch option items: ${response.status}`);
  }

  return await response.json();
}
