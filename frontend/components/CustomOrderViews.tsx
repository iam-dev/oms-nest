'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Settings2, X } from 'lucide-react';
import { ViewSelector } from './custom-views/ViewSelector';
import { ColumnManager } from './custom-views/ColumnManager';
import { CustomViewsTable } from './custom-views/CustomViewsTable';
import { ExportButton } from './custom-views/ExportButton';
import { ViewGroupManager } from './custom-views/ViewGroupManager';
import { GroupTabBar } from './custom-views/GroupTabBar';
import { TableHeaderFilter } from './shared/TableHeaderFilter';
import { useCustomOrderViews } from '@/hooks/useCustomOrderViews';
import { getEnrichedOrders, getFilterOptions, FilterOptions } from '@/services/enrichedOrders';
import { buildOrderFilters, HeaderFilters } from '@/utils/orderProcessing';

export default function CustomOrderViews() {
  const {
    views,
    activeView,
    setActiveView,
    visibleColumns,
    overrides,
    loading: viewsLoading,
    loadOverrides,
    handleCreateView,
    handleUpdateColumns,
    handleRenameView,
    handleDeleteView,
    handleSetOverride,
    handleRemoveOverride,
    getOverrideValue,
    // Groups & Tabs
    groups,
    activeGroup,
    setActiveGroup,
    activeTab,
    setActiveTab,
    handleCreateGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleCreateTab,
    handleDeleteTab,
    // Saddle specs
    loadSaddleSpecs,
    mergeSpecsIntoOrders,
  } = useCustomOrderViews();

  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);

  // Filter state
  const [headerFilters, setHeaderFilters] = useState<HeaderFilters>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  // Load filter options on mount
  useEffect(() => {
    getFilterOptions().then(setFilterOptions).catch(() => {/* silent */});
  }, []);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setHeaderFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setHeaderFilters({});
    setPage(1);
  }, []);

  const hasActiveFilters = Object.keys(headerFilters).length > 0;

  // Fetch orders with filters
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const filters = buildOrderFilters(headerFilters);
      const data = await getEnrichedOrders({
        page,
        partial: true,
        orderBy: 'orderId',
        order: 'desc',
        filters,
      });

      let memberArr: Record<string, unknown>[] = [];
      if (data['hydra:member']) {
        memberArr = data['hydra:member'] as Record<string, unknown>[];
      } else if (Array.isArray((data as Record<string, unknown>).data)) {
        memberArr = (data as Record<string, unknown>).data as Record<string, unknown>[];
      } else if (Array.isArray(data)) {
        memberArr = data as Record<string, unknown>[];
      }
      setOrders(memberArr);
      const serverTotal = (data as Record<string, unknown>).total || data['hydra:totalItems'] || memberArr.length;
      setTotalItems(Number(serverTotal));
      setTotalPages(Number((data as Record<string, unknown>).pages) || Math.ceil(Number(serverTotal) / 50) || 1);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [page, headerFilters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Load overrides and saddle specs when orders change
  useEffect(() => {
    if (orders.length > 0) {
      const ids = orders.map((o) => Number(o.id || o.orderId)).filter(Boolean);
      loadOverrides(ids);
      loadSaddleSpecs(ids);
    }
  }, [orders, loadOverrides, loadSaddleSpecs]);

  // Merge saddle specs into orders for display
  const enrichedOrders = mergeSpecsIntoOrders(orders);

  // Selection handlers
  const toggleSelect = (orderId: number) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = enrichedOrders.map((o) => Number(o.id || o.orderId));
    const allSelected = allIds.every((id) => selectedOrderIds.has(id));
    if (allSelected) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(allIds));
    }
  };

  // Handle group selection — set active tab to first tab
  const handleSelectGroup = useCallback((group: typeof activeGroup) => {
    setActiveGroup(group);
    if (group && group.views.length > 0) {
      const sorted = [...group.views].sort((a, b) => (a.tabOrder ?? 0) - (b.tabOrder ?? 0));
      setActiveTab(sorted[0]);
    } else {
      setActiveTab(null);
      if (!group) setActiveView(null);
    }
  }, [setActiveGroup, setActiveTab, setActiveView]);

  // Determine which views to show in the standalone selector (non-grouped views)
  const standaloneViews = views.filter((v) => !v.groupId);

  if (viewsLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[200px]">
          <p>Loading views...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Views</h1>
      </div>

      {/* Top Toolbar — Group selector + View selector + Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <ViewGroupManager
          groups={groups}
          activeGroup={activeGroup}
          onSelectGroup={handleSelectGroup}
          onCreateGroup={handleCreateGroup}
          onRenameGroup={handleRenameGroup}
          onDeleteGroup={handleDeleteGroup}
        />

        {/* Show standalone view selector when no group is active */}
        {!activeGroup && (
          <ViewSelector
            views={standaloneViews}
            activeView={activeView}
            onSelect={setActiveView}
            onCreate={(name) => handleCreateView(name)}
            onRename={handleRenameView}
            onDelete={handleDeleteView}
          />
        )}

        {activeView && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsColumnManagerOpen(true)}
            >
              <Settings2 className="h-4 w-4 mr-1" />
              Columns ({visibleColumns.length})
            </Button>

            <ExportButton
              columns={activeView.columns}
              orders={enrichedOrders}
              selectedOrderIds={selectedOrderIds}
              overrides={overrides}
              viewName={activeView.name}
            />
          </>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <TableHeaderFilter
          title="Status"
          type="enum"
          value={headerFilters.status || ''}
          onFilter={(val) => handleFilterChange('status', val)}
          data={['New', 'In Production', 'Shipped', 'Delivered', 'Cancelled', 'On Hold', 'Waiting']}
        />
        <TableHeaderFilter
          title="Fitter"
          type="enum"
          value={headerFilters.fitter || ''}
          onFilter={(val) => handleFilterChange('fitter', val)}
          data={filterOptions?.fitters || []}
        />
        <TableHeaderFilter
          title="Customer"
          type="text"
          value={headerFilters.customer || ''}
          onFilter={(val) => handleFilterChange('customer', val)}
        />
        <TableHeaderFilter
          title="Seat Size"
          type="text"
          value={headerFilters.seatSize || ''}
          onFilter={(val) => handleFilterChange('seatSize', val)}
        />
        <TableHeaderFilter
          title="Factory"
          type="enum"
          value={headerFilters.factory || ''}
          onFilter={(val) => handleFilterChange('factory', val)}
          data={filterOptions?.factories || []}
        />
        <TableHeaderFilter
          title="Urgent"
          type="urgent"
          value={headerFilters.urgent || ''}
          onFilter={(val) => handleFilterChange('urgent', val)}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Reset Filters
          </Button>
        )}
      </div>

      {/* Tab Bar (when a group is active) */}
      {activeGroup && (
        <GroupTabBar
          views={activeGroup.views}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onCreateTab={(name) => handleCreateTab(activeGroup.id, name)}
          onDeleteTab={handleDeleteTab}
        />
      )}

      {/* Empty state */}
      {!activeView && groups.length === 0 && standaloneViews.length === 0 && (
        <div className="border rounded-md p-12 text-center text-gray-500">
          <p className="text-lg mb-2">No views yet</p>
          <p className="text-sm mb-4">
            Create a group with tabs or a standalone view to manage order data for Excel exports.
          </p>
          <Button onClick={() => handleCreateView('My First View')}>
            Create First View
          </Button>
        </div>
      )}

      {/* Table */}
      {activeView && (
        <CustomViewsTable
          columns={activeView.columns}
          orders={enrichedOrders}
          selectedOrderIds={selectedOrderIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          getOverrideValue={getOverrideValue}
          onSetOverride={handleSetOverride}
          onRemoveOverride={handleRemoveOverride}
          loading={ordersLoading}
        />
      )}

      {/* Pagination */}
      {activeView && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {totalItems} total orders - Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Column Manager Dialog */}
      {activeView && (
        <ColumnManager
          open={isColumnManagerOpen}
          onOpenChange={setIsColumnManagerOpen}
          columns={activeView.columns}
          onSave={handleUpdateColumns}
        />
      )}
    </div>
  );
}
