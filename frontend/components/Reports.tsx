"use client";

import React, { useState, useEffect } from 'react';
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
import { CalendarIcon } from 'lucide-react';
// Simple date formatting function
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};
import { Dialog } from '@/components/ui/dialog';
import { OrderDetails } from './OrderDetails';
import { ComprehensiveEditOrder } from './ComprehensiveEditOrder';
import { getFitterName, getCustomerName, getSupplierName, getStatus, getUrgent, getDate } from '../utils/orderHydration';
import { getOrderTableColumns } from '../utils/orderTableColumns';
import { seatSizes, statuses, orderStatuses } from '../utils/orderConstants';
import { logger } from '@/utils/logger';
import { getEnrichedOrders } from '../services/enrichedOrders';
import { extractDynamicFactories, extractDynamicSeatSizes, extractSeatSizes, normalizeSeatSize } from '../utils/orderProcessing';
import { exportToXlsx } from '../utils/exportXlsx';

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
  
  // Extract unique factory names from orders for filter dropdown
  const suppliers = React.useMemo(() => {
    return extractDynamicFactories(orders);
  }, [orders]);
  
  // Extract unique fitter names from orders for filter dropdown
  const fittersList = React.useMemo(() => {
    const fitters = new Set<string>();
    orders.forEach(order => {
      const name = order.fitter_name || order.fitterName || getFitterName(order);
      if (name && typeof name === 'string' && name.trim() && !name.startsWith('Unknown')) {
        fitters.add(name.trim());
      }
    });
    return Array.from(fitters).sort().map(name => ({ label: name, value: name }));
  }, [orders]);
  
  // Extract unique saddle names (brand + model) from orders
  const modelsList = React.useMemo(() => {
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
  }, [orders]);

  // Extract unique customer countries from orders
  const dynamicCountries = React.useMemo(() => {
    const countriesSet = new Set<string>();
    orders.forEach(order => {
      const country = order.customer_country || order.customerCountry;
      if (country && typeof country === 'string' && country.trim()) {
        countriesSet.add(country.trim());
      }
    });
    return Array.from(countriesSet).sort();
  }, [orders]);

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
          filters.reference = headerFilters[key];
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
        } else if (key === 'saddle') {
          filters.saddleName = headerFilters[key];
        }
      }
    });

    getEnrichedOrders({ 
      page, 
      partial: true,
      filters
    })
      .then(data => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let memberArr: any[] = [];
        if (data['hydra:member']) {
          memberArr = data['hydra:member'];
        } else if (Array.isArray(data)) {
          memberArr = data;
        }
        setOrders(memberArr);
        setTotalPages(data['hydra:view']?.['hydra:last'] ? parseInt(new URL(data['hydra:view']['hydra:last'], 'http://dummy').searchParams.get('page') || '1') : 1);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load orders from API');
        setLoading(false);
      });
  }, [page, headerFilters]);

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
  const [selectedFitter, setSelectedFitter] = useState('all-fitters');
  const [selectedStatus, setSelectedStatus] = useState('all-statuses');
  const [selectedSaleType, setSelectedSaleType] = useState('all-types');
  const [selectedCustomer, setSelectedCustomer] = useState('all-customers');
  const [selectedFactory, setSelectedFactory] = useState('all-factories');
  const [selectedSaddle, setSelectedSaddle] = useState('all-saddles');
  const [selectedCustomerCountry, setSelectedCustomerCountry] = useState('all-customer-countries');
  const [selectedFitterCountry, setSelectedFitterCountry] = useState('all-fitter-countries');
  const [selectedSeatSize, setSelectedSeatSize] = useState('all-sizes');
  const [selectedUrgent, setSelectedUrgent] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [date, setDate] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [orderedDate, setOrderedDate] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [paymentDate, setPaymentDate] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });

  // Extract unique seat sizes from orders (handles both snake_case and camelCase)
  const dynamicSeatSizes = React.useMemo(() => {
    return extractDynamicSeatSizes(orders);
  }, [orders]);

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

  // Filteren op genormaliseerde data
  const filteredOrders = processedOrders.filter(order => {
    const matchesOrderId = !headerFilters.orderId || (order.orderId || '').toLowerCase().includes(headerFilters.orderId.toLowerCase());
    const matchesReference = !headerFilters.reference || (order.reference || '').toLowerCase().includes(headerFilters.reference.toLowerCase());
    const matchesSeatSize = !headerFilters.seatSize || (() => {
      const sizes = order.seat_sizes || order.seatSizes || [];
      if (Array.isArray(sizes) && sizes.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return sizes.some((s: any) => normalizeSeatSize(String(s)) === headerFilters.seatSize);
      }
      return order.seatSize === headerFilters.seatSize;
    })();
    const matchesOrderStatus = !headerFilters.orderStatus || getStatus(order) === headerFilters.orderStatus;
    const matchesFitter = !headerFilters.fitter || getFitterName(order).toLowerCase().includes(headerFilters.fitter.toLowerCase());
    const matchesUrgent = !headerFilters.urgent || ((orderUrgent => {
      const val = getUrgent(orderUrgent);
      const strVal = String(val);
      if (val === null || val === undefined || val === '') return 'false';
      if (strVal === 'true' || strVal === 'Yes' || strVal === '1') return 'true';
      if (strVal === 'false' || strVal === 'No' || strVal === '0') return 'false';
      return strVal;
    })(order) === headerFilters.urgent);
    const matchesCustomer = !headerFilters.customer || getCustomerName(order).toLowerCase().includes(headerFilters.customer.toLowerCase());
    const matchesSupplier = !headerFilters.supplier || (order.supplier || '').toLowerCase().includes(headerFilters.supplier.toLowerCase());
    const matchesSaddle = !headerFilters.saddle || (() => {
      const brand = order.brand_name || order.brandName || '';
      const model = order.model_name || order.modelName || '';
      const saddleName = [brand, model].filter(Boolean).join(' - ');
      return saddleName.toLowerCase().includes(headerFilters.saddle.toLowerCase());
    })();
    const matchesCustomerCountry = !headerFilters.customerCountry || (order.customerCountry || order.customer_country || order.customer?.country || '').toLowerCase().includes(headerFilters.customerCountry.toLowerCase());

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

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Order Reports</h2>

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

            <div className="flex items-center gap-2">
              <label className="w-32">Fitters</label>
              <Select value={selectedFitter} onValueChange={(value) => {
                setSelectedFitter(value);
                setHeaderFilters(prev => ({
                  ...prev,
                  fitter: value === 'all-fitters' ? '' : value
                }));
                setPage(1);
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-fitters">All Fitters</SelectItem>
                  {fittersList.map(fitter => (
                    <SelectItem key={fitter.value} value={fitter.label}>{fitter.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32">Order statuses</label>
              <Select value={selectedStatus} onValueChange={(value) => {
                setSelectedStatus(value);
                setHeaderFilters(prev => ({
                  ...prev,
                  status: value === 'all-statuses' ? '' : value
                }));
                setPage(1);
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-statuses">All Statuses</SelectItem>
                  {orderStatuses.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32">Saletypes</label>
              <Select value={selectedSaleType} onValueChange={setSelectedSaleType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-types">All Types</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32">Customers</label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-customers">All Customers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="w-32">Factories</label>
              <Select value={selectedFactory} onValueChange={(value) => {
                setSelectedFactory(value);
                setHeaderFilters(prev => ({
                  ...prev,
                  supplier: value === 'all-factories' ? '' : value
                }));
                setPage(1);
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-factories">All Factories</SelectItem>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.value} value={supplier.label}>{supplier.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32">Saddles</label>
              <Select value={selectedSaddle} onValueChange={(value) => {
                setSelectedSaddle(value);
                setHeaderFilters(prev => ({
                  ...prev,
                  saddle: value === 'all-saddles' ? '' : value
                }));
                setPage(1);
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-saddles">All Saddles</SelectItem>
                  {modelsList.map(model => (
                    <SelectItem key={model.value} value={model.label}>{model.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32">Customer Countries</label>
              <Select value={selectedCustomerCountry} onValueChange={(value) => {
                setSelectedCustomerCountry(value);
                setHeaderFilters(prev => ({
                  ...prev,
                  customerCountry: value === 'all-customer-countries' ? '' : value
                }));
                setPage(1);
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-customer-countries">All Countries</SelectItem>
                  {dynamicCountries.map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32">Fitter Countries</label>
              <Select value={selectedFitterCountry} onValueChange={setSelectedFitterCountry}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-fitter-countries">All Countries</SelectItem>
                  {dynamicCountries.map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32">Seatsizes</label>
              <Select value={selectedSeatSize} onValueChange={(value) => {
                setSelectedSeatSize(value);
                setHeaderFilters(prev => ({
                  ...prev,
                  seatSize: value === 'all-sizes' ? '' : value
                }));
                setPage(1);
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-sizes">All Sizes</SelectItem>
                  {dynamicSeatSizes.map(size => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <Button variant="destructive" className="bg-[#8B0000]" onClick={() => exportToXlsx(filteredOrders)}>
                Export report
              </Button>
              
              {/* Reset All Filters Button */}
              {(Object.keys(headerFilters).some(key => headerFilters[key]) || 
                selectedFitter !== 'all-fitters' || 
                selectedStatus !== 'all-statuses' || 
                selectedFactory !== 'all-factories' || 
                selectedSeatSize !== 'all-sizes' || 
                selectedUrgent !== 'all' ||
                date.from || date.to) && (
                <Button 
                  variant="outline" 
                  className="border-red-600 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    logger.log('Resetting all Reports filters');
                    // Reset header filters
                    setHeaderFilters({});
                    // Reset dropdown states
                    setSelectedFitter('all-fitters');
                    setSelectedStatus('all-statuses');
                    setSelectedSaleType('all-types');
                    setSelectedCustomer('all-customers');
                    setSelectedFactory('all-factories');
                    setSelectedSaddle('all-saddles');
                    setSelectedCustomerCountry('all-customer-countries');
                    setSelectedFitterCountry('all-fitter-countries');
                    setSelectedSeatSize('all-sizes');
                    setSelectedUrgent('all');
                    // Reset dates
                    setDate({ from: undefined, to: undefined });
                    // Reset pagination
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

      {error ? (
        <div>Error: {error}</div>
      ) : (
        <div className="border rounded-lg">
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
                totalItems: filteredOrders.length,
                itemsPerPage: 10,
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
    </div>
  );
}