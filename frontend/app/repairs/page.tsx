"use client";

import React, { useState, useCallback } from 'react';
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repairs"
        description="Manage saddle repairs and maintenance requests"
        actions={[
          <button
            key="new-repair"
            onClick={() => setIsCreateRepairOpen(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#8B0000] hover:bg-[#6B0000] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8B0000]"
          >
            + New Repair
          </button>,
          ...(hasActiveFilters ? [
            <button
              key="reset-filters"
              onClick={resetFilters}
              className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Reset Filters
            </button>
          ] : []),
        ]}
      />

      <OrderSearchMessage searchMessage={searchMessage} isSearching={isSearching} />

      <div className="space-y-4">
        <EntityTable
          entities={processedOrders}
          columns={getOrderTableColumns(headerFilters, handleFilterChange, dynamicFactories, dynamicSeatSizes)}
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
