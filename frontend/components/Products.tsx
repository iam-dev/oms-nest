"use client";

import { PageHeader } from './shared';
import { Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { EntityTable } from '@/components/shared/EntityTable';
import type { Column } from '@/components/shared/DataTable';
import { useTableFilters, usePagination } from '@/hooks';
import { getProductTableColumns } from '@/utils/productTableColumns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { logger } from '@/utils/logger';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: string;
  stock: number;
  status: string;
}

// Sample data - in a real app, this would come from the API
const sampleProducts: Product[] = [
  {
    id: 'PROD-001',
    name: 'Premium Headphones',
    category: 'Electronics',
    price: '$149.99',
    stock: 45,
    status: 'In Stock',
  },
  {
    id: 'PROD-002',
    name: 'Wireless Mouse',
    category: 'Electronics',
    price: '$49.99',
    stock: 5,
    status: 'Low Stock',
  },
];

export default function Products() {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Use our new hooks for filters and pagination
  const { filters, updateFilter } = useTableFilters<Record<string, string>>({});
  const { pagination, setTotalItems } = usePagination(10, 1);
  
  // In a real app, we would use useEntityData to fetch from the API
  // For now, we'll use our sample data
  const [products] = useState<Product[]>(sampleProducts);
  const loading = false;
  const error = '';
  
  // Set total items for pagination
  useEffect(() => {
    setTotalItems(products.length);
  }, [products, setTotalItems]);
  
  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    updateFilter(key, value);
  };
  
  // Handle view product details
  const handleViewProduct = (product: Product) => {
    logger.log('View product', product);
    // Implement view logic
  };
  
  // Handle edit product
  const handleEditProduct = (product: Product) => {
    logger.log('Edit product', product);
    // Implement edit logic
  };
  
  // Handle delete product
  const handleDeleteProduct = (product: Product) => {
    logger.log('Delete product', product);
    // Implement delete logic
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader 
        title="Products" 
        description="Manage your product catalog." 
        actions={
          <Button className="flex items-center">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        } 
      />

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <EntityTable
        entities={products}
        columns={getProductTableColumns(filters, handleFilterChange) as unknown as Column<Product>[]}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        headerFilters={filters}
        onFilterChange={handleFilterChange}
        pagination={pagination}
        loading={loading}
        error={error}
        entityType="product"
        onView={handleViewProduct}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
      />
    </div>
  );
}