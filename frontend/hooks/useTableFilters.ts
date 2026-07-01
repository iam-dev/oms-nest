import { useState, useCallback } from 'react';

/**
 * Hook for managing table filters
 * @param initialFilters - Initial filter values
 * @returns Filter state and methods to update filters
 */
export function useTableFilters<T extends Record<string, string>>(initialFilters: T = {} as T) {
  const [filters, setFilters] = useState<T>(initialFilters);
  
  // Update a single filter
  const updateFilter = useCallback((key: keyof T, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({} as T);
  }, []);
  
  // Bulk update multiple filters at once
  const updateFilters = useCallback((newFilters: Partial<T>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);
  
  // Get filter string for API requests (useful for OData)
  const getFilterString = useCallback(() => {
    return Object.entries(filters)
      .filter(([, value]) => value && value.trim() !== '')
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
  }, [filters]);
  
  return { 
    filters, 
    updateFilter, 
    clearFilters, 
    updateFilters,
    getFilterString
  };
}
