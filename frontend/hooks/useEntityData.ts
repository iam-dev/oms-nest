import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchEntities } from '@/services/api';

interface FetchParams {
  page?: number;
  partial?: boolean;
  orderBy?: string;
  filter?: string;
  extraParams?: Record<string, string | number | boolean>;
}

interface UseEntityDataOptions<T = unknown> extends FetchParams {
  entity: string;
  searchTerm?: string;
  filters?: Record<string, string>;
  initialData?: T[];
  autoFetch?: boolean;
}

/**
 * Hook for fetching entity data with filtering and pagination
 * @param options - Configuration options for the hook
 * @returns Data, loading state, error state, and refetch function
 */
export function useEntityData<T = unknown>({
  entity,
  page = 1,
  partial = true,
  orderBy = '',
  filter = '',
  searchTerm = '',
  filters = {},
  extraParams = {},
  initialData = [],
  autoFetch = true,
}: UseEntityDataOptions<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalItems, setTotalItems] = useState(0);

  // Memoize extraParams to prevent infinite re-renders.
  // JSON.stringify is extracted to plain variables so the dep array contains only
  // simple expressions (required by react-hooks/exhaustive-deps in eslint-config-next 16).
  // `extraParams` and `filters` are intentionally omitted from the dep array — using the
  // serialised keys as deps provides object-identity-independent comparison without
  // introducing circular re-renders.
  const extraParamsKey = JSON.stringify(extraParams);
  const filtersKey = JSON.stringify(filters);
  const memoizedExtraParams = useMemo(
    () => ({
      ...extraParams,
      ...filters,
      ...(searchTerm && { searchTerm }),
    }),
    // TODO(react-hooks): extraParams/filters are tracked via serialised keys above;
    // adding the raw objects would cause infinite re-renders on every render cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extraParamsKey, filtersKey, searchTerm],
  );

  const fetchData = useCallback(async (params: FetchParams = {}, forceFresh = false) => {
    setLoading(true);
    setError('');

    try {
      const result = await fetchEntities({
        entity,
        page: params.page ?? page,
        partial: params.partial ?? partial,
        orderBy: params.orderBy ?? orderBy,
        filter: params.filter ?? filter,
        extraParams: {
          ...params.extraParams ?? memoizedExtraParams,
          // Add cache busting when forcing fresh data
          ...(forceFresh ? { _refresh: Date.now() } : {})
        },
      });

      // Handle different response formats
      if (result['hydra:member'] && Array.isArray(result['hydra:member'])) {
        setData(result['hydra:member']);
        setTotalItems(result['hydra:totalItems'] || 0);
      } else if (Array.isArray(result)) {
        setData(result);
        // If the API doesn't return total items, use the array length
        setTotalItems(result.length);
      } else {
        setData([]);
        setTotalItems(0);
      }

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setData([]);
      setTotalItems(0);
      return null;
    } finally {
      setLoading(false);
    }
  }, [entity, page, partial, orderBy, filter, memoizedExtraParams]);

  // Fetch data on mount or when dependencies change
  useEffect(() => {
    if (autoFetch) {
      // TODO(react-hooks): fetchData is an async function; setState calls happen inside
      // promise callbacks, not synchronously in the effect body — standard fetch pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchData();
    }
  }, [fetchData, autoFetch]);

  // Enhanced refetch with cache busting option
  const refetch = useCallback((forceFresh = true) => {
    return fetchData({}, forceFresh);
  }, [fetchData]);

  // Optimistic update function
  const updateEntityOptimistically = useCallback((updatedEntity: Partial<T> & { id: string | number }) => {
    setData(currentData =>
      currentData.map(item =>
        (item as { id?: string | number }).id === updatedEntity.id
          ? { ...item, ...updatedEntity }
          : item
      )
    );
  }, []);

  // Add entity optimistically
  const addEntityOptimistically = useCallback((newEntity: T) => {
    setData(currentData => [...currentData, newEntity]);
    setTotalItems(current => current + 1);
  }, []);

  // Remove entity optimistically
  const removeEntityOptimistically = useCallback((entityId: string | number) => {
    setData(currentData =>
      currentData.filter(item => (item as { id?: string | number }).id !== entityId)
    );
    setTotalItems(current => Math.max(0, current - 1));
  }, []);

  return {
    data,
    loading,
    error,
    totalItems,
    refetch,
    setData,
    updateEntityOptimistically,
    addEntityOptimistically,
    removeEntityOptimistically,
  };
}
