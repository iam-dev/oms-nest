"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { EntityTable } from '@/components/shared/EntityTable';
import type { Column } from '@/components/shared/DataTable';
import { useTableFilters } from '@/hooks';
import { getCustomerTableColumns } from '@/utils/customerTableColumns';
import { PageHeader } from '@/components/shared/PageHeader';
import { fetchCustomers, updateCustomer, deleteCustomer, createCustomer, type Customer } from '@/services/customers';
import { CustomerDetailModal } from '@/components/shared/CustomerDetailModal';
import { CustomerEditModal } from '@/components/shared/CustomerEditModal';
import { logger } from '@/utils/logger';

// Customer editing is now supported through the BreezeJS SaveBundle API

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalItemsState, setTotalItemsState] = useState(0);

  // Modal states
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Use our hooks for filters and pagination
  const { filters, updateFilter } = useTableFilters<Record<string, string>>({});

  // Direct pagination state management (bypass usePagination hook)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Calculate totalPages directly from immediate state
  const totalPagesCalculated = Math.max(1, Math.ceil(totalItemsState / itemsPerPage));
  
  // Fetch customers with filters
  const fetchCustomersData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      logger.log('Fetching customers with filters:', filters);
      const data = await fetchCustomers({
        page: currentPage,
        searchTerm,
        filters,
        orderBy: 'id',
        order: 'desc'
      });

      const customers = data['hydra:member'] || [];
      const actualTotalItems = data['hydra:totalItems'];

      // Fallback: If hydra:totalItems is missing, estimate based on page data
      let totalItems;
      if (actualTotalItems !== undefined && actualTotalItems !== null) {
        totalItems = actualTotalItems;
      } else {
        // If we got a full page (20 items), assume there might be more pages
        // If less than 20, this is likely the last page
        if (customers.length === 20) {
          // Estimate: current page * itemsPerPage + at least current page items
          // This will enable NEXT button to try loading next page
          totalItems = currentPage * itemsPerPage + 1;
        } else {
          // This is likely the last page, calculate total based on current page
          totalItems = (currentPage - 1) * itemsPerPage + customers.length;
        }
      }

      setCustomers(customers);
      setTotalItemsState(totalItems);


    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
      setCustomers([]);
      setTotalItemsState(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, filters]);

  // Fetch customers when dependencies change
  // TODO(react-hooks): fetchCustomersData is a useCallback-wrapped async fetch — standard data-loading trigger, not a cascading-render issue
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchCustomersData();
  }, [fetchCustomersData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    updateFilter(key, value);
    setCurrentPage(1); // Reset to page 1 when filters change
  };
  
  // Handle view customer details
  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
  };

  // Handle edit customer
  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowEditModal(true);
  };

  // Handle create new customer
  const handleCreateCustomer = () => {
    setSelectedCustomer(null);
    setShowCreateModal(true);
  };

  // Optimistic update functions
  const updateCustomerOptimistically = (updatedCustomer: Partial<Customer> & { id: string }) => {
    setCustomers(currentCustomers =>
      currentCustomers.map(customer =>
        customer.id === updatedCustomer.id ? { ...customer, ...updatedCustomer } : customer
      )
    );
  };

  const removeCustomerOptimistically = (customerId: string) => {
    setCustomers(currentCustomers =>
      currentCustomers.filter(customer => customer.id !== customerId)
    );
  };

  // Handle delete customer
  const handleDeleteCustomer = async (customer: Customer) => {
    if (window.confirm(`Are you sure you want to delete customer "${customer.name}"?`)) {
      // Apply optimistic removal immediately
      removeCustomerOptimistically(customer.id);

      try {
        await deleteCustomer(customer.id);
        logger.log(`Customer "${customer.name}" deleted successfully`);
      } catch (error) {
        logger.error('Error deleting customer:', error);

        // Revert optimistic removal on error by refetching
        fetchCustomersData();

        setError(error instanceof Error ? error.message : 'Failed to delete customer');
      }
    }
  };

  // Handle save customer (for edit modal)
  const handleSaveCustomer = async (updatedCustomer: Partial<Customer>) => {
    if (!selectedCustomer) return;

    // Apply optimistic update immediately
    const optimisticData = {
      ...selectedCustomer,
      ...updatedCustomer,
      id: selectedCustomer.id
    };
    updateCustomerOptimistically(optimisticData);

    try {
      const result = await updateCustomer(selectedCustomer.id, updatedCustomer);

      // Update with actual response data if available
      if (result && result.id) {
        updateCustomerOptimistically(result);
      }

      setShowEditModal(false);
      setSelectedCustomer(null);
      logger.log(`Customer "${updatedCustomer.name || selectedCustomer.name}" updated successfully`);
    } catch (error) {
      logger.error('Error updating customer:', error);

      // Revert optimistic update on error by refetching
      fetchCustomersData();

      throw error; // Re-throw to show error in modal
    }
  };

  // Handle create customer (for create modal)
  const handleCreateCustomerSave = async (newCustomer: Partial<Customer>) => {
    try {
      await createCustomer(newCustomer);

      // Refetch to show the new customer in correct sort order
      await fetchCustomersData();

      setShowCreateModal(false);
      setSelectedCustomer(null);
      logger.log(`Customer "${newCustomer.name}" created successfully`);
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  // Handle close modals
  const handleCloseModals = () => {
    setShowDetailModal(false);
    setShowEditModal(false);
    setShowCreateModal(false);
    setSelectedCustomer(null);
  };

  // Handle edit from detail modal
  const handleEditFromDetail = () => {
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader 
        title="Customers" 
        description="Manage your customers" 
        actions={
          <Button onClick={handleCreateCustomer} className="bg-[#7b2326] hover:bg-[#8b2329] text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        } 
      />


      <EntityTable
        entities={customers}
        columns={getCustomerTableColumns(filters, handleFilterChange) as unknown as Column<Customer>[]}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        headerFilters={filters}
        onFilterChange={handleFilterChange}
        pagination={(() => {
          const paginationData = {
            currentPage: currentPage,
            totalPages: totalPagesCalculated,
            onPageChange: (newPage: number) => {
              setCurrentPage(newPage);
            },
            totalItems: totalItemsState,
            itemsPerPage: itemsPerPage,
          };
          return paginationData;
        })()}
        loading={loading}
        error={error}
        entityType="customer"
        onView={handleViewCustomer}
        onEdit={handleEditCustomer}
        onDelete={handleDeleteCustomer}
      />

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        customer={selectedCustomer}
        isOpen={showDetailModal}
        onClose={handleCloseModals}
        onEdit={handleEditFromDetail}
      />

      {/* Customer Edit Modal */}
      <CustomerEditModal
        customer={selectedCustomer}
        isOpen={showEditModal}
        onClose={handleCloseModals}
        onSave={handleSaveCustomer}
      />

      {/* Customer Create Modal */}
      <CustomerEditModal
        customer={null}
        isOpen={showCreateModal}
        onClose={handleCloseModals}
        onSave={handleCreateCustomerSave}
      />
    </div>
  );
}