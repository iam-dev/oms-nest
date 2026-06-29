import { useEffect, useState } from 'react';
import { fetchEntities } from '../services/api';

interface UseEntitiesParams {
  entity: string;
  page?: number;
  partial?: boolean;
  orderBy?: string;
  filter?: string;
  extraParams?: Record<string, string | number | boolean>;
}

export function useEntities<T = unknown>({ entity, page = 1, partial = true, orderBy = '', filter = '', extraParams = {} }: UseEntitiesParams) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    // TODO(react-hooks): setLoading/setError are synchronous guards before an async
    // chain; all data-updating setState calls happen in .then()/.catch() callbacks —
    // standard loading-state pattern for promise-based fetching.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetchEntities({ entity, page, partial, orderBy, filter, extraParams })
      .then(res => {
        let items: T[] = [];
        if (res['hydra:member']) {
          items = res['hydra:member'];
        } else if (res.data && Array.isArray(res.data)) {
          // Handle NestJS standard response format { data: [...], total, pages }
          items = res.data;
        } else if (Array.isArray(res)) {
          items = res;
        }
        setData(items);
        setTotalPages(res['hydra:view']?.['hydra:last'] ? parseInt(new URL(res['hydra:view']['hydra:last'], 'http://dummy').searchParams.get('page') || '1') : 1);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || 'Error fetching data');
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, page, partial, orderBy, filter, JSON.stringify(extraParams)]);

  return { data, loading, error, totalPages };
}

// Specifieke hooks voor veelgebruikte entiteiten (optioneel)
export function useCustomers(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'customers', ...params });
}
export function useFitters(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'fitters', ...params });
}
export function useUsers(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'users', ...params });
}
export function useBrands(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'brands', ...params });
}
export function useModels(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'models', ...params });
}
export function useOptions(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'options', ...params });
}
export function useExtras(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'extras', ...params });
}
export function usePresets(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'presets', ...params });
}
export function useProductSaddles(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'products', ...params });
}
export function useOrderProductSaddles(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'order_products', ...params });
}
export function useSuppliers(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'factories', ...params });
}
export function useFactories(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'factories', ...params });
}
export function useLeathertypes(params: Partial<UseEntitiesParams> = {}) {
  return useEntities({ entity: 'leathertypes', ...params });
}
