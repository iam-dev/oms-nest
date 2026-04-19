"use client";

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityTable } from '@/components/shared/EntityTable';
import { useTableFilters, usePagination, useEntityData } from '@/hooks';
import { getFitterTableColumns } from '@/utils/fitterTableColumns';
import { PageHeader } from '@/components/shared/PageHeader';
import { updateFitter, deleteFitter, createFitter, blockFitter, fetchFitterCountries, type Fitter } from '@/services/fitters';
import { toast } from 'sonner';
import { FitterDetailModal } from '@/components/shared/FitterDetailModal';
import { FitterEditModal } from '@/components/shared/FitterEditModal';
import { logger } from '@/utils/logger';

export default function Fitters() {
  const [searchTerm, setSearchTerm] = useState('');
  const [countries, setCountries] = useState<string[]>([]);

  useEffect(() => {
    fetchFitterCountries().then(setCountries);
  }, []);

  // Modal states
  const [selectedFitter, setSelectedFitter] = useState<Fitter | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [actionError, setActionError] = useState('');

  // Use our hooks for filters and pagination
  const { filters, updateFilter } = useTableFilters<Record<string, string>>({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pagination, setTotalItems, setPage } = usePagination(30, 1);

  // Use our data fetching hook
  const {
    data: fitters = [],
    loading,
    error,
    totalItems,
    refetch
  } = useEntityData<Fitter>({
    entity: 'fitters',
    page: pagination.currentPage,
    orderBy: 'id',
    extraParams: {
      searchTerm,
      ...filters
    },
    autoFetch: true
  });

  
  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    updateFilter(key, value);
    setPage(1); // Reset to page 1 when filters change
  };
  
  // Handle view fitter details
  const handleViewFitter = (fitter: Fitter) => {
    setSelectedFitter(fitter);
    setShowDetailModal(true);
  };

  // Handle edit fitter
  const handleEditFitter = (fitter: Fitter) => {
    setSelectedFitter(fitter);
    setShowEditModal(true);
  };

  // Handle delete fitter
  const handleDeleteFitter = async (fitter: Fitter) => {
    if (window.confirm(`Are you sure you want to delete fitter "${fitter.name || fitter.username}"?`)) {
      try {
        await deleteFitter(fitter.id);
        toast.success(`Fitter "${fitter.name || fitter.username}" deleted successfully`);
        refetch();
      } catch (error) {
        logger.error('Error deleting fitter:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to delete fitter');
      }
    }
  };

  // Handle create new fitter
  const handleCreateFitter = () => {
    setSelectedFitter(null);
    setShowCreateModal(true);
  };

  // Handle save fitter (for edit modal)
  const handleSaveFitter = async (updatedFitter: Partial<Fitter>) => {
    if (!selectedFitter) return;

    try {
      await updateFitter(selectedFitter.id, updatedFitter);
      refetch();
      setShowEditModal(false);
      setSelectedFitter(null);
    } catch (error) {
      logger.error('Error updating fitter:', error);
      throw error;
    }
  };

  // Handle create fitter save
  const handleCreateFitterSave = async (newFitter: Partial<Fitter> & { password?: string }) => {
    try {
      // Transform frontend Fitter fields to match backend CreateFitterDto
      const backendPayload: Record<string, unknown> = {
        username: newFitter.username || '',
        firstName: newFitter.firstName || '',
        lastName: newFitter.lastName || '',
        emailaddress: newFitter.email || '', // backend expects 'emailaddress', not 'email'
        address: newFitter.address || '',
        city: newFitter.city || '',
        country: newFitter.country || '',
        state: newFitter.state || '',
        zipcode: newFitter.zipcode || '',
        phoneNo: newFitter.phoneNo || '',
        cellNo: newFitter.cellNo || '',
        password: newFitter.password,
      };
      await createFitter(backendPayload);
      refetch();
      setShowCreateModal(false);
      setSelectedFitter(null);
    } catch (error) {
      logger.error('Error creating fitter:', error);
      throw error;
    }
  };

  // Handle block/unblock fitter
  const handleBlockFitter = async (fitter: Fitter) => {
    const action = fitter.enabled ? 'block' : 'unblock';
    if (window.confirm(`Are you sure you want to ${action} fitter "${fitter.name || fitter.username}"?`)) {
      try {
        const result = await blockFitter(fitter.id);
        toast.success(`Fitter "${fitter.name || fitter.username}" ${result.enabled ? 'unblocked' : 'blocked'} successfully`);
        refetch();
      } catch (error) {
        logger.error('Error toggling fitter block:', error);
        toast.error(`Failed to ${action} fitter: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Handle close modals
  const handleCloseModals = () => {
    setShowDetailModal(false);
    setShowEditModal(false);
    setShowCreateModal(false);
    setSelectedFitter(null);
  };

  // Handle edit from detail modal
  const handleEditFromDetail = () => {
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader 
        title="Fitters" 
        description="Manage your fitters" 
        actions={
          <Button onClick={handleCreateFitter} className="bg-[#7b2326] hover:bg-[#8b2329] text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Fitter
          </Button>
        } 
      />


      <EntityTable
        entities={fitters}
        columns={getFitterTableColumns(filters, handleFilterChange, countries)}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        headerFilters={filters}
        onFilterChange={handleFilterChange}
        pagination={{
          currentPage: pagination.currentPage,
          totalPages: Math.max(1, Math.ceil(totalItems / pagination.itemsPerPage)),
          onPageChange: setPage,
          totalItems: totalItems,
          itemsPerPage: pagination.itemsPerPage,
        }}
        loading={loading}
        error={error}
        entityType="fitter"
        onView={handleViewFitter}
        onEdit={handleEditFitter}
        onDelete={handleDeleteFitter}
        onBlock={handleBlockFitter}
        actionButtons={{ view: true, edit: true, delete: true, block: true }}
      />

      {/* Fitter Detail Modal */}
      <FitterDetailModal
        fitter={selectedFitter}
        isOpen={showDetailModal}
        onClose={handleCloseModals}
        onEdit={handleEditFromDetail}
      />

      {/* Fitter Edit Modal */}
      <FitterEditModal
        fitter={selectedFitter}
        isOpen={showEditModal}
        onClose={handleCloseModals}
        onSave={handleSaveFitter}
      />

      {/* Fitter Create Modal */}
      <FitterEditModal
        fitter={null}
        isOpen={showCreateModal}
        onClose={handleCloseModals}
        onSave={handleCreateFitterSave}
      />
    </div>
  );
}