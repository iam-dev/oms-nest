import React from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { getCustomerTableColumns, CustomerHeaderFilters, CustomerFilterChangeHandler } from '@/utils/customerTableColumns';

interface Customer {
  id: number;
  name: string;
  country: string;
  city: string;
  email: string;
  fitter?: { name: string } | string;
  orderCount?: number;
  createdAt?: string;
}

interface CustomersTableProps {
  customers: Customer[];
  filterValues: CustomerHeaderFilters;
  onFilterChange: CustomerFilterChangeHandler;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
  };
  loading?: boolean;
  error?: string;
}

export function CustomersTable({
  customers,
  filterValues,
  onFilterChange,
  pagination,
  loading,
  error,
}: CustomersTableProps) {
  // Prepare columns using the new utility
  // Cast required: customerTableColumns renders use `row: CustomerRow` (required) but
  // DataTable.Column<T>.render declares `row?: T` (optional). Both shapes are structurally
  // compatible at runtime; the cast narrows the type without widening to any.
  const columns = getCustomerTableColumns(filterValues, onFilterChange) as unknown as Column<Customer>[];

  return (
    <div className="space-y-4">
      {/* Alleen de DataTable, geen zoekveld of footer hier */}
      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={customers}
          pagination={pagination}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
}
