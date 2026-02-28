"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { EntityTable } from '@/components/shared/EntityTable';
import { useTableFilters, usePagination } from '@/hooks';
import { getOptionTableColumns } from '@/utils/optionTableColumns';
import { PageHeader } from '@/components/shared/PageHeader';
import { fetchOptions, updateOption, deleteOption, createOption, type Option } from '@/services/options';
import { logger } from '@/utils/logger';
import { OptionDetailModal } from '@/components/shared/OptionDetailModal';
import { OptionEditModal } from '@/components/shared/OptionEditModal';
import { OptionAddModal } from '@/components/shared/OptionAddModal';

export default function Options() {
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal states
  const [selectedOption, setSelectedOption] = useState<Option | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Use our hooks for filters and pagination
  const { filters, updateFilter } = useTableFilters<Record<string, string>>({});
  const { pagination, setTotalItems, setPage } = usePagination(30, 1);
  
  // Fetch options with filters
  const fetchOptionsData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      logger.log('Fetching options with filters:', filters);
      const data = await fetchOptions({
        page: pagination.currentPage,
        searchTerm,
        filters,
        orderBy: 'sequence',
        order: 'asc'
      });

      // Filter out type=2 (extras) — they have their own management page
      const members = (data['hydra:member'] || []).filter(
        (opt) => opt.type !== 2
      );
      setOptions(members);
      setTotalItems(members.length);
      
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Failed to fetch options');
      setOptions([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, searchTerm, filters, setTotalItems]);

  // Fetch options when dependencies change
  useEffect(() => {
    fetchOptionsData();
  }, [fetchOptionsData]);
  
  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    updateFilter(key, value);
    setPage(1); // Reset to page 1 when filters change
  };
  
  // Handle view option details
  const handleViewOption = (option: Option) => {
    setSelectedOption(option);
    setIsDetailModalOpen(true);
  };

  // Handle edit option
  const handleEditOption = (option: Option) => {
    setSelectedOption(option);
    setIsEditModalOpen(true);
  };

  // Handle edit from detail modal
  const handleEditFromDetail = () => {
    setIsDetailModalOpen(false);
    setIsEditModalOpen(true);
  };

  // Handle save option
  const handleSaveOption = async (updatedOption: Partial<Option>) => {
    if (!selectedOption) return;

    try {
      await updateOption(selectedOption.id, updatedOption);

      // Update local state
      setOptions(prev =>
        prev.map(item =>
          item.id === selectedOption.id
            ? { ...item, ...updatedOption }
            : item
        )
      );

      // Refresh data to ensure consistency
      await fetchOptionsData();
    } catch (error) {
      logger.error('Error updating option:', error);
      throw error; // Re-throw to let modal handle the error display
    }
  };

  // Handle delete option
  const handleDeleteOption = async (option: Option) => {
    if (window.confirm(`Are you sure you want to delete the option "${option.name}"?`)) {
      try {
        await deleteOption(option.id);

        // Remove from local state
        setOptions(prev => prev.filter(item => item.id !== option.id));

        // Refresh data to ensure consistency
        await fetchOptionsData();
      } catch (error) {
        logger.error('Error deleting option:', error);
        setError('Failed to delete option. Please try again.');
      }
    }
  };

  // Handle add option
  const handleAddOption = () => {
    setIsAddModalOpen(true);
  };

  // Handle save new option (for add modal)
  const handleSaveNewOption = async (newOption: Partial<Option>) => {
    try {
      await createOption(newOption);
      // Refresh the option list
      fetchOptionsData();
      setIsAddModalOpen(false);
    } catch (error) {
      logger.error('Error creating option:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setSelectedOption(null);
    setIsDetailModalOpen(false);
    setIsEditModalOpen(false);
    setIsAddModalOpen(false);
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader 
        title="Options" 
        description="Manage your saddle options" 
        actions={
          <Button onClick={handleAddOption} className="bg-[#7b2326] hover:bg-[#8b2329] text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Option
          </Button>
        } 
      />


      <EntityTable
        entities={options}
        columns={getOptionTableColumns(filters, handleFilterChange)}
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
        entityType="option"
        onView={handleViewOption}
        onEdit={handleEditOption}
        onDelete={handleDeleteOption}
      />

      {/* Detail Modal */}
      <OptionDetailModal
        option={selectedOption}
        isOpen={isDetailModalOpen}
        onClose={handleModalClose}
        onEdit={handleEditFromDetail}
      />

      {/* Edit Modal */}
      <OptionEditModal
        option={selectedOption}
        isOpen={isEditModalOpen}
        onClose={handleModalClose}
        onSave={handleSaveOption}
      />

      {/* Add Modal */}
      <OptionAddModal
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        onSave={handleSaveNewOption}
      />
    </div>
  );
}
