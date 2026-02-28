"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { EntityTable } from '@/components/shared/EntityTable';
import { useTableFilters, usePagination, useEntityData } from '@/hooks';
import { getSupplierTableColumns } from '@/utils/supplierTableColumns';
import { PageHeader } from '@/components/shared/PageHeader';
import { createSupplier, updateSupplier, deleteSupplier, blockFactory, type Supplier } from '@/services/suppliers';
import { SupplierDetailModal } from '@/components/shared/SupplierDetailModal';
import { SupplierEditModal } from '@/components/shared/SupplierEditModal';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

export default function Factories() {
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Use our hooks for filters and pagination
  const { filters, updateFilter } = useTableFilters<Record<string, string>>({});
  const { pagination, setTotalItems } = usePagination(10, 1);

  // Use our data fetching hook with optimistic updates
  const {
    data: allSuppliers = [],
    loading,
    error,
    refetch,
    updateEntityOptimistically,
    removeEntityOptimistically
  } = useEntityData<Supplier>({
    entity: 'factories',
    page: pagination.currentPage,
    filters: filters, // Add filters to data fetching
    orderBy: 'company_name',
    autoFetch: true
  });

  // Filter suppliers based on search term and header filters (client-side filtering)
  const suppliers = React.useMemo(() => {
    let filteredSuppliers = [...allSuppliers];

    // Apply search term filter
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filteredSuppliers = filteredSuppliers.filter(supplier =>
        supplier.name?.toLowerCase().includes(searchLower) ||
        supplier.username?.toLowerCase().includes(searchLower) ||
        supplier.city?.toLowerCase().includes(searchLower) ||
        supplier.country?.toLowerCase().includes(searchLower)
      );
    }

    // Apply header filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim()) {
        const filterValue = value.toLowerCase().trim();
        filteredSuppliers = filteredSuppliers.filter(supplier => {
          switch (key) {
            case 'name':
              return supplier.name?.toLowerCase().includes(filterValue);
            case 'username':
              return supplier.username?.toLowerCase().includes(filterValue);
            case 'city':
              return supplier.city?.toLowerCase().includes(filterValue);
            case 'country':
              return supplier.country?.toLowerCase().includes(filterValue);
            case 'status':
              const isActive = supplier.enabled === true;
              return value === 'ACTIVE' ? isActive : !isActive;
            default:
              return true;
          }
        });
      }
    });

    return filteredSuppliers;
  }, [allSuppliers, searchTerm, filters]);

  // Update total items when data changes
  useEffect(() => {
    if (suppliers) {
      setTotalItems(suppliers.length);
    }
  }, [suppliers, setTotalItems]);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    updateFilter(key, value);
  };

  // Handle view supplier details
  const handleViewSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowDetailModal(true);
  };

  // Handle edit supplier
  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowEditModal(true);
  };

  // Handle add new supplier
  const handleAddSupplier = () => {
    setSelectedSupplier(null);
    setShowCreateModal(true);
  };

  // Handle delete supplier
  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (window.confirm(`Are you sure you want to delete factory "${supplier.name}"?`)) {
      // Apply optimistic removal immediately
      removeEntityOptimistically(supplier.id);

      try {
        await deleteSupplier(supplier.id);

        // Show success toast
        toast.success(`Factory "${supplier.name}" deleted successfully`);

        // Force a fresh fetch to ensure data consistency
        setTimeout(() => {
          refetch(true);
        }, 100);

      } catch (error) {
        logger.error('Error deleting factory:', error);

        // Show error toast
        toast.error(`Failed to delete factory: ${error instanceof Error ? error.message : 'Unknown error'}`);

        // Revert optimistic update on error by refetching
        refetch(true);
      }
    }
  };

  // Handle save supplier (for edit modal)
  const handleSaveSupplier = async (updatedSupplier: Partial<Supplier>) => {
    if (!selectedSupplier) return;

    // Apply optimistic update immediately
    const optimisticData = {
      ...selectedSupplier,
      ...updatedSupplier,
      id: selectedSupplier.id
    };
    updateEntityOptimistically(optimisticData);

    try {
      const result = await updateSupplier(selectedSupplier.id, updatedSupplier);

      // Update with actual response data if available
      if (result && result.id) {
        updateEntityOptimistically(result);
      }

      // Close modal on success
      setShowEditModal(false);
      setSelectedSupplier(null);

      // Show success toast
      toast.success(`Factory "${updatedSupplier.name || selectedSupplier.name}" updated successfully`);

      // Force a fresh fetch to ensure data consistency
      // Use setTimeout to avoid race conditions with optimistic updates
      setTimeout(() => {
        refetch(true); // Force fresh data
      }, 100);

    } catch (error) {
      logger.error('Error updating factory:', error);

      // Show error toast
      toast.error(`Failed to update factory: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Revert optimistic update on error by refetching
      refetch(true);

      throw error; // Re-throw to show error in modal
    }
  };

  // Handle create supplier (for create modal)
  const handleCreateSupplier = async (newSupplier: Partial<Supplier>) => {
    try {
      await createSupplier(newSupplier);

      // Close modal on success
      setShowCreateModal(false);
      setSelectedSupplier(null);

      // Show success toast
      toast.success(`Factory "${newSupplier.name}" created successfully`);

      // Force a fresh fetch to ensure data consistency
      setTimeout(() => {
        refetch(true); // Force fresh data
      }, 100);

    } catch (error) {
      logger.error('Error creating factory:', error);

      // Show error toast
      toast.error(`Failed to create factory: ${error instanceof Error ? error.message : 'Unknown error'}`);

      throw error; // Re-throw to show error in modal
    }
  };

  // Handle block/unblock factory
  const handleBlockFactory = async (supplier: Supplier) => {
    const action = supplier.enabled ? 'block' : 'unblock';
    if (window.confirm(`Are you sure you want to ${action} factory "${supplier.name}"?`)) {
      try {
        const result = await blockFactory(supplier.id);
        toast.success(`Factory "${supplier.name}" ${result.enabled ? 'unblocked' : 'blocked'} successfully`);
        refetch(true);
      } catch (error) {
        logger.error('Error toggling factory block:', error);
        toast.error(`Failed to ${action} factory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Handle close modals
  const handleCloseModals = () => {
    setShowDetailModal(false);
    setShowEditModal(false);
    setShowCreateModal(false);
    setSelectedSupplier(null);
  };

  // Handle edit from detail modal
  const handleEditFromDetail = () => {
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Factories"
        description="Manage your factories"
        actions={
          <Button onClick={handleAddSupplier} className="bg-[#7b2326] hover:bg-[#8b2329] text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Factory
          </Button>
        }
      />

      <EntityTable
        entities={suppliers}
        columns={getSupplierTableColumns(filters, handleFilterChange)}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        headerFilters={filters}
        onFilterChange={handleFilterChange}
        pagination={pagination}
        loading={loading}
        error={error}
        entityType="factory"
        onView={handleViewSupplier}
        onEdit={handleEditSupplier}
        onDelete={handleDeleteSupplier}
        onBlock={handleBlockFactory}
        actionButtons={{ view: true, edit: true, delete: true, block: true }}
        searchPlaceholder="Search by name, username, city, or country..."
      />

      {/* Supplier Detail Modal */}
      <SupplierDetailModal
        supplier={selectedSupplier}
        isOpen={showDetailModal}
        onClose={handleCloseModals}
        onEdit={handleEditFromDetail}
      />

      {/* Supplier Edit Modal */}
      <SupplierEditModal
        supplier={selectedSupplier}
        isOpen={showEditModal}
        onClose={handleCloseModals}
        onSave={handleSaveSupplier}
      />

      {/* Supplier Create Modal */}
      <SupplierEditModal
        supplier={null}
        isOpen={showCreateModal}
        onClose={handleCloseModals}
        onSave={handleCreateSupplier}
      />
    </div>
  );
}