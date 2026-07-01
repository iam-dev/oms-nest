"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Package, Search } from 'lucide-react';
import { OrdersTable } from '@/components/shared/OrdersTable';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { logger } from '@/utils/logger';
import { useUserRole } from '@/hooks/useUserRole';
import { getFitterName, getCustomerName, getSupplierName, getUrgent } from '../utils/orderHydration';
import { getOrderTableColumns } from '../utils/orderTableColumns';
import type { OrdersTableColumn } from '@/components/shared/OrdersTable';
import { seatSizes, statuses } from '../utils/orderConstants';
import {
  buildOrderFilters,
  extractDynamicSeatSizes,
  extractDynamicFactories,
  processDashboardOrders,
  fetchCompleteOrderData
} from '../utils/orderProcessing';
import { getOrderStatusStats } from '../services/dashboard';
import { getEnrichedOrders, getAllStatusValues, universalSearch } from '@/services/enrichedOrders';
import { useDebounce } from '@/hooks/useDebounce';
import { API_URL } from '@/services/api-config';
import DashboardOrderStatusFlow from './DashboardOrderStatusFlow';
import Reports from '@/components/Reports';
import { OrderDetails } from '@/components/OrderDetails';
import { OrderEditModal } from '@/components/shared/OrderEditModal';
import { OrderApprovalModal } from '@/components/shared/OrderApprovalModal';
import { EditOrder } from '@/components/EditOrder';
import { ComprehensiveEditOrder } from '@/components/ComprehensiveEditOrder';
import { Dialog } from '@/components/ui/dialog';

const orderStatusData = {
  unordered: { count: 503, label: 'Unordered' },
  orderedChanged: { count: 65, label: 'Ordered/Changed' },
  approved: { count: 900, label: 'Approved' },
  inProductionP1: { count: 558, label: 'In Production P1' },
  inProductionP2: { count: 543, label: 'In Production P2' },
  inProductionP3: { count: 311, label: 'In Production P3' },
  shippedToFitter: { count: 7505, label: 'Shipped to Fitter' },
  shippedToCustomer: { count: 1142, label: 'Shipped to Customer' },
  inventory: { count: 671, label: 'Inventory' },
  onHold: { count: 204, label: 'On hold' },
  onTrial: { count: 6, label: 'On trial' },
  completedSale: { count: 33346, label: 'Completed sale' }
};

export default function Dashboard() {
  const { isFitter } = useUserRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orderStatusStats, setOrderStatusStats] = useState<any>(null);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500); // 500ms delay
  // Declared before the useEffect below that resets it on search-term changes.
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when search term changes
  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      // TODO(react-hooks): synchronous page reset driven by a debounced search term;
      // this is a deliberate single-state sync (not cascading) — the debounce already
      // batches user input, so this one setState cannot cause an infinite loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [headerFilters, setHeaderFilters] = useState<Record<string, string>>({});
  const [date, setDate] = React.useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 30;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [dateFilterTrigger, setDateFilterTrigger] = useState(0);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isLoadingOrderData, setIsLoadingOrderData] = useState(false);
  const [orderDataError, setOrderDataError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [useComprehensiveEdit, setUseComprehensiveEdit] = useState(true); // Toggle for new comprehensive editor

  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  

  useEffect(() => {
    // Load status stats
    getOrderStatusStats()
      .then(data => {
        setOrderStatusStats(data);
        const total = Object.values(data.orderStatusCounts || {}).reduce((sum: number, v) => sum + Number(v), 0);
        setTotalOrders(total);
      })
      .catch(() => {
        setOrderStatusStats(null);
        const total = Object.values(orderStatusData).reduce((sum: number, s) => sum + (s.count || 0), 0);
        setTotalOrders(total);
      });
    
    // Load actual status values from database for debugging
    getAllStatusValues().then(statuses => {
      logger.log('Dashboard: Actual status values in database:', statuses);
    });
  }, []);

  useEffect(() => {
    // TODO(react-hooks): setLoadingOrders/setOrdersError are synchronous guards before
    // async fetch chains; all data setState calls happen in .then()/.catch() callbacks —
    // standard loading-state pattern. The rule fires on the synchronous guard calls.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingOrders(true);
    setOrdersError('');

    // If we have a search term, use universal search instead of regular filtering
    if (debouncedSearchTerm.trim()) {
      logger.log('Dashboard: Performing universal search for:', debouncedSearchTerm);
      
      universalSearch(debouncedSearchTerm.trim())
        .then(data => {
          logger.log('Dashboard: Search results received:', {
            totalItems: data['hydra:totalItems'],
            memberCount: data['hydra:member']?.length,
            searchTerm: debouncedSearchTerm
          });
          
          // Update pagination state for search results
          const total = data['hydra:totalItems'] || 0;
          setTotalItems(total);
          setTotalPages(Math.max(1, Math.ceil(total / itemsPerPage)));
          
          // Process search results
          const processedOrders = processDashboardOrders(data as unknown as Record<string, unknown>);
          setOrders(processedOrders);
          setLoadingOrders(false);
        })
        .catch((error) => {
          logger.error('Dashboard: Search failed:', error);
          setOrdersError('Search failed. Please try again.');
          setLoadingOrders(false);
        });
    } else {
      // Build comprehensive filters from headerFilters using shared utility
      const filters = buildOrderFilters(headerFilters) as Record<string, string>;

      // Add date filters if set
      if (date.from) {
        filters['orderTime[after]'] = date.from.toISOString().split('T')[0];
      }
      if (date.to) {
        filters['orderTime[before]'] = date.to.toISOString().split('T')[0];
      }

      logger.log('Dashboard: Fetching orders with filters:', filters);
      logger.log('Dashboard: Current page:', currentPage);

      getEnrichedOrders({
        page: currentPage,
        partial: false,
        filters,
        bustCache: dateFilterTrigger > 0,
      })
      .then(data => {
        logger.log('Dashboard: Received API response:', {
          totalItems: data['hydra:totalItems'],
          memberCount: data['hydra:member']?.length,
          currentPage: currentPage
        });
        
        // Update pagination state
        const total = data['hydra:totalItems'] || 0;
        setTotalItems(total);
        setTotalPages(Math.max(1, Math.ceil(total / itemsPerPage)));
        
        // Log first few orders to see their complete structure
        if (data['hydra:member'] && data['hydra:member'].length > 0) {
          logger.log('Dashboard: Sample order data from API:',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data['hydra:member'].slice(0, 3).map((order: any) => ({
              orderId: order.orderId,
              orderStatus: order.orderStatus,
              status: order.status,
              customerName: order.customerName,
              fitterName: order.fitterName,
              supplierName: order.supplierName,
              customer: order.customer,
              fitter: order.fitter,
              supplier: order.supplier
            }))
          );
          
          // Special logging for order 41059 if it exists
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const order41059 = data['hydra:member'].find((order: any) =>
            order.orderId == 41059 || order.orderId === '41059'
          );
          if (order41059) {
            logger.log('Dashboard: Found order 41059 with data:', {
              orderId: order41059.orderId,
              customerName: order41059.customerName,
              fitterName: order41059.fitterName,
              supplierName: order41059.supplierName,
              customer: order41059.customer,
              fitter: order41059.fitter,
              supplier: order41059.supplier,
              orderStatus: order41059.orderStatus
            });
          }
        }
        
        // Process orders using shared utility
        const processedOrders = processDashboardOrders(data);
        setOrders(processedOrders);
        setLoadingOrders(false);
      })
      .catch(() => {
        setOrdersError('Failed to load orders');
        setLoadingOrders(false);
      });
    }
  }, [headerFilters, currentPage, dateFilterTrigger, debouncedSearchTerm, date.from, date.to]);

  useEffect(() => {
    if (refreshInterval.current) clearInterval(refreshInterval.current);
    refreshInterval.current = setInterval(() => {
      // Build the same filters for refresh using shared utility
      const filters = buildOrderFilters(headerFilters) as Record<string, string>;

      if (date.from) {
        filters['orderTime[after]'] = date.from.toISOString().split('T')[0];
      }
      if (date.to) {
        filters['orderTime[before]'] = date.to.toISOString().split('T')[0];
      }

      getEnrichedOrders({
        page: currentPage,
        partial: false,
        filters,
      })
        .then(data => {
          // Process orders to ensure they have all required fields while preserving API data
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const processedOrders = (data['hydra:member'] || []).map((order: any) => {
            // Extract and normalize data from the hydra response
            const processedOrder = {
              ...order, // Keep all original API data
              // Add computed fields for compatibility, but don't override existing data
              id: order.id || order.orderId || '',
              saddle: order.reference || '',
              date: order.orderTime || order.createdAt || '',
              status: order.orderStatus || order.status || '',
              orderStatus: order.orderStatus || order.status || '',
              orderTime: order.orderTime || order.createdAt || '',
              isUrgent: order.urgent === true || order.urgency === 1 || order.urgency === true || false,
              urgent: order.urgent === true || order.urgency === 1 || order.urgency === true || false,
              // Extract seat sizes from reference, seat_sizes or seatSizes array if not already present
              seatSize: (order.seat_sizes || order.seatSizes) ?
                (Array.isArray(order.seat_sizes || order.seatSizes) ? (order.seat_sizes || order.seatSizes).join(', ') : (order.seat_sizes || order.seatSizes)) :
                extractDynamicSeatSizes([order]).join(', '),
              // Only add computed names if the direct fields aren't available
              ...(order.customerName ? {} : { customer: getCustomerName(order) || '' }),
              ...(order.fitterName ? {} : { fitter: getFitterName(order) || '' }),
              ...(order.supplierName ? {} : { supplier: getSupplierName(order) || '' })
            };
            return processedOrder;
          });
          setOrders(processedOrders);
        })
        .catch(() => {
          // Optionally: setOrdersError('Failed to auto-refresh orders');
        });
    }, 300000); // 5 minuten
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, [headerFilters, currentPage, dateFilterTrigger, date.from, date.to]);

  // Extract unique seat sizes from orders using shared utility
  const dynamicSeatSizes = React.useMemo(() => {
    return extractDynamicSeatSizes(orders);
  }, [orders]);

  // Extract unique factory names from orders for filter dropdown
  const dynamicFactories = React.useMemo(() => {
    return extractDynamicFactories(orders);
  }, [orders]);

  const columns = getOrderTableColumns(
    headerFilters,
    (key, value) => {
      setHeaderFilters(prev => ({ ...prev, [key]: value }));
      // Reset to page 1 when filters change
      setCurrentPage(1);
    },
    dynamicFactories,
    dynamicSeatSizes,
    { hideFitter: isFitter }
  ) as unknown as OrdersTableColumn[];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const urgentOrdersCount = orders.filter(order => getUrgent(order)).length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveOrder = async (updatedOrder: any) => {
    try {
      logger.log('Saving order:', updatedOrder);
      // TODO: Implement actual API call to update the order
      // For now, just update the local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === updatedOrder.id || order.orderId === updatedOrder.orderId 
            ? { ...order, ...updatedOrder }
            : order
        )
      );
      
      // Here you would typically make an API call like:
      // await updateOrder(updatedOrder.id, updatedOrder);
      
      logger.log('Order saved successfully');
    } catch (error) {
      logger.error('Error saving order:', error);
      throw error; // Re-throw to let the modal handle the error
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleApproveOrder = async (order: any, approvalNotes?: string) => {
    try {
      const oid = order.orderId || order.id;
      logger.log('Approving order:', oid, 'with notes:', approvalNotes);

      const response = await fetch(`${API_URL}/api/v1/enriched_orders/update-status/${oid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'Approved' }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Failed to update status (${response.status}): ${body || response.statusText}`);
      }

      setOrders(prevOrders =>
        prevOrders.map(o =>
          o.id === order.id || o.orderId === order.orderId
            ? { ...o, orderStatus: 'Approved', status: 'Approved' }
            : o
        )
      );

      logger.log('Order approved successfully in database');
    } catch (error) {
      logger.error('Error approving order:', error);
      // Show user-friendly error message
      alert(`Failed to approve order: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  // Use shared fetchCompleteOrderData utility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  const fetchCompleteOrderDataWrapper = async (order: any): Promise<any> => {
    return fetchCompleteOrderData(order, setIsLoadingOrderData, setOrderDataError);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleStatusCardClick = (status: string) => {
    logger.log('Dashboard: Status card clicked:', status);
    logger.log('Dashboard: Current selectedStatus:', selectedStatus);
    
    const newStatus = status === selectedStatus ? '' : status;
    logger.log('Dashboard: Setting new status filter to:', newStatus);
    
    setSelectedStatus(newStatus);
    setHeaderFilters(prev => ({
      ...prev,
      status: newStatus
    }));
    // Reset to page 1 when status filter changes
    setCurrentPage(1);
  };

  // All filtering is now done server-side, no client-side filtering needed
  const filteredOrders = orders;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const statusData = orderStatusStats || orderStatusData;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  const statusList = Object.entries(orderStatusStats || orderStatusData).map(([key, val]: any) => ({
    key,
    label: val.label,
    count: val.count,
    color: '#7b2326',
  }));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function DatePickerField({ label, date, setDate }: { label: string; date: Date | undefined; setDate: (date: Date | undefined) => void }) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground mb-1">{label}</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={
                "w-[140px] justify-start text-left font-normal" +
                (!date ? " text-muted-foreground" : "")
              }
            >
              {date ? date.toLocaleDateString() : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Show EditOrder component if editing
  if (isEditingOrder && selectedOrder) {
    return (
      <Dialog open={isEditingOrder} onOpenChange={() => {
        setIsEditingOrder(false);
        setSelectedOrder(null);
      }}>
        {useComprehensiveEdit ? (
          <ComprehensiveEditOrder
            order={{
              id: selectedOrder.id,
              orderId: selectedOrder.orderId || selectedOrder.id
            }}
            onClose={() => {
              setIsEditingOrder(false);
              setSelectedOrder(null);
              setOrderDataError(null);
            }}
            onBack={() => {
              setIsEditingOrder(false);
              setSelectedOrder(null);
              setOrderDataError(null);
            }}
          />
        ) : (
          <EditOrder
            order={selectedOrder}
            isLoading={isLoadingOrderData}
            error={orderDataError}
            onClose={() => {
              setIsEditingOrder(false);
              setSelectedOrder(null);
              setOrderDataError(null);
            }}
            onBack={() => {
              setIsEditingOrder(false);
              setSelectedOrder(null);
              setOrderDataError(null);
            }}
          />
        )}
      </Dialog>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold">Dashboard</h2>
      <Tabs defaultValue="all-orders" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all-orders">All Orders</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="all-orders" className="space-y-4">
          {/* Order Status Overview */}
          <DashboardOrderStatusFlow
            onStatusClick={key => {
              logger.log('Dashboard: Status flow clicked with key:', key);
              setHeaderFilters(f => ({...f, status: key}));
              setCurrentPage(1); // Reset to page 1 when status filter changes
            }}
            onTotalOrders={setTotalOrders}
            selectedStatus={headerFilters.status || ''}
          />

          {/* All Orders header - clickable to reset filters */}
          <div style={{
            display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 18, marginLeft: 0
          }}>
            <button 
              onClick={() => {
                logger.log('Resetting all filters via All Orders button');
                setHeaderFilters({});
                setDate({ from: undefined, to: undefined });
                setCurrentPage(1);
              }}
              style={{
                background: '#fff',
                border: 'none',
                borderRadius: 18,
                padding: '2px 18px',
                fontWeight: 600,
                color: '#7b2326',
                fontSize: 18,
                minWidth: 140,
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                boxShadow: '0 2px 6px rgba(123,35,38,0.07)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#7b2326';
                e.currentTarget.style.color = '#fff';
                const countSpan = e.currentTarget.querySelector('span');
                if (countSpan) {
                  countSpan.style.background = '#fff';
                  countSpan.style.color = '#7b2326';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.color = '#7b2326';
                const countSpan = e.currentTarget.querySelector('span');
                if (countSpan) {
                  countSpan.style.background = '#fff';
                  countSpan.style.color = '#7b2326';
                }
              }}
              title="Click to reset all filters"
            >
              All Orders
              <span style={{
                display: 'inline-block',
                marginLeft: 18,
                fontSize: 16,
                fontWeight: 700,
                color: '#7b2326',
                background: '#fff',
                border: 'none',
                borderRadius: 15,
                padding: '2px 10px',
                minWidth: 32,
                textAlign: 'center',
                transition: 'background 0.15s, color 0.15s',
              }}>{totalOrders > 0 ? totalOrders : ''}</span>
            </button>
            
            {/* Reset All Filters Button */}
            {(Object.keys(headerFilters).some(key => headerFilters[key]) || date.from || date.to || searchTerm.trim()) && (
              <button
                onClick={() => {
                  logger.log('Resetting all filters and search via Reset button');
                  setHeaderFilters({});
                  setDate({ from: undefined, to: undefined });
                  setSearchTerm(''); // Clear search term
                  setCurrentPage(1);
                }}
                style={{
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontWeight: 500,
                  color: '#fff',
                  fontSize: 14,
                  marginLeft: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 4px rgba(220,38,38,0.2)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#b91c1c';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#dc2626';
                }}
                title="Clear all active filters and search"
              >
                Reset All Filters
              </button>
            )}
            
            {/* Search Status Indicator */}
            {debouncedSearchTerm.trim() && (
              <div style={{
                marginLeft: 12,
                padding: '4px 8px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Search size={16} />
                Searching for: &quot;{debouncedSearchTerm}&quot;
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 0,
                    marginLeft: 4
                  }}
                  title="Clear search"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* All Orders */}
          <div style={{ marginTop: 32 }}>
            {loadingOrders ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7b2326] mb-4"></div>
                <p className="text-gray-600">
                  {debouncedSearchTerm.trim() ? 'Searching orders...' : 'Loading orders...'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {debouncedSearchTerm.trim() 
                    ? `Searching for "${debouncedSearchTerm}"`
                    : headerFilters.status || Object.keys(headerFilters).some(key => headerFilters[key]) 
                      ? 'Applying filters...' 
                      : `Page ${currentPage} of ${totalPages}`}
                </p>
              </div>
            ) : ordersError ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="text-red-600 text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-semibold">Error Loading Orders</p>
                  <p className="text-sm text-gray-600 mt-1">{ordersError}</p>
                  <Button 
                    onClick={() => window.location.reload()} 
                    className="mt-3 bg-red-600 hover:bg-red-700"
                    size="sm"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="text-gray-500 text-center">
                  <Package className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-semibold">No Orders Found</p>
                  <p className="text-sm mt-1">
                    {debouncedSearchTerm.trim()
                      ? `No orders found matching "${debouncedSearchTerm}". Try searching for order ID, customer name, fitter name, or supplier name.`
                      : Object.keys(headerFilters).some(key => headerFilters[key]) || date.from || date.to
                        ? 'Try adjusting your filters to see more results.'
                        : 'There are no orders to display.'}
                  </p>
                  {debouncedSearchTerm.trim() && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <OrdersTable
                orders={filteredOrders}
                columns={columns}
                searchTerm={searchTerm}
                onSearch={setSearchTerm}
                headerFilters={headerFilters}
                onFilterChange={(key: string, value: string) => {
                  if (key === 'dateRefresh') {
                    // Trigger date filtering by updating the dateFilterTrigger
                    setDateFilterTrigger(prev => prev + 1);
                    setCurrentPage(1);
                  } else {
                    setHeaderFilters(prev => ({ ...prev, [key]: value }));
                    setCurrentPage(1);
                  }
                }}
                onViewOrder={(order) => {
                  logger.log('View order:', order);
                  setSelectedOrder(order);
                  setIsOrderModalOpen(true);
                }}
                onEditOrder={(order) => {
                  logger.log('Edit order:', order);
                  // Just set the basic order info - comprehensive editor will fetch full data
                  setSelectedOrder(order);
                  setIsEditingOrder(true);
                }}
                onApproveOrder={(order) => {
                  logger.log('Approve order:', order);
                  setSelectedOrder(order);
                  setIsApprovalModalOpen(true);
                }}
                onDeleteOrder={(order) => logger.log('Delete order:', order)}
                seatSizes={seatSizes}
                statuses={statuses}
                fitters={[]}
                dateFrom={date.from}
                setDateFrom={from => setDate(d => ({ ...d, from }))}
                dateTo={date.to}
                setDateTo={to => setDate(d => ({ ...d, to }))}
                pagination={{
                  currentPage: currentPage,
                  totalPages: totalPages,
                  onPageChange: (page: number) => {
                    logger.log('Dashboard: Changing to page:', page);
                    setCurrentPage(page);
                  },
                  totalItems: totalItems,
                  itemsPerPage: itemsPerPage,
                }}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <Reports />
        </TabsContent>
      </Tabs>
      
      {/* Order Detail Modal */}
      <Dialog open={isOrderModalOpen} onOpenChange={(open) => {
        setIsOrderModalOpen(open);
        if (!open) setSelectedOrder(null);
      }}>
        {selectedOrder && (
          <OrderDetails
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            order={selectedOrder as any}
            onClose={() => {
              setIsOrderModalOpen(false);
              setSelectedOrder(null);
            }}
            onOrderChanged={() => {
              setIsOrderModalOpen(false);
              setSelectedOrder(null);
              setDateFilterTrigger(t => t + 1);
            }}
          />
        )}
      </Dialog>
      
      {/* Order Edit Modal */}
      <OrderEditModal
        order={selectedOrder}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedOrder(null);
        }}
        onSave={handleSaveOrder}
      />
      
      {/* Order Approval Modal */}
      <OrderApprovalModal
        order={selectedOrder}
        isOpen={isApprovalModalOpen}
        onClose={() => {
          setIsApprovalModalOpen(false);
          setSelectedOrder(null);
        }}
        onApprove={handleApproveOrder}
      />
    </div>
  );
}

// extractSeatSizes function moved to shared utilities