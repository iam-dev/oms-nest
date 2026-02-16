import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePagination } from '@/hooks';
import {
  buildOrderFilters,
  extractDynamicSeatSizes,
  extractDynamicFactories,
  processOrdersTableData,
} from '../utils/orderProcessing';
import { MIN_ORDER_ID } from '@/utils/orderConstants';
import { getEnrichedOrders } from '@/services/enrichedOrders';
import { logger } from '@/utils/logger';
import type { Order } from '@/components/Orders';

export function useOrderFilters() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchMessage, setSearchMessage] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [headerFilters, setHeaderFilters] = useState<Record<string, string>>({});

  const {
    page,
    setPage,
    pagination,
    setTotalItems,
  } = usePagination(30, 1);

  // Parse a string that may contain multiple order IDs (pasted from Excel, etc.)
  const parseMultipleIds = useCallback((text: string): number[] => {
    return text
      .split(/[\n,\t\s]+/)
      .map(s => s.trim())
      .filter(s => /^\d+$/.test(s))
      .map(s => parseInt(s, 10))
      .filter(id => id >= MIN_ORDER_ID);
  }, []);

  // Handle search input change with debounce
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      if (term.trim() === '') {
        setIsSearching(false);
        setSearchMessage('');
        setHeaderFilters(prev => ({ ...prev, orderId: '', orderIds: '', searchTerm: '' }));
      } else {
        // Try to detect multiple order IDs (pasted from Excel, etc.)
        const ids = parseMultipleIds(term);
        if (ids.length > 1) {
          const idsStr = ids.join(',');
          logger.log('Searching for multiple order IDs:', ids);
          setIsSearching(true);
          setSearchMessage(`Searching for ${ids.length} order IDs...`);
          setHeaderFilters(prev => ({ ...prev, orderId: '', orderIds: idsStr, searchTerm: '' }));
        } else if (ids.length === 1) {
          const exactOrderId = String(ids[0]);
          logger.log('Searching for exact order ID:', exactOrderId);
          setIsSearching(true);
          setSearchMessage(`Searching for order ID: ${exactOrderId}...`);
          setHeaderFilters(prev => ({ ...prev, orderId: exactOrderId, orderIds: '', searchTerm: '' }));
        } else {
          const searchValue = term.trim();
          logger.log('Searching for:', searchValue);
          setIsSearching(true);
          setSearchMessage(`Searching for: "${searchValue}"...`);
          setHeaderFilters(prev => ({ ...prev, orderId: '', orderIds: '', searchTerm: searchValue }));
        }
      }
      setPage(1);
    }, 500);

    setSearchTimeout(timeout);
  }, [setPage, searchTimeout, parseMultipleIds]);

  // Handle bulk search from BulkOrderSearch component
  const handleBulkSearch = useCallback((ids: number[]) => {
    if (ids.length === 0) return;
    const idsStr = ids.join(',');
    logger.log('Bulk searching for order IDs:', ids);
    setSearchTerm(ids.join(', '));
    setIsSearching(true);
    setSearchMessage(`Searching for ${ids.length} order IDs...`);
    setHeaderFilters(prev => ({ ...prev, orderId: '', orderIds: idsStr, searchTerm: '' }));
    setPage(1);
  }, [setPage]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Fetch orders
  const fetchAndSetOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = buildOrderFilters(headerFilters);
      const isSearchingForOrderId = filters.orderId && /^\d+$/.test(filters.orderId);
      const isSearchingForOrderIds = !!filters.orderIds;
      const isSearchingWithSearchTerm = filters.searchTerm && filters.searchTerm.length > 0;

      const data = await getEnrichedOrders({
        page,
        partial: false,
        filters,
        orderBy: 'orderId',
        order: 'desc',
      });

      const apiOrders = data['hydra:member'] || [];

      if (apiOrders.length > 0) {
        apiOrders.sort((a: Order, b: Order) => {
          const orderIdA = Number(a.orderId);
          const orderIdB = Number(b.orderId);
          if (!isNaN(orderIdA) && !isNaN(orderIdB)) {
            return orderIdB - orderIdA;
          }
          return String(b.orderId || '').localeCompare(String(a.orderId || ''));
        });
      }

      setOrders(apiOrders);
      setTotalItems(data['hydra:totalItems'] || apiOrders.length || 0);

      if (isSearchingForOrderIds) {
        const requestedCount = filters.orderIds.split(',').length;
        if (apiOrders.length === 0) {
          setSearchMessage(`No orders found for ${requestedCount} requested IDs`);
        } else {
          setSearchMessage(`Found ${apiOrders.length} of ${requestedCount} orders`);
          setTimeout(() => setSearchMessage(''), 5000);
        }
      } else if (isSearchingForOrderId) {
        if (apiOrders.length === 0) {
          setSearchMessage(`No orders found with ID: ${filters.orderId}`);
        } else if (apiOrders.length === 1) {
          setSearchMessage(`Found order with ID: ${filters.orderId}`);
          setTimeout(() => setSearchMessage(''), 3000);
        } else {
          setSearchMessage(`Found ${apiOrders.length} orders matching search criteria`);
          setTimeout(() => setSearchMessage(''), 3000);
        }
      } else if (isSearchingWithSearchTerm) {
        if (apiOrders.length === 0) {
          setSearchMessage(`No orders found for: "${filters.searchTerm}"`);
        } else {
          setSearchMessage(`Found ${apiOrders.length} order${apiOrders.length === 1 ? '' : 's'} for: "${filters.searchTerm}"`);
          setTimeout(() => setSearchMessage(''), 3000);
        }
      } else {
        setSearchMessage('');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch orders';
      setError(message);
      setOrders([]);
      setTotalItems(0);
      if (headerFilters.orderId) {
        setSearchMessage(`Error searching for order: ${message}`);
      } else if (headerFilters.searchTerm) {
        setSearchMessage(`Error searching: ${message}`);
      }
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, [page, headerFilters, setTotalItems]);

  // Fetch on mount and filter/page change
  useEffect(() => {
    fetchAndSetOrders();
  }, [fetchAndSetOrders]);

  // Interval refresh (5 min)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAndSetOrders();
    }, 300000);
    return () => clearInterval(interval);
  }, [fetchAndSetOrders]);

  // Process orders for the table
  const processedOrders = processOrdersTableData(orders || []);

  const dynamicSeatSizes = useMemo(() => {
    return extractDynamicSeatSizes(orders);
  }, [orders]);

  const dynamicFactories = useMemo(() => {
    return extractDynamicFactories(orders);
  }, [orders]);

  const handleFilterChange = (key: string, value: string) => {
    setHeaderFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    logger.log('Resetting all Orders filters');
    setHeaderFilters({});
    setPage(1);
    setSearchTerm('');
    setSearchMessage('');
  };

  const hasActiveFilters = Object.keys(headerFilters).some(
    key => headerFilters[key] && headerFilters[key] !== ''
  );

  return {
    // Search state
    searchTerm,
    searchMessage,
    isSearching,
    handleSearch,
    handleBulkSearch,

    // Orders data
    orders,
    processedOrders,
    loading,
    error,

    // Filters
    headerFilters,
    handleFilterChange,
    resetFilters,
    hasActiveFilters,
    dynamicSeatSizes,
    dynamicFactories,

    // Pagination
    page,
    setPage,
    pagination,

    // Refresh
    fetchAndSetOrders,
  };
}
