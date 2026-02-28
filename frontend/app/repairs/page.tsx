"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BulkOrderSearch } from '@/components/BulkOrderSearch';
import { BulkActionsToolbar } from '@/components/BulkActionsToolbar';
import { Dialog } from '@/components/ui/dialog';
import { OrderDetails } from '@/components/OrderDetails';
import { ComprehensiveEditOrder } from '@/components/ComprehensiveEditOrder';
import { CreateRepairDialog } from '@/components/CreateRepairDialog';
import { EntityTable } from '@/components/shared/EntityTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { OrderSearchMessage } from '@/components/OrderSearchMessage';
import { getOrderTableColumns } from '@/utils/orderTableColumns';
import { useOrderFilters } from '@/hooks/useOrderFilters';
import { logger } from '@/utils/logger';
import type { Order } from '@/components/Orders';
import type { Column } from '@/components/shared/DataTable';

export default function RepairsPage() {
  // Dialog state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateRepairOpen, setIsCreateRepairOpen] = useState(false);

  // Reuse the same hook as Orders, but with repair=true base filter
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
  } = useOrderFilters({ baseFilters: { repair: 'true' } });

  // --- Checkbox selection state ---
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());

  // Clear selection when page or filters change
  useEffect(() => {
    setSelectedOrderIds(new Set());
  }, [page, headerFilters]);

  const handleViewDetails = useCallback((order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  }, []);

  const handleEditOrder = useCallback((order: Order) => {
    logger.log('Edit repair order:', order);
    setSelectedOrder(order);
    setIsEditOpen(true);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setIsEditOpen(false);
    fetchAndSetOrders(true);
  }, [fetchAndSetOrders]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repairs"
        description="Manage saddle repairs and maintenance requests"
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
            key="new-repair"
            onClick={() => setIsCreateRepairOpen(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#8B0000] hover:bg-[#6B0000] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8B0000]"
          >
            + New Repair
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
            delete: false,
            approve: false,
          }}
        />
      </div>

      {/* Order details dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        {selectedOrder && (
          <OrderDetails
            order={selectedOrder}
            onClose={() => setIsDetailsOpen(false)}
            onOrderChanged={() => {
              setIsDetailsOpen(false);
              fetchAndSetOrders(true);
            }}
          />
        )}
      </Dialog>

      {/* Edit order dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        {selectedOrder && (
          <ComprehensiveEditOrder
            order={{
              id: String(selectedOrder.id),
              orderId: Number(selectedOrder.orderId || selectedOrder.id)
            }}
            onClose={handleCloseEdit}
          />
        )}
      </Dialog>

      {/* Create repair dialog */}
      <Dialog open={isCreateRepairOpen} onOpenChange={setIsCreateRepairOpen}>
        <CreateRepairDialog
          onClose={() => {
            setIsCreateRepairOpen(false);
            fetchAndSetOrders(true);
          }}
        />
      </Dialog>
    </div>
  );
}
