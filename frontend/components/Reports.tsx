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
import { MultiSelectFilter } from '@/components/shared/MultiSelectFilter';

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

  // Extract unique customer names from orders for filter dropdown
  const customersList = React.useMemo(() => {
    const customers = new Set<string>();
    orders.forEach(order => {
      const name = getCustomerName(order);
      if (name && typeof name === 'string' && name.trim() && !name.startsWith('Unknown')) {
        customers.add(name.trim());
      }
    });
    return Array.from(customers).sort().map(name => ({ label: name, value: name }));
  }, [orders]);

  // Extract unique customer countries from orders
  const dynamicCustomerCountries = React.useMemo(() => {
    const countriesSet = new Set<string>();
    orders.forEach(order => {
      const country = order.customer_country || order.customerCountry;
      if (country && typeof country === 'string' && country.trim()) {
        countriesSet.add(country.trim());
      }
    });
    return Array.from(countriesSet).sort();
  }, [orders]);

  // Extract unique fitter countries from orders
  const dynamicFitterCountries = React.useMemo(() => {
    const countriesSet = new Set<string>();
    orders.forEach(order => {
      const country = order.fitter_country || order.fitterCountry;
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
        } else if (key === 'fitterCountry') {
          filters.fitterCountry = headerFilters[key];
        } else if (key === 'saddle') {
          filters.saddleName = headerFilters[key];
        } else if (key === 'kneeRoll') {
          filters.kneeRoll = headerFilters[key];
        } else if (key === 'saleType') {
          filters.saleType = headerFilters[key];
        }
      }
    });

    getEnrichedOrders({
      page,
      partial: true,
      filters,
      bustCache: refreshKey > 0,
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

  // Extract unique knee roll values from orders
  const kneeRollOptions = React.useMemo(() => {
    const values = new Set<string>();
    orders.forEach(order => {
      const kr = order.knee_roll || order.kneeRoll;
      if (kr && typeof kr === 'string' && kr.trim()) {
        values.add(kr.trim());
      }
    });
    return Array.from(values).sort();
  }, [orders]);

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
    const matchesReference = !headerFilters.reference || (order.reference || '').toLowerCase().includes(headerFilters.reference.toLowerCase());

    const matchesSeatSize = !headerFilters.seatSize || (() => {
      const filterValues = headerFilters.seatSize.split(',').map(v => v.trim()).filter(Boolean);
      if (filterValues.length === 0) return true;
      const sizes = order.seat_sizes || order.seatSizes || [];
      if (Array.isArray(sizes) && sizes.length > 0) {
        return filterValues.some(fv => sizes.some((s: string | number) => normalizeSeatSize(String(s)) === fv));
      }
      return filterValues.some(fv => order.seatSize === fv);
    })();

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

    const matchesCustomerCountry = !headerFilters.customerCountry || (() => {
      const filterValues = headerFilters.customerCountry.split(',').map(v => v.trim()).filter(Boolean);
      if (filterValues.length === 0) return true;
      const country = (order.customerCountry || order.customer_country || order.customer?.country || '').toLowerCase();
      return filterValues.some(fv => country.includes(fv.toLowerCase()));
    })();

    const matchesFitterCountry = !headerFilters.fitterCountry || (() => {
      const filterValues = headerFilters.fitterCountry.split(',').map(v => v.trim()).filter(Boolean);
      if (filterValues.length === 0) return true;
      const country = (order.fitter_country || order.fitterCountry || '').toLowerCase();
      return filterValues.some(fv => country.includes(fv.toLowerCase()));
    })();

    const matchesKneeRoll = !headerFilters.kneeRoll || (() => {
      const filterValues = headerFilters.kneeRoll.split(',').map(v => v.trim()).filter(Boolean);
      if (filterValues.length === 0) return true;
      const kr = (order.knee_roll || order.kneeRoll || '').toLowerCase();
      return filterValues.some(fv => kr.includes(fv.toLowerCase()));
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
    </div>
  );
}