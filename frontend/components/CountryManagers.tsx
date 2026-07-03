"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { EntityTable } from '@/components/shared/EntityTable';
import type { Column } from '@/components/shared/DataTable';
import { useTableFilters, usePagination, useEntityData } from '@/hooks';
import { getCountryManagerTableColumns } from '@/utils/countryManagersTableColumns';
import { PageHeader } from '@/components/shared/PageHeader';
import { deleteCountryManager, type CountryManager } from '@/services/country-managers';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

export default function CountryManagers() {
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedCountryManager, setSelectedCountryManager] = useState<CountryManager | null>(null);

  // Use our hooks for filters and pagination
  const { filters, updateFilter } = useTableFilters<Record<string, string>>({});
  const { pagination, setTotalItems } = usePagination(10, 1);

  // Use our data fetching hook with optimistic updates
  const {
    data: countryManagers = [],
    loading,
    error,
    refetch,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateEntityOptimistically,
    removeEntityOptimistically
  } = useEntityData<CountryManager>({
    entity: 'country_managers',
    page: pagination.currentPage,
    orderBy: 'country',
    autoFetch: true
  });

  // Update total items when data changes
  useEffect(() => {
    if (countryManagers) {
      setTotalItems(countryManagers.length);
    }
  }, [countryManagers, setTotalItems]);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    updateFilter(key, value);
  };

  // Handle view country manager details
  const handleViewCountryManager = (countryManager: CountryManager) => {
    // Placeholder - view functionality to be implemented
    logger.log('View country manager:', countryManager);
  };

  // Handle edit country manager
  const handleEditCountryManager = (countryManager: CountryManager) => {
    // Placeholder - edit functionality to be implemented
    logger.log('Edit country manager:', countryManager);
  };

  // Handle add new country manager
  const handleAddCountryManager = () => {
    // Placeholder - add functionality to be implemented
    logger.log('Add new country manager');
  };

  // Handle delete country manager
  const handleDeleteCountryManager = async (countryManager: CountryManager) => {
    if (window.confirm(`Are you sure you want to delete country manager for "${countryManager.country}"?`)) {
      // Apply optimistic removal immediately
      removeEntityOptimistically(countryManager.id);

      try {
        await deleteCountryManager(countryManager.id);

        // Show success toast
        toast.success(`Country manager for "${countryManager.country}" deleted successfully`);

        // Force a fresh fetch to ensure data consistency
        setTimeout(() => {
          refetch(true);
        }, 100);

      } catch (error) {
        logger.error('Error deleting country manager:', error);

        // Show error toast
        toast.error(`Failed to delete country manager: ${error instanceof Error ? error.message : 'Unknown error'}`);

        // Revert optimistic update on error by refetching
        refetch(true);
      }
    }
  };


  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Country Managers"
        description="Manage country managers"
        actions={
          <Button onClick={handleAddCountryManager} className="bg-[#7b2326] hover:bg-[#8b2329] text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Country Manager
          </Button>
        }
      />

      <EntityTable
        entities={countryManagers}
        columns={getCountryManagerTableColumns(filters, handleFilterChange) as unknown as Column<CountryManager>[]}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        headerFilters={filters}
        onFilterChange={handleFilterChange}
        pagination={pagination}
        loading={loading}
        error={error}
        entityType="country-manager"
        onView={handleViewCountryManager}
        onEdit={handleEditCountryManager}
        onDelete={handleDeleteCountryManager}
      />
    </div>
  );
}