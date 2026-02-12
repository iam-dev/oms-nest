"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { BulkOrderSearch } from './BulkOrderSearch';
import { BulkActionsToolbar } from './BulkActionsToolbar';
import { Dialog } from '@/components/ui/dialog';
import { OrderDetails } from './OrderDetails';
import { EditOrder } from './EditOrder';
import { ComprehensiveEditOrder } from './ComprehensiveEditOrder';
import { EntityTable } from '@/components/shared/EntityTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { OrderSearchMessage } from './OrderSearchMessage';
import { getOrderTableColumns } from '../utils/orderTableColumns';
import { fetchCompleteOrderData } from '../utils/orderProcessing';
import { useOrderFilters } from '@/hooks/useOrderFilters';
import { logger } from '@/utils/logger';
import type { Column } from '@/components/shared/DataTable';

// Enriched order customer/fitter/supplier can be a string name or an object with id+name
interface OrderRelatedEntity {
  id?: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  '@id'?: string;
}

// Base order interface that matches the API response
export interface Order {
  id: number;
  orderId: number;
  reference: string;
  seatSize: string;
  customer: string | OrderRelatedEntity;
  customerName?: string;
  orderStatus: string;
  status?: string;
  urgent: boolean;
  fitter: string | OrderRelatedEntity;
  fitterName?: string;
  supplier: string | OrderRelatedEntity;
  supplierName?: string;
  factoryName?: string;
  orderTime: string;
  createdAt: string;
  seatSizes?: string[];
  name?: string;
  isUrgent?: boolean;
  brandName?: string;
  modelName?: string;
  [key: string]: unknown;
}

export default function Orders() {
  // Dialog state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoadingOrderData, setIsLoadingOrderData] = useState(false);
  const [orderDataError, setOrderDataError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [useComprehensiveEdit, setUseComprehensiveEdit] = useState(true);

  // All filter, search, pagination, and data fetching logic
  const {
    searchTerm,
    searchMessage,
    isSearching,
    handleSearch,
    handleBulkSearch,
    processedOrders,
    loading,
    error,
    headerFilters,
    handleFilterChange,
    resetFilters,
    hasActiveFilters,
    dynamicSeatSizes,
    dynamicFactories,
    page,
    setPage,
    pagination,
    fetchAndSetOrders,
  } = useOrderFilters();

  // --- Checkbox selection state ---
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());

  // Clear selection when page or filters change
  useEffect(() => {
    setSelectedOrderIds(new Set());
  }, [page, headerFilters]);

  const handleToggleSelect = useCallback((orderId: number) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    const visibleIds = processedOrders.map((o: Record<string, unknown>) => Number(o.id)).filter((id: number) => !isNaN(id));
    setSelectedOrderIds(prev => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id: number) => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(visibleIds);
    });
  }, [processedOrders]);

  const handleClearSelection = useCallback(() => {
    setSelectedOrderIds(new Set());
  }, []);

  // Build checkbox column
  const visibleIds = useMemo(
    () => processedOrders.map((o: Record<string, unknown>) => Number(o.id)).filter((id: number) => !isNaN(id)),
    [processedOrders],
  );
  const allSelected = visibleIds.length > 0 && visibleIds.every((id: number) => selectedOrderIds.has(id));

  const checkboxColumn: Column<Record<string, unknown>> = useMemo(() => ({
    key: '_select' as string,
    title: (
      <input
        type="checkbox"
        checked={allSelected}
        onChange={handleToggleSelectAll}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
      />
    ),
    render: (_: unknown, row?: Record<string, unknown>) => {
      const orderId = Number(row?.id);
      if (isNaN(orderId)) return null;
      return (
        <input
          type="checkbox"
          checked={selectedOrderIds.has(orderId)}
          onChange={() => handleToggleSelect(orderId)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
      );
    },
  }), [allSelected, selectedOrderIds, handleToggleSelectAll, handleToggleSelect]);

  // Use shared fetchCompleteOrderData utility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchCompleteOrderDataWrapper = async (order: Order): Promise<Order> => {
    return fetchCompleteOrderData(order, setIsLoadingOrderData, setOrderDataError);
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const handleEditOrder = (order: Order) => {
    logger.log('Edit order:', order);
    setSelectedOrder(order);
    setIsEditOpen(true);
  };

  const handleApproveOrder = (order: Order) => {
    logger.log('Approve order', order);
  };

  const handleDeleteOrder = (order: Order) => {
    logger.log('Delete order', order);
  };

  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setOrderDataError(null);
    fetchAndSetOrders();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Manage and track all orders"
        actions={[
          ...(hasActiveFilters ? [
            <button
              key="reset-filters"
              onClick={resetFilters}
              className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Reset Filters
            </button>
          ] : []),
          <BulkOrderSearch key="bulk-search" onSearch={handleBulkSearch} />,
          <button
            key="create-order"
            onClick={() => {
              setSelectedOrder(null);
              setIsEditOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" /> Create Order
          </button>,
        ]}
      />

      <OrderSearchMessage searchMessage={searchMessage} isSearching={isSearching} />

      <BulkActionsToolbar
        selectedOrderIds={selectedOrderIds}
        onClearSelection={handleClearSelection}
        onStatusUpdated={fetchAndSetOrders}
      />

      <div className="space-y-4">
        <EntityTable
          entities={processedOrders}
          columns={[checkboxColumn, ...getOrderTableColumns(headerFilters, handleFilterChange, dynamicFactories, dynamicSeatSizes)]}
          onView={(order) => handleViewDetails(order as unknown as Order)}
          onEdit={(order) => handleEditOrder(order as unknown as Order)}
          onDelete={(order) => handleDeleteOrder(order as unknown as Order)}
          onApprove={(order) => handleApproveOrder(order as unknown as Order)}
          entityType="order"
          searchTerm={searchTerm}
          onSearch={handleSearch}
          pagination={{
            currentPage: page,
            totalPages: pagination.totalPages,
            onPageChange: setPage,
            totalItems: pagination.totalItems,
            itemsPerPage: pagination.itemsPerPage,
          }}
          loading={loading || isSearching}
          error={error}
          actionButtons={{
            view: true,
            edit: true,
            delete: true,
            approve: true
          }}
        />
      </div>

      {/* Order details dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        {selectedOrder && (
          <OrderDetails
            order={selectedOrder}
            onClose={() => setIsDetailsOpen(false)}
          />
        )}
      </Dialog>

      {/* Edit order dialog */}
      <Dialog open={isEditOpen} onOpenChange={() => {
        setIsEditOpen(false);
        setOrderDataError(null);
      }}>
        {selectedOrder ? (
          useComprehensiveEdit ? (
            <ComprehensiveEditOrder
              order={{
                id: String(selectedOrder.id),
                orderId: Number(selectedOrder.orderId || selectedOrder.id)
              }}
              onClose={handleCloseEdit}
            />
          ) : (
            <EditOrder
              order={{
                id: String(selectedOrder.id),
                orderId: Number(selectedOrder.orderId || selectedOrder.id)
              }}
              isLoading={isLoadingOrderData}
              error={orderDataError}
              onClose={handleCloseEdit}
            />
          )
        ) : (
          <EditOrder
            order={undefined}
            isLoading={false}
            error={null}
            onClose={handleCloseEdit}
          />
        )}
      </Dialog>
    </div>
  );
}
