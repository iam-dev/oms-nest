"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { OrdersTable } from '@/components/shared/OrdersTable';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Star, Trash2 } from 'lucide-react';
// Simple date formatting function
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { OrderDetails } from './OrderDetails';
import { ComprehensiveEditOrder } from './ComprehensiveEditOrder';
import { getFitterName, getCustomerName, getSupplierName, getStatus, getUrgent, getDate } from '../utils/orderHydration';
import { getOrderTableColumns } from '../utils/orderTableColumns';
import { seatSizes, statuses, orderStatuses } from '../utils/orderConstants';
import { logger } from '@/utils/logger';
import { getEnrichedOrders, getFilterOptions } from '../services/enrichedOrders';
import type { FilterOptions } from '../services/enrichedOrders';
import { extractDynamicFactories, extractDynamicSeatSizes, extractSeatSizes } from '../utils/orderProcessing';
import { fetchEntities } from '../services/api';
import { exportToXlsx } from '../utils/exportXlsx';
import { MultiSelectFilter } from '@/components/shared/MultiSelectFilter';
import { getSavedFilters, getDefaultFilter, createSavedFilter, updateSavedFilter, deleteSavedFilter } from '../services/reportSavedFilters';
import type { SavedFilter } from '../services/reportSavedFilters';

const saleTypeOptions = [
  { label: 'Normal orders', value: 'normal' },
  { label: 'Demo orders', value: 'demo' },
  { label: 'Sponsored orders', value: 'sponsored' },
  { label: 'Urgent orders', value: 'urgent' },
  { label: 'Repair orders', value: 'repair' },
];

export default function Reports() {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [headerFilters, setHeaderFilters] = useState<Record<string, string>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // Saved filters state
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<number | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [saveFilterDefault, setSaveFilterDefault] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Static filter options loaded once from dedicated endpoint
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  useEffect(() => {
    getFilterOptions()
      .then(setFilterOptions)
      .catch(() => { /* fallback to order-derived lists */ });
  }, []);

  // Fetch all factories from API for complete filter dropdown
  const [allFactoryNames, setAllFactoryNames] = useState<Array<{label: string, value: string}>>([]);
  useEffect(() => {
    fetchEntities({ entity: 'factories', page: 1, extraParams: { limit: 500, pagination: false } })
      .then(data => {
        const members = data['hydra:member'] || [];
        const names = members
          .map((f: Record<string, unknown>) => (f.name || f.displayName || '') as string)
          .filter((n: string) => n.trim())
          .sort();
        setAllFactoryNames(names.map((n: string) => ({ label: n, value: n })));
      })
      .catch(() => { /* fallback to order-derived list */ });
  }, []);

  // Use static filter options for factories (only factories with orders), falling back to API list
  const suppliers = React.useMemo(() => {
    if (filterOptions?.factories?.length) {
      return filterOptions.factories.map(name => ({ label: name, value: name }));
    }
    const orderFactories = extractDynamicFactories(orders);
    if (allFactoryNames.length === 0) return orderFactories;
    const merged = new Map<string, {label: string, value: string}>();
    for (const f of allFactoryNames) merged.set(f.value, f);
    for (const f of orderFactories) merged.set(f.value, f);
    return Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filterOptions, orders, allFactoryNames]);
  
  // Use static filter options from backend when available, falling back to current page data
  const fittersList = React.useMemo(() => {
    if (filterOptions?.fitters?.length) {
      return filterOptions.fitters.map(name => ({ label: name, value: name }));
    }
    const fitters = new Set<string>();
    orders.forEach(order => {
      const name = order.fitter_name || order.fitterName || getFitterName(order);
      if (name && typeof name === 'string' && name.trim() && !name.startsWith('Unknown')) {
        fitters.add(name.trim());
      }
    });
    return Array.from(fitters).sort().map(name => ({ label: name, value: name }));
  }, [filterOptions, orders]);
  
  const modelsList = React.useMemo(() => {
    if (filterOptions?.saddles?.length) {
      return filterOptions.saddles.map(name => ({ label: name, value: name }));
    }
    const saddles = new Set<string>();
    orders.forEach(order => {
      const brand = order.brand_name || order.brandName || '';
      const model = order.model_name || order.modelName || '';
      const saddleName = [brand, model].filter(Boolean).join(' - ');
      if (saddleName.trim()) {
        saddles.add(saddleName.trim());
      }
    });
    return Array.from(saddles).sort().map(name => ({ label: name, value: name }));
  }, [filterOptions, orders]);

  const customersList = React.useMemo(() => {
    if (filterOptions?.customers?.length) {
      return filterOptions.customers.map(name => ({ label: name, value: name }));
    }
    const customers = new Set<string>();
    orders.forEach(order => {
      const name = getCustomerName(order);
      if (name && typeof name === 'string' && name.trim() && !name.startsWith('Unknown')) {
        customers.add(name.trim());
      }
    });
    return Array.from(customers).sort().map(name => ({ label: name, value: name }));
  }, [filterOptions, orders]);

  const dynamicCustomerCountries = React.useMemo(() => {
    const isValidCountry = (c: string) => c.trim() && c.trim() !== '-1';
    if (filterOptions?.customerCountries?.length) {
      return filterOptions.customerCountries.filter(isValidCountry);
    }
    const countriesSet = new Set<string>();
    orders.forEach(order => {
      const country = order.customer_country || order.customerCountry;
      if (country && typeof country === 'string' && isValidCountry(country)) {
        countriesSet.add(country.trim());
      }
    });
    return Array.from(countriesSet).sort();
  }, [filterOptions, orders]);

  const dynamicFitterCountries = React.useMemo(() => {
    const isValidCountry = (c: string) => c.trim() && c.trim() !== '-1';
    if (filterOptions?.fitterCountries?.length) {
      return filterOptions.fitterCountries.filter(isValidCountry);
    }
    const countriesSet = new Set<string>();
    orders.forEach(order => {
      const country = order.fitter_country || order.fitterCountry;
      if (country && typeof country === 'string' && isValidCountry(country)) {
        countriesSet.add(country.trim());
      }
    });
    return Array.from(countriesSet).sort();
  }, [filterOptions, orders]);

  useEffect(() => {
    setLoading(true);
    // Build filters for API Platform
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: Record<string, any> = {};
    Object.keys(headerFilters).forEach(key => {
      if (headerFilters[key] && headerFilters[key] !== '') {
        // Map frontend filter keys to API keys if needed
        if (key === 'orderId') {
          filters.orderId = headerFilters[key];
        } else if (key === 'reference') {
          filters.fitterReference = headerFilters[key];
        } else if (key === 'customer') {
          filters.customerName = headerFilters[key];
        } else if (key === 'status') {
          filters.orderStatus = headerFilters[key];
        } else if (key === 'fitter') {
          filters.fitterName = headerFilters[key];
        } else if (key === 'supplier') {
          filters.supplierName = headerFilters[key];
        } else if (key === 'urgent') {
          // Convert string boolean to actual boolean for API Platform BooleanFilter
          if (headerFilters[key] === 'true') {
            filters.urgent = true;
          } else if (headerFilters[key] === 'false') {
            filters.urgent = false;
          }
        } else if (key === 'seatSize') {
          filters.seatSizes = headerFilters[key];
        } else if (key === 'customerCountry') {
          filters.customerCountry = headerFilters[key];
        } else if (key === 'fitterCountry') {
          filters.fitterCountry = headerFilters[key];
        } else if (key === 'saddle') {
          filters.saddleName = headerFilters[key];
        } else if (key === 'kneeRoll') {
          filters.kneeRoll = headerFilters[key];
        } else if (key === 'leatherType') {
          filters.leatherType = headerFilters[key];
        } else if (key === 'saleType') {
          filters.saleType = headerFilters[key];
        }
      }
    });

    getEnrichedOrders({
      page,
      partial: true,
      filters,
      orderBy: 'orderId',
      order: 'desc',
      bustCache: refreshKey > 0,
    })
      .then(data => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let memberArr: any[] = [];
        if (data['hydra:member']) {
          memberArr = data['hydra:member'];
        } else if (Array.isArray(data.data)) {
          memberArr = data.data;
        } else if (Array.isArray(data)) {
          memberArr = data;
        }
        setOrders(memberArr);
        const serverTotal = data.total || data['hydra:totalItems'] || memberArr.length;
        setTotalItems(serverTotal);
        setTotalPages(data.pages || Math.ceil(serverTotal / 50) || 1);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load orders from API');
        setLoading(false);
      });
  }, [page, headerFilters, refreshKey]);

  const [groupBySaddle, setGroupBySaddle] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [localFilters, setLocalFilters] = useState<Record<string, string>>({
    orderId: '',
    reference: '',
    seatSize: '',
    customer: '',
    orderStatus: '',
    urgent: '',
    fitter: '',
    supplier: '',
  });
  // Multi-select filter arrays
  const [selectedFitters, setSelectedFitters] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSaleTypes, setSelectedSaleTypes] = useState<string[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedFactories, setSelectedFactories] = useState<string[]>([]);
  const [selectedSaddles, setSelectedSaddles] = useState<string[]>([]);
  const [selectedCustomerCountries, setSelectedCustomerCountries] = useState<string[]>([]);
  const [selectedFitterCountries, setSelectedFitterCountries] = useState<string[]>([]);
  const [selectedSeatSizes, setSelectedSeatSizes] = useState<string[]>([]);
  const [selectedKneeRolls, setSelectedKneeRolls] = useState<string[]>([]);
  const [selectedLeatherTypes, setSelectedLeatherTypes] = useState<string[]>([]);
  // Urgent stays single-select (boolean toggle)
  const [selectedUrgent, setSelectedUrgent] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [date, setDate] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [orderedDate, setOrderedDate] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [paymentDate, setPaymentDate] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });

  // Extract unique seat sizes from orders (handles both snake_case and camelCase)
  const dynamicSeatSizes = React.useMemo(() => {
    return extractDynamicSeatSizes(orders);
  }, [orders]);

  const kneeRollOptions = React.useMemo(() => {
    if (filterOptions?.kneeRolls?.length) {
      return filterOptions.kneeRolls;
    }
    const values = new Set<string>();
    orders.forEach(order => {
      const kr = order.knee_roll || order.kneeRoll;
      if (kr && typeof kr === 'string' && kr.trim()) {
        values.add(kr.trim());
      }
    });
    return Array.from(values).sort();
  }, [filterOptions, orders]);

  const leatherTypeOptions = React.useMemo(() => {
    if (filterOptions?.leatherTypes?.length) {
      return filterOptions.leatherTypes;
    }
    const values = new Set<string>();
    orders.forEach(order => {
      const lt = order.leather_name || order.leatherName || order.leatherType;
      if (lt && typeof lt === 'string' && lt.trim()) {
        values.add(lt.trim());
      }
    });
    return Array.from(values).sort();
  }, [filterOptions, orders]);

  // Sync multi-select state arrays to headerFilters (comma-separated)
  const updateMultiFilter = useCallback((key: string, values: string[]) => {
    setHeaderFilters(prev => ({
      ...prev,
      [key]: values.join(',')
    }));
    setPage(1);
  }, []);

  const columns = getOrderTableColumns(
    headerFilters,
    (key, value) => {
      setHeaderFilters(prev => ({ ...prev, [key]: value }));
      setPage(1); // Reset to page 1 when filters change
    },
    suppliers,
    dynamicSeatSizes
  );

  // Data normaliseren net als in Dashboard/Orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processedOrders = (orders || []).map((order: any) => ({
    ...order,
    id: order.id || order.orderId || '',
    orderId: order.orderId || order.id || '',
    reference: order.reference || '',
    seatSize: extractSeatSizes(order),
    seatSizes: order.seat_sizes || order.seatSizes || [],
    name: order.name || '',
    orderStatus: order.orderStatus || '',
    orderTime: order.orderTime || order.createdAt || '',
    createdAt: order.createdAt || '',
    status: order.orderStatus || '',
    urgent: order.urgent === true || order.urgency === 1 || order.urgency === true || false,
    isUrgent: order.urgent === true || order.urgency === 1 || order.urgency === true || false,
    customer: getCustomerName(order) || '',
    fitter: getFitterName(order) || '',
    supplier: getSupplierName(order) || ''
  }));

  // Client-side post-filtering with multi-value support
  const filteredOrders = processedOrders.filter(order => {
    const matchesOrderId = !headerFilters.orderId || (order.orderId || '').toLowerCase().includes(headerFilters.orderId.toLowerCase());
    const matchesReference = !headerFilters.reference || (
      (order.fitterReference || order.fitter_reference || '') as string
    ).toLowerCase().includes(headerFilters.reference.toLowerCase());

    // Seat size filtering is handled server-side via the seatSizes query parameter.
    // Client-side re-filtering was removing valid results (orders matched by server via
    // orders_info or special_notes that have seat_sizes: null in the JSONB column).
    const matchesSeatSize = true;

    const matchesOrderStatus = !headerFilters.status || (() => {
      const filterValues = headerFilters.status.split(',').map(v => v.trim()).filter(Boolean);
      if (filterValues.length === 0) return true;
      return filterValues.some(fv => getStatus(order) === fv);
    })();

    const matchesFitter = !headerFilters.fitter || (() => {
      const filterValues = headerFilters.fitter.split(',').map(v => v.trim()).filter(Boolean);
      if (filterValues.length === 0) return true;
      return filterValues.some(fv => getFitterName(order).toLowerCase().includes(fv.toLowerCase()));
    })();

    const matchesUrgent = !headerFilters.urgent || ((orderUrgent => {
      const val = getUrgent(orderUrgent);
      const strVal = String(val);
      if (val === null || val === undefined || val === '') return 'false';
      if (strVal === 'true' || strVal === 'Yes' || strVal === '1') return 'true';
      if (strVal === 'false' || strVal === 'No' || strVal === '0') return 'false';
      return strVal;
    })(order) === headerFilters.urgent);

    const matchesCustomer = !headerFilters.customer || (() => {
      const filterValues = headerFilters.customer.split(',').map(v => v.trim()).filter(Boolean);
      if (filterValues.length === 0) return true;
      return filterValues.some(fv => getCustomerName(order).toLowerCase().includes(fv.toLowerCase()));
    })();

    const matchesSupplier = !headerFilters.supplier || (() => {
      const filterValues = headerFilters.supplier.split(',').map(v => v.trim()).filter(Boolean);
      if (filterValues.length === 0) return true;
      return filterValues.some(fv => (order.supplier || '').toLowerCase().includes(fv.toLowerCase()));
    })();

    const matchesSaddle = !headerFilters.saddle || (() => {
      const filterValues = headerFilters.saddle.split(',').map(v => v.trim()).filter(Boolean);
      if (filterValues.length === 0) return true;
      const brand = order.brand_name || order.brandName || '';
      const model = order.model_name || order.modelName || '';
      const saddleName = [brand, model].filter(Boolean).join(' - ');
      return filterValues.some(fv => saddleName.toLowerCase().includes(fv.toLowerCase()));
    })();

    // Country filters are handled server-side with OR (additive) logic.
    // Client-side re-filtering would incorrectly hide valid server results.
    const matchesCustomerCountry = true;
    const matchesFitterCountry = true;

    const matchesKneeRoll = !headerFilters.kneeRoll || (() => {
      const filterValues = headerFilters.kneeRoll.split(',').map(v => v.trim()).filter(Boolean);
      if (filterValues.length === 0) return true;
      const kr = (order.knee_roll || order.kneeRoll || '').toLowerCase();
      return filterValues.some(fv => kr.includes(fv.toLowerCase()));
    })();

    const matchesLeatherType = !headerFilters.leatherType || (() => {
      const filterValues = headerFilters.leatherType.split(',').map(v => v.trim()).filter(Boolean);
      if (filterValues.length === 0) return true;
      const lt = (order.leather_name || order.leatherName || order.leatherType || '').toLowerCase();
      return filterValues.some(fv => lt.toLowerCase().includes(fv.toLowerCase()));
    })();

    const matchesSaleType = !headerFilters.saleType || (() => {
      const filterValues = headerFilters.saleType.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
      if (filterValues.length === 0) return true;
      return filterValues.some(fv => {
        if (fv === 'demo') return order.demo === 1 || order.demo === true;
        if (fv === 'sponsored') return order.sponsored === 1 || order.sponsored === true;
        if (fv === 'urgent') return order.urgent === true || order.urgency === 1;
        if (fv === 'repair') return order.repair === 1 || order.repair === true;
        if (fv === 'normal') {
          const isDemo = order.demo === 1 || order.demo === true;
          const isSponsored = order.sponsored === 1 || order.sponsored === true;
          const isUrgent = order.urgent === true || order.urgency === 1;
          const isRepair = order.repair === 1 || order.repair === true;
          return !isDemo && !isSponsored && !isUrgent && !isRepair;
        }
        return false;
      });
    })();

    let matchesDate = true;
    if (date.from || date.to) {
      const orderDate = new Date(getDate(order));
      if (date.from && orderDate < date.from) matchesDate = false;
      if (date.to && orderDate > date.to) matchesDate = false;
    }

    return (
      matchesOrderId &&
      matchesReference &&
      matchesSeatSize &&
      matchesOrderStatus &&
      matchesFitter &&
      matchesUrgent &&
      matchesCustomer &&
      matchesSupplier &&
      matchesSaddle &&
      matchesCustomerCountry &&
      matchesFitterCountry &&
      matchesKneeRoll &&
      matchesLeatherType &&
      matchesSaleType &&
      matchesDate
    );
  });

  // Tijdelijke log om te debuggen
  useEffect(() => {
    logger.log('API orders:', orders);
    logger.log('Processed orders:', processedOrders);
    logger.log('Filtered orders:', filteredOrders);
    logger.log('Header filters:', headerFilters);
    logger.log('Date filter:', date);
    logger.log('Ordered date filter:', orderedDate);
    logger.log('Payment date filter:', paymentDate);
  }, [orders, processedOrders, filteredOrders, headerFilters, date, orderedDate, paymentDate]);

  // ========== EXPORT ALL ==========
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      // Build the same filters as the current view
      const filters: Record<string, string | boolean> = {};
      Object.keys(headerFilters).forEach(key => {
        if (headerFilters[key] && headerFilters[key] !== '') {
          if (key === 'orderId') filters.orderId = headerFilters[key];
          else if (key === 'reference') filters.fitterReference = headerFilters[key];
          else if (key === 'customer') filters.customerName = headerFilters[key];
          else if (key === 'status') filters.orderStatus = headerFilters[key];
          else if (key === 'fitter') filters.fitterName = headerFilters[key];
          else if (key === 'supplier') filters.supplierName = headerFilters[key];
          else if (key === 'urgent') {
            if (headerFilters[key] === 'true') filters.urgent = true;
            else if (headerFilters[key] === 'false') filters.urgent = false;
          } else if (key === 'seatSize') filters.seatSizes = headerFilters[key];
          else if (key === 'customerCountry') filters.customerCountry = headerFilters[key];
          else if (key === 'fitterCountry') filters.fitterCountry = headerFilters[key];
          else if (key === 'saddle') filters.saddleName = headerFilters[key];
          else if (key === 'kneeRoll') filters.kneeRoll = headerFilters[key];
          else if (key === 'leatherType') filters.leatherType = headerFilters[key];
          else if (key === 'saleType') filters.saleType = headerFilters[key];
        }
      });

      // Fetch all pages (backend caps at 100/page)
      const allOrders: unknown[] = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        const data = await getEnrichedOrders({
          page: currentPage,
          partial: true,
          filters: { ...filters, limit: '100' } as Record<string, string>,
          orderBy: 'orderId',
          order: 'desc',
        });

        let memberArr: unknown[] = [];
        if (data['hydra:member']) memberArr = data['hydra:member'];
        else if (Array.isArray(data.data)) memberArr = data.data;
        else if (Array.isArray(data)) memberArr = data;

        allOrders.push(...memberArr);

        const total = data.total || data['hydra:totalItems'] || 0;
        hasMore = allOrders.length < total && memberArr.length === 100;
        currentPage++;
      }

      // Apply client-side date filtering consistent with filteredOrders
      const filteredAll = allOrders.filter((order: unknown) => {
        if (!date.from && !date.to) return true;
        const orderDate = new Date(getDate(order as Record<string, unknown>));
        if (date.from && orderDate < date.from) return false;
        if (date.to && orderDate > date.to) return false;
        return true;
      });

      await exportToXlsx(filteredAll as Record<string, unknown>[]);
    } catch (err) {
      logger.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [headerFilters, date]);

  // ========== SAVED FILTERS: serialize / apply / effects ==========

  const serializeFilters = useCallback((): Record<string, unknown> => {
    return {
      fitters: selectedFitters,
      statuses: selectedStatuses,
      saleTypes: selectedSaleTypes,
      customers: selectedCustomers,
      factories: selectedFactories,
      saddles: selectedSaddles,
      customerCountries: selectedCustomerCountries,
      fitterCountries: selectedFitterCountries,
      seatSizes: selectedSeatSizes,
      kneeRolls: selectedKneeRolls,
      leatherTypes: selectedLeatherTypes,
      urgent: selectedUrgent,
      orderedDate: {
        from: orderedDate.from?.toISOString() ?? null,
        to: orderedDate.to?.toISOString() ?? null,
      },
      date: {
        from: date.from?.toISOString() ?? null,
        to: date.to?.toISOString() ?? null,
      },
      paymentDate: {
        from: paymentDate.from?.toISOString() ?? null,
        to: paymentDate.to?.toISOString() ?? null,
      },
      groupBySaddle,
    };
  }, [
    selectedFitters, selectedStatuses, selectedSaleTypes, selectedCustomers,
    selectedFactories, selectedSaddles, selectedCustomerCountries, selectedFitterCountries,
    selectedSeatSizes, selectedKneeRolls, selectedLeatherTypes, selectedUrgent,
    orderedDate, date, paymentDate, groupBySaddle,
  ]);

  const applyFilterState = useCallback((f: Record<string, unknown>) => {
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v : []);
    const parseDate = (v: unknown): Date | undefined => (typeof v === 'string' ? new Date(v) : undefined);

    setSelectedFitters(arr(f.fitters));
    setSelectedStatuses(arr(f.statuses));
    setSelectedSaleTypes(arr(f.saleTypes));
    setSelectedCustomers(arr(f.customers));
    setSelectedFactories(arr(f.factories));
    setSelectedSaddles(arr(f.saddles));
    setSelectedCustomerCountries(arr(f.customerCountries));
    setSelectedFitterCountries(arr(f.fitterCountries));
    setSelectedSeatSizes(arr(f.seatSizes));
    setSelectedKneeRolls(arr(f.kneeRolls));
    setSelectedLeatherTypes(arr(f.leatherTypes));
    setSelectedUrgent(typeof f.urgent === 'string' ? f.urgent : 'all');
    setGroupBySaddle(f.groupBySaddle === true);

    const dateObj = f.orderedDate as { from?: string | null; to?: string | null } | undefined;
    setOrderedDate({ from: parseDate(dateObj?.from), to: parseDate(dateObj?.to) });
    const dObj = f.date as { from?: string | null; to?: string | null } | undefined;
    setDate({ from: parseDate(dObj?.from), to: parseDate(dObj?.to) });
    const pObj = f.paymentDate as { from?: string | null; to?: string | null } | undefined;
    setPaymentDate({ from: parseDate(pObj?.from), to: parseDate(pObj?.to) });

    // Rebuild headerFilters from multi-select arrays
    const newHeaderFilters: Record<string, string> = {};
    if (arr(f.fitters).length) newHeaderFilters.fitter = arr(f.fitters).join(',');
    if (arr(f.statuses).length) newHeaderFilters.status = arr(f.statuses).join(',');
    if (arr(f.saleTypes).length) newHeaderFilters.saleType = arr(f.saleTypes).join(',');
    if (arr(f.customers).length) newHeaderFilters.customer = arr(f.customers).join(',');
    if (arr(f.factories).length) newHeaderFilters.supplier = arr(f.factories).join(',');
    if (arr(f.saddles).length) newHeaderFilters.saddle = arr(f.saddles).join(',');
    if (arr(f.customerCountries).length) newHeaderFilters.customerCountry = arr(f.customerCountries).join(',');
    if (arr(f.fitterCountries).length) newHeaderFilters.fitterCountry = arr(f.fitterCountries).join(',');
    if (arr(f.seatSizes).length) newHeaderFilters.seatSize = arr(f.seatSizes).join(',');
    if (arr(f.kneeRolls).length) newHeaderFilters.kneeRoll = arr(f.kneeRolls).join(',');
    if (arr(f.leatherTypes).length) newHeaderFilters.leatherType = arr(f.leatherTypes).join(',');
    const urgent = typeof f.urgent === 'string' ? f.urgent : 'all';
    if (urgent !== 'all') newHeaderFilters.urgent = urgent === 'urgent' ? 'true' : 'false';
    setHeaderFilters(newHeaderFilters);
    setPage(1);
  }, []);

  // Load saved filters list
  const refreshSavedFilters = useCallback(() => {
    getSavedFilters().then(setSavedFilters).catch(() => {});
  }, []);

  useEffect(() => { refreshSavedFilters(); }, [refreshSavedFilters]);

  // Auto-load default filter on mount
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  useEffect(() => {
    if (defaultLoaded) return;
    getDefaultFilter().then(df => {
      if (df) {
        applyFilterState(df.filters);
        setActiveSavedFilterId(df.id);
      }
      setDefaultLoaded(true);
    }).catch(() => setDefaultLoaded(true));
  }, [defaultLoaded, applyFilterState]);

  const handleSaveFilter = async () => {
    if (!saveFilterName.trim()) {
      setSaveError('Name is required');
      return;
    }
    setSaveError('');
    try {
      const created = await createSavedFilter({
        name: saveFilterName.trim(),
        filters: serializeFilters(),
        isDefault: saveFilterDefault,
      });
      setIsSaveDialogOpen(false);
      setSaveFilterName('');
      setSaveFilterDefault(false);
      setActiveSavedFilterId(created.id);
      refreshSavedFilters();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Order Reports</h2>

      {/* Saved filters bar */}
      <div className="flex items-center gap-3 mb-4">
        <Select
          value={activeSavedFilterId ? String(activeSavedFilterId) : "none"}
          onValueChange={(val) => {
            if (val === "none") return;
            const sf = savedFilters.find(f => f.id === Number(val));
            if (sf) {
              applyFilterState(sf.filters);
              setActiveSavedFilterId(sf.id);
            }
          }}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Load saved filter..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Load saved filter...</SelectItem>
            {savedFilters.map(sf => (
              <SelectItem key={sf.id} value={String(sf.id)}>
                {sf.isDefault ? '\u2605 ' : ''}{sf.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="destructive" className="bg-[#8B0000]" onClick={() => {
          setSaveFilterName('');
          setSaveFilterDefault(false);
          setSaveError('');
          setIsSaveDialogOpen(true);
        }}>
          Save current filters
        </Button>

        {savedFilters.length > 0 && (
          <Button variant="outline" onClick={() => setIsManageDialogOpen(true)}>
            Manage saved filters
          </Button>
        )}
      </div>

      <div className="bg-gray-100 p-6 rounded-lg mb-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="w-32">Ordered from</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {orderedDate.from ? formatDate(orderedDate.from) : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={orderedDate.from}
                    onSelect={(date) => setOrderedDate(prev => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span>to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {orderedDate.to ? formatDate(orderedDate.to) : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={orderedDate.to}
                    onSelect={(date) => setOrderedDate(prev => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32">Date from</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date.from ? formatDate(date.from) : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date.from}
                    onSelect={(selectedDate) => setDate(prev => ({ ...prev, from: selectedDate }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span>to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date.to ? formatDate(date.to) : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date.to}
                    onSelect={(selectedDate) => setDate(prev => ({ ...prev, to: selectedDate }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32">Payment from</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate.from ? formatDate(paymentDate.from) : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentDate.from}
                    onSelect={(selectedDate) => setPaymentDate(prev => ({ ...prev, from: selectedDate }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span>to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate.to ? formatDate(paymentDate.to) : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentDate.to}
                    onSelect={(selectedDate) => setPaymentDate(prev => ({ ...prev, to: selectedDate }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <MultiSelectFilter
              label="Fitters"
              options={fittersList}
              selected={selectedFitters}
              onChangeSelected={(values) => {
                setSelectedFitters(values);
                updateMultiFilter('fitter', values);
              }}
            />

            <MultiSelectFilter
              label="Order statuses"
              options={orderStatuses.map(s => ({ label: s, value: s }))}
              selected={selectedStatuses}
              onChangeSelected={(values) => {
                setSelectedStatuses(values);
                updateMultiFilter('status', values);
              }}
            />

            <MultiSelectFilter
              label="Saletypes"
              options={saleTypeOptions}
              selected={selectedSaleTypes}
              onChangeSelected={(values) => {
                setSelectedSaleTypes(values);
                updateMultiFilter('saleType', values);
              }}
            />

            <MultiSelectFilter
              label="Customers"
              options={customersList}
              selected={selectedCustomers}
              onChangeSelected={(values) => {
                setSelectedCustomers(values);
                updateMultiFilter('customer', values);
              }}
            />
          </div>

          <div className="space-y-4">
            <MultiSelectFilter
              label="Factories"
              options={suppliers}
              selected={selectedFactories}
              onChangeSelected={(values) => {
                setSelectedFactories(values);
                updateMultiFilter('supplier', values);
              }}
            />

            <MultiSelectFilter
              label="Saddles"
              options={modelsList}
              selected={selectedSaddles}
              onChangeSelected={(values) => {
                setSelectedSaddles(values);
                updateMultiFilter('saddle', values);
              }}
            />

            <MultiSelectFilter
              label="Customer Countries"
              options={dynamicCustomerCountries.map(c => ({ label: c, value: c }))}
              selected={selectedCustomerCountries}
              onChangeSelected={(values) => {
                setSelectedCustomerCountries(values);
                updateMultiFilter('customerCountry', values);
              }}
            />

            <MultiSelectFilter
              label="Fitter Countries"
              options={dynamicFitterCountries.map(c => ({ label: c, value: c }))}
              selected={selectedFitterCountries}
              onChangeSelected={(values) => {
                setSelectedFitterCountries(values);
                updateMultiFilter('fitterCountry', values);
              }}
            />

            <MultiSelectFilter
              label="Seatsizes"
              options={Array.from(new Set([...['15', '15.5', '16', '16.5', '17', '17.5', '18', '18.5', '19'], ...dynamicSeatSizes]))
                .sort((a, b) => parseFloat(a) - parseFloat(b))
                .map(size => ({ label: size, value: size }))}
              selected={selectedSeatSizes}
              onChangeSelected={(values) => {
                setSelectedSeatSizes(values);
                updateMultiFilter('seatSize', values);
              }}
            />

            <MultiSelectFilter
              label="Knee Roll"
              options={kneeRollOptions.map(kr => ({ label: kr, value: kr }))}
              selected={selectedKneeRolls}
              onChangeSelected={(values) => {
                setSelectedKneeRolls(values);
                updateMultiFilter('kneeRoll', values);
              }}
            />

            <MultiSelectFilter
              label="Leather Type"
              options={leatherTypeOptions.map(lt => ({ label: lt, value: lt }))}
              selected={selectedLeatherTypes}
              onChangeSelected={(values) => {
                setSelectedLeatherTypes(values);
                updateMultiFilter('leatherType', values);
              }}
            />

            <div className="flex items-center gap-2">
              <label className="w-32">Urgent</label>
              <Select value={selectedUrgent} onValueChange={(value) => {
                setSelectedUrgent(value);
                setHeaderFilters(prev => ({
                  ...prev,
                  urgent: value === 'all' ? '' : value === 'urgent' ? 'true' : 'false'
                }));
                setPage(1);
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="not-urgent">Not Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 mt-8">
              <label className="w-32"></label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="groupBySaddle"
                  checked={groupBySaddle}
                  onCheckedChange={(checked) => setGroupBySaddle(checked as boolean)}
                />
                <label htmlFor="groupBySaddle">Group by saddle</label>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-8">
              <Button variant="destructive" className="bg-[#8B0000]">
                Generate report
              </Button>
              <Button variant="destructive" className="bg-[#8B0000]" onClick={handleExport} disabled={isExporting}>
                {isExporting ? 'Exporting...' : 'Export report'}
              </Button>
              
              {/* Reset All Filters Button */}
              {(Object.keys(headerFilters).some(key => headerFilters[key]) ||
                selectedUrgent !== 'all' ||
                date.from || date.to) && (
                <Button
                  variant="outline"
                  className="border-red-600 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    logger.log('Resetting all Reports filters');
                    setHeaderFilters({});
                    setSelectedFitters([]);
                    setSelectedStatuses([]);
                    setSelectedSaleTypes([]);
                    setSelectedCustomers([]);
                    setSelectedFactories([]);
                    setSelectedSaddles([]);
                    setSelectedCustomerCountries([]);
                    setSelectedFitterCountries([]);
                    setSelectedSeatSizes([]);
                    setSelectedKneeRolls([]);
                    setSelectedLeatherTypes([]);
                    setSelectedUrgent('all');
                    setDate({ from: undefined, to: undefined });
                    setOrderedDate({ from: undefined, to: undefined });
                    setPaymentDate({ from: undefined, to: undefined });
                    setPage(1);
                    setSearchTerm('');
                  }}
                >
                  Reset All Filters
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active filter chips shown above results */}
      {(() => {
        const chips: { label: string; onRemove: () => void }[] = [];
        if (selectedCustomerCountries.length > 0) {
          selectedCustomerCountries.forEach(c => chips.push({
            label: `Customer Country: ${c}`,
            onRemove: () => {
              const next = selectedCustomerCountries.filter(v => v !== c);
              setSelectedCustomerCountries(next);
              updateMultiFilter('customerCountry', next);
            },
          }));
        }
        if (selectedFitterCountries.length > 0) {
          selectedFitterCountries.forEach(c => chips.push({
            label: `Fitter Country: ${c}`,
            onRemove: () => {
              const next = selectedFitterCountries.filter(v => v !== c);
              setSelectedFitterCountries(next);
              updateMultiFilter('fitterCountry', next);
            },
          }));
        }
        if (chips.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-2 mb-4">
            {chips.map((chip, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                {chip.label}
                <button type="button" onClick={chip.onRemove} className="ml-1 hover:bg-blue-200 rounded-full p-0.5">
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </span>
            ))}
          </div>
        );
      })()}

      {error ? (
        <div>Error: {error}</div>
      ) : (
        <div>
          <OrdersTable
            {...{
              orders: filteredOrders,
              columns,
              searchTerm,
              onSearch: setSearchTerm,
              headerFilters,
              onFilterChange: (key: string, value: string) => setHeaderFilters(prev => ({ ...prev, [key]: value })),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onViewOrder: (order: any) => {
                setSelectedOrder(order);
                setIsDetailsOpen(true);
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onEditOrder: (order: any) => {
                setSelectedOrder(order);
                setIsEditOpen(true);
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onApproveOrder: (order: any) => logger.log('Approve order:', order),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onDeleteOrder: (order: any) => logger.log('Delete order:', order),
              seatSizes,
              statuses,
              fitters: fittersList.map(f => f.label),
              dateFrom: date.from,
              setDateFrom: (from: Date | undefined) => setDate(d => ({ ...d, from })),
              dateTo: date.to,
              setDateTo: (to: Date | undefined) => setDate(d => ({ ...d, to })),
              loading,
              error: error ?? undefined,
              pagination: {
                currentPage: page,
                totalPages: totalPages,
                onPageChange: setPage,
                totalItems: totalItems,
                itemsPerPage: 50,
              }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any}
          />
        </div>
      )}

      {/* Order details dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        {selectedOrder && (
          <OrderDetails
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            order={selectedOrder as any}
            onClose={() => setIsDetailsOpen(false)}
            onOrderChanged={() => {
              setIsDetailsOpen(false);
              setRefreshKey(k => k + 1);
            }}
          />
        )}
      </Dialog>

      {/* Edit order dialog */}
      <Dialog open={isEditOpen} onOpenChange={() => setIsEditOpen(false)}>
        {selectedOrder && (
          <ComprehensiveEditOrder
            order={{
              id: String(selectedOrder.id),
              orderId: Number(selectedOrder.orderId || selectedOrder.id)
            }}
            onClose={() => {
              setIsEditOpen(false);
            }}
          />
        )}
      </Dialog>

      {/* Save filter dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save current filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={saveFilterName}
                onChange={(e) => setSaveFilterName(e.target.value)}
                placeholder="e.g. Q1 European Orders"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFilter(); }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="saveFilterDefault"
                checked={saveFilterDefault}
                onCheckedChange={(checked) => setSaveFilterDefault(checked as boolean)}
              />
              <label htmlFor="saveFilterDefault" className="text-sm">Set as default (auto-load on page open)</label>
            </div>
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveFilter}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage saved filters dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage saved filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[400px] overflow-y-auto">
            {savedFilters.map(sf => (
              <div key={sf.id} className="flex items-center gap-2 p-2 rounded border">
                <button
                  type="button"
                  title={sf.isDefault ? 'Default filter' : 'Set as default'}
                  className="shrink-0"
                  onClick={async () => {
                    await updateSavedFilter(sf.id, { isDefault: !sf.isDefault });
                    refreshSavedFilters();
                  }}
                >
                  <Star className={`h-4 w-4 ${sf.isDefault ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                </button>
                <span className="flex-1 text-sm truncate">{sf.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    applyFilterState(sf.filters);
                    setActiveSavedFilterId(sf.id);
                    setIsManageDialogOpen(false);
                  }}
                >
                  Load
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={async () => {
                    await deleteSavedFilter(sf.id);
                    if (activeSavedFilterId === sf.id) setActiveSavedFilterId(null);
                    refreshSavedFilters();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {savedFilters.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No saved filters yet.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManageDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}