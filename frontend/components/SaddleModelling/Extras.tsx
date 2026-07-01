"use client";

import { useState, useEffect, useCallback } from 'react';
import { EntityTable } from '@/components/shared/EntityTable';
import { useTableFilters, usePagination } from '@/hooks';
import { getExtraTableColumns } from '@/utils/extraTableColumns';
import { PageHeader } from '@/components/shared/PageHeader';
import { fetchExtras, updateExtra, deleteExtra, createExtra, type Extra } from '@/services/extras';
import { ExtraDetailModal } from '@/components/shared/ExtraDetailModal';
import { ExtraEditModal } from '@/components/shared/ExtraEditModal';
import { ExtraAddModal } from '@/components/shared/ExtraAddModal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { logger } from '@/utils/logger';

export default function Extras() {
  const [searchTerm, setSearchTerm] = useState('');
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal states
  const [selectedExtra, setSelectedExtra] = useState<Extra | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Use our hooks for filters and pagination
  const { filters, updateFilter } = useTableFilters<Record<string, string>>({});
  const { pagination, setTotalItems, setPage } = usePagination(30, 1);
  
  // Fetch extras with filters
  const fetchExtrasData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      logger.log('Fetching extras with filters:', filters);
      const data = await fetchExtras({
        page: pagination.currentPage,
        searchTerm,
        filters,
        orderBy: 'name',
        order: 'asc'
      });
      
      setExtras(data['hydra:member'] || []);
      setTotalItems(data['hydra:totalItems'] || 0);
      
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Failed to fetch extras');
      setExtras([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, searchTerm, filters, setTotalItems]);

  // Fetch extras when dependencies change
  useEffect(() => {
    // TODO(react-hooks): fetchExtrasData is a useCallback that calls setState internally;
    // this is the standard async fetch-on-mount/dep-change pattern and is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExtrasData();
  }, [fetchExtrasData]);
  
  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    updateFilter(key, value);
    setPage(1); // Reset to page 1 when filters change
  };
  
  // Handle view extra details
  const handleViewExtra = (extra: Extra) => {
    setSelectedExtra(extra);
    setIsDetailModalOpen(true);
  };

  // Handle edit extra
  const handleEditExtra = (extra: Extra) => {
    setSelectedExtra(extra);
    setIsEditModalOpen(true);
  };

  // Handle edit from detail modal
  const handleEditFromDetail = () => {
    setIsDetailModalOpen(false);
    setIsEditModalOpen(true);
  };

  // Handle save extra
  const handleSaveExtra = async (updatedExtra: Partial<Extra>) => {
    if (!selectedExtra) return;

    try {
      await updateExtra(selectedExtra.id, updatedExtra);

      // Update local state
      setExtras(prev =>
        prev.map(item =>
          item.id === selectedExtra.id
            ? { ...item, ...updatedExtra }
            : item
        )
      );

      // Refresh data to ensure consistency
      await fetchExtrasData();
    } catch (error) {
      logger.error('Error updating extra:', error);
      throw error; // Re-throw to let modal handle the error display
    }
  };

  // Handle delete extra
  const handleDeleteExtra = async (extra: Extra) => {
    if (window.confirm(`Are you sure you want to delete the extra "${extra.name}"?`)) {
      try {
        await deleteExtra(extra.id);

        // Remove from local state
        setExtras(prev => prev.filter(item => item.id !== extra.id));

        // Refresh data to ensure consistency
        await fetchExtrasData();
      } catch (error) {
        logger.error('Error deleting extra:', error);
        setError('Failed to delete extra. Please try again.');
      }
    }
  };

  // Handle add extra
  const handleAddExtra = () => {
    setIsAddModalOpen(true);
  };

  // Handle save new extra (for add modal)
  const handleSaveNewExtra = async (newExtra: Partial<Extra>) => {
    try {
      await createExtra(newExtra);
      // Refresh the extra list
      fetchExtrasData();
      setIsAddModalOpen(false);
    } catch (error) {
      logger.error('Error creating extra:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setSelectedExtra(null);
    setIsDetailModalOpen(false);
    setIsEditModalOpen(false);
    setIsAddModalOpen(false);
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader 
        title="Extras" 
        description="Manage saddle extras and accessories" 
        actions={
          <Button onClick={handleAddExtra} className="bg-[#7b2326] hover:bg-[#8b2329] text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Extra
          </Button>
        } 
      />

      <EntityTable
        entities={extras}
        columns={getExtraTableColumns(filters, handleFilterChange)}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        headerFilters={filters}
        onFilterChange={handleFilterChange}
        pagination={{
          currentPage: pagination.currentPage,
          totalPages: pagination.totalPages,
          onPageChange: setPage,
          totalItems: pagination.totalItems,
          itemsPerPage: pagination.itemsPerPage,
        }}
        loading={loading}
        error={error}
        entityType="product"
        onView={handleViewExtra}
        onEdit={handleEditExtra}
        onDelete={handleDeleteExtra}
      />

      {/* Detail Modal */}
      <ExtraDetailModal
        extra={selectedExtra}
        isOpen={isDetailModalOpen}
        onClose={handleModalClose}
        onEdit={handleEditFromDetail}
      />

      {/* Edit Modal */}
      <ExtraEditModal
        extra={selectedExtra}
        isOpen={isEditModalOpen}
        onClose={handleModalClose}
        onSave={handleSaveExtra}
      />

      {/* Add Modal */}
      <ExtraAddModal
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        onSave={handleSaveNewExtra}
      />
    </div>
  );
}
