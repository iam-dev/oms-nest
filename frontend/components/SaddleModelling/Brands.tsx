"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { EntityTable } from '@/components/shared/EntityTable';
import { useTableFilters, usePagination } from '@/hooks';
import { getBrandTableColumns } from '@/utils/brandTableColumns';
import { PageHeader } from '@/components/shared/PageHeader';
import { fetchBrands, updateBrand, deleteBrand, createBrand, type Brand } from '@/services/brands';
import { logger } from '@/utils/logger';
import { BrandDetailModal } from '@/components/shared/BrandDetailModal';
import { BrandEditModal } from '@/components/shared/BrandEditModal';
import { BrandAddModal } from '@/components/shared/BrandAddModal';

export default function Brands() {
  const [searchTerm, setSearchTerm] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal states
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Use our hooks for filters and pagination
  const { filters, updateFilter } = useTableFilters<Record<string, string>>({});
  const { pagination, setTotalItems, setPage } = usePagination(30, 1);
  
  // Fetch brands with filters
  const fetchBrandsData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      logger.log('Fetching brands with filters:', filters);
      const data = await fetchBrands({
        page: pagination.currentPage,
        searchTerm,
        filters,
        orderBy: 'name',
        order: 'asc'
      });
      
      setBrands(data['hydra:member'] || []);
      setTotalItems(data['hydra:totalItems'] || 0);
      
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Failed to fetch brands');
      setBrands([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, searchTerm, filters, setTotalItems]);

  // Fetch brands when dependencies change
  useEffect(() => {
    // TODO(react-hooks): fetchBrandsData is a useCallback that calls setState internally;
    // this is the standard async fetch-on-mount/dep-change pattern and is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBrandsData();
  }, [fetchBrandsData]);
  
  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    updateFilter(key, value);
    setPage(1); // Reset to page 1 when filters change
  };
  
  // Handle view brand details
  const handleViewBrand = (brand: Brand) => {
    setSelectedBrand(brand);
    setShowDetailModal(true);
  };

  // Handle edit brand
  const handleEditBrand = (brand: Brand) => {
    setSelectedBrand(brand);
    setShowEditModal(true);
  };

  // Handle delete brand
  const handleDeleteBrand = async (brand: Brand) => {
    if (window.confirm(`Are you sure you want to delete brand "${brand.name}"?`)) {
      try {
        await deleteBrand(brand.id);
        // Refresh the brand list
        fetchBrandsData();
      } catch (error) {
        logger.error('Error deleting brand:', error);
        setError(error instanceof Error ? error.message : 'Failed to delete brand');
      }
    }
  };

  // Handle save brand (for edit modal)
  const handleSaveBrand = async (updatedBrand: Partial<Brand>) => {
    if (!selectedBrand) return;

    try {
      await updateBrand(selectedBrand.id, updatedBrand);
      // Refresh the brand list
      fetchBrandsData();
      setShowEditModal(false);
      setSelectedBrand(null);
    } catch (error) {
      logger.error('Error updating brand:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  // Handle add brand
  const handleAddBrand = () => {
    setShowAddModal(true);
  };

  // Handle save new brand (for add modal)
  const handleSaveNewBrand = async (newBrand: Partial<Brand>) => {
    try {
      await createBrand(newBrand);
      // Refresh the brand list
      fetchBrandsData();
      setShowAddModal(false);
    } catch (error) {
      logger.error('Error creating brand:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  // Handle close modals
  const handleCloseModals = () => {
    setShowDetailModal(false);
    setShowEditModal(false);
    setShowAddModal(false);
    setSelectedBrand(null);
  };

  // Handle edit from detail modal
  const handleEditFromDetail = () => {
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader 
        title="Brands" 
        description="Manage your saddle brands" 
        actions={
          <Button onClick={handleAddBrand} className="bg-[#7b2326] hover:bg-[#8b2329] text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Brand
          </Button>
        } 
      />


      <EntityTable
        entities={brands}
        columns={getBrandTableColumns(filters, handleFilterChange)}
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
        entityType="brand"
        onView={handleViewBrand}
        onEdit={handleEditBrand}
        onDelete={handleDeleteBrand}
      />

      {/* Brand Detail Modal */}
      <BrandDetailModal
        brand={selectedBrand}
        isOpen={showDetailModal}
        onClose={handleCloseModals}
        onEdit={handleEditFromDetail}
      />

      {/* Brand Edit Modal */}
      <BrandEditModal
        brand={selectedBrand}
        isOpen={showEditModal}
        onClose={handleCloseModals}
        onSave={handleSaveBrand}
      />

      {/* Brand Add Modal */}
      <BrandAddModal
        isOpen={showAddModal}
        onClose={handleCloseModals}
        onSave={handleSaveNewBrand}
      />
    </div>
  );
}
