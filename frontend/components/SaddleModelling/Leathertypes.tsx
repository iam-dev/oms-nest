"use client";

import { useState, useEffect, useCallback } from 'react';
import { EntityTable } from '@/components/shared/EntityTable';
import type { Column } from '@/components/shared/DataTable';
import { useTableFilters, usePagination } from '@/hooks';
import { getLeathertypeTableColumns } from '@/utils/leathertypeTableColumns';
import { PageHeader } from '@/components/shared/PageHeader';
import { fetchLeathertypes, updateLeathertype, deleteLeathertype, createLeathertype, type Leathertype } from '@/services/leathertypes';
import { LeathertypeDetailModal } from '@/components/shared/LeathertypeDetailModal';
import { LeathertypeEditModal } from '@/components/shared/LeathertypeEditModal';
import { LeathertypeAddModal } from '@/components/shared/LeathertypeAddModal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { logger } from '@/utils/logger';

export default function Leathertypes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [leathertypes, setLeathertypes] = useState<Leathertype[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal states
  const [selectedLeathertype, setSelectedLeathertype] = useState<Leathertype | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Use our hooks for filters and pagination
  const { filters, updateFilter } = useTableFilters<Record<string, string>>({});
  const { pagination, setTotalItems, setPage } = usePagination(30, 1);
  
  // Fetch leathertypes with filters
  const fetchLeathertypesData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      logger.log('Fetching leathertypes with filters:', filters);
      const data = await fetchLeathertypes({
        page: pagination.currentPage,
        searchTerm,
        filters,
        orderBy: 'name',
        order: 'asc'
      });
      
      setLeathertypes(data['hydra:member'] || []);
      setTotalItems(data['hydra:totalItems'] || 0);
      
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leathertypes');
      setLeathertypes([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, searchTerm, filters, setTotalItems]);

  // Fetch leathertypes when dependencies change
  useEffect(() => {
    // TODO(react-hooks): fetchLeathertypesData is a useCallback that calls setState internally;
    // this is the standard async fetch-on-mount/dep-change pattern and is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLeathertypesData();
  }, [fetchLeathertypesData]);
  
  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    updateFilter(key, value);
    setPage(1); // Reset to page 1 when filters change
  };
  
  // Handle view leathertype details
  const handleViewLeathertype = (leathertype: Leathertype) => {
    setSelectedLeathertype(leathertype);
    setIsDetailModalOpen(true);
  };

  // Handle edit leathertype
  const handleEditLeathertype = (leathertype: Leathertype) => {
    setSelectedLeathertype(leathertype);
    setIsEditModalOpen(true);
  };

  // Handle edit from detail modal
  const handleEditFromDetail = () => {
    setIsDetailModalOpen(false);
    setIsEditModalOpen(true);
  };

  // Handle save leathertype
  const handleSaveLeathertype = async (updatedLeathertype: Partial<Leathertype>) => {
    if (!selectedLeathertype) return;

    try {
      await updateLeathertype(selectedLeathertype.id, updatedLeathertype);

      // Update local state
      setLeathertypes(prev =>
        prev.map(item =>
          item.id === selectedLeathertype.id
            ? { ...item, ...updatedLeathertype }
            : item
        )
      );

      // Refresh data to ensure consistency
      await fetchLeathertypesData();
    } catch (error) {
      logger.error('Error updating leathertype:', error);
      throw error; // Re-throw to let modal handle the error display
    }
  };

  // Handle delete leathertype
  const handleDeleteLeathertype = async (leathertype: Leathertype) => {
    if (window.confirm(`Are you sure you want to delete the leather type "${leathertype.name}"?`)) {
      try {
        await deleteLeathertype(leathertype.id);

        // Remove from local state
        setLeathertypes(prev => prev.filter(item => item.id !== leathertype.id));

        // Refresh data to ensure consistency
        await fetchLeathertypesData();
      } catch (error) {
        logger.error('Error deleting leathertype:', error);
        setError('Failed to delete leather type. Please try again.');
      }
    }
  };

  // Handle add leathertype
  const handleAddLeathertype = () => {
    setIsAddModalOpen(true);
  };

  // Handle save new leathertype (for add modal)
  const handleSaveNewLeathertype = async (newLeathertype: Partial<Leathertype>) => {
    try {
      await createLeathertype(newLeathertype);
      // Refresh the leathertype list
      fetchLeathertypesData();
      setIsAddModalOpen(false);
    } catch (error) {
      logger.error('Error creating leathertype:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setSelectedLeathertype(null);
    setIsDetailModalOpen(false);
    setIsEditModalOpen(false);
    setIsAddModalOpen(false);
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader 
        title="Leather Types" 
        description="Manage leather types for saddles" 
        actions={
          <Button onClick={handleAddLeathertype} className="bg-[#7b2326] hover:bg-[#8b2329] text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Leather Type
          </Button>
        } 
      />

      <EntityTable
        entities={leathertypes}
        columns={getLeathertypeTableColumns(filters, handleFilterChange) as unknown as Column<Leathertype>[]}
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
        onView={handleViewLeathertype}
        onEdit={handleEditLeathertype}
        onDelete={handleDeleteLeathertype}
      />

      {/* Detail Modal */}
      <LeathertypeDetailModal
        leathertype={selectedLeathertype}
        isOpen={isDetailModalOpen}
        onClose={handleModalClose}
        onEdit={handleEditFromDetail}
      />

      {/* Edit Modal */}
      <LeathertypeEditModal
        leathertype={selectedLeathertype}
        isOpen={isEditModalOpen}
        onClose={handleModalClose}
        onSave={handleSaveLeathertype}
      />

      {/* Add Modal */}
      <LeathertypeAddModal
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        onSave={handleSaveNewLeathertype}
      />
    </div>
  );
}
