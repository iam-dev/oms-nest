'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAllSaddleStock } from '@/services/saddleStock';
import { SaddleStock } from '@/types/SaddleStock';
import { EntityTable } from '@/components/shared/EntityTable';
import { Column } from '@/components/shared/DataTable';
import { SaddleStockDetailModal } from '@/components/shared/SaddleStockDetailModal';
import { useTableFilters, usePagination } from '@/hooks';
import { PageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/utils/logger';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const getDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return (obj.name as string) || (obj.title as string) || JSON.stringify(value);
  }
  return String(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getSaddleStockColumns = (): Column<SaddleStock>[] => [
  {
    key: 'serial',
    title: 'Serial',
    render: (_value: unknown, row?: SaddleStock) =>
      row ? <span className="font-mono">{row.serial}</span> : null,
  },
  {
    key: 'name',
    title: 'Name',
  },
  {
    key: 'model',
    title: 'Model',
    render: (_value: unknown, row?: SaddleStock) =>
      row ? getDisplayValue(row.model) : '-',
  },
  {
    key: 'leatherType',
    title: 'Leather Type',
    render: (_value: unknown, row?: SaddleStock) =>
      row ? getDisplayValue(row.leatherType) : '-',
  },
  {
    key: 'stock',
    title: 'Stock',
    render: (_value: unknown, row?: SaddleStock) =>
      row ? (
        <Badge variant={row.stock > 5 ? 'default' : row.stock > 0 ? 'secondary' : 'destructive'}>
          {row.stock}
        </Badge>
      ) : null,
  },
  {
    key: 'stockOwner',
    title: 'Owner',
    render: (_value: unknown, row?: SaddleStock) =>
      row ? getDisplayValue(row.stockOwner?.name) : '-',
  },
  {
    key: 'demo',
    title: 'Demo',
    render: (_value: unknown, row?: SaddleStock) =>
      row ? (
        <Badge variant={row.demo ? 'outline' : 'secondary'}>
          {row.demo ? 'Yes' : 'No'}
        </Badge>
      ) : null,
  },
  {
    key: 'customizableProduct',
    title: 'Customizable',
    render: (_value: unknown, row?: SaddleStock) =>
      row ? (
        <Badge variant={row.customizableProduct ? 'default' : 'secondary'}>
          {row.customizableProduct ? 'Yes' : 'No'}
        </Badge>
      ) : null,
  },
  {
    key: 'createdAt',
    title: 'Created',
    render: (_value: unknown, row?: SaddleStock) =>
      row ? formatDate(row.createdAt) : '-',
  },
];

export default function AllSaddleStockPage() {
  const [saddleStock, setSaddleStock] = useState<SaddleStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSaddle, setSelectedSaddle] = useState<SaddleStock | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { filters, updateFilter } = useTableFilters<Record<string, string>>({});
  const { pagination, setTotalItems } = usePagination(10, 1);

  const loadSaddleStock = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchAllSaddleStock({
        page: pagination.currentPage,
        search: searchTerm || undefined,
      });

      if (result.data) {
        setSaddleStock(result.data);
        setTotalItems(result.total || result.data.length);
      } else {
        setSaddleStock([]);
        setTotalItems(0);
      }
    } catch (err) {
      setError('Failed to load saddle stock. Please try again.');
      setSaddleStock([]);
      logger.error('Error loading all saddle stock:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, searchTerm, setTotalItems]);

  useEffect(() => {
    loadSaddleStock();
  }, [loadSaddleStock]);

  const handleFilterChange = (key: string, value: string) => {
    updateFilter(key, value);
  };

  const handleViewSaddle = (saddle: SaddleStock) => {
    setSelectedSaddle(saddle);
    setIsDetailsOpen(true);
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="All Saddle Stock"
        description="Browse all fitter saddle inventory."
      />

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search all stock..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      <EntityTable
        entities={saddleStock}
        columns={getSaddleStockColumns()}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        headerFilters={filters}
        onFilterChange={handleFilterChange}
        pagination={pagination ?? undefined}
        loading={loading}
        error={error ?? undefined}
        entityType="product"
        onView={handleViewSaddle}
        actionButtons={{
          view: true,
          edit: false,
          delete: false
        }}
      />

      <SaddleStockDetailModal
        saddle={selectedSaddle}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    </div>
  );
}
