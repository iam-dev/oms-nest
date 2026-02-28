import React from 'react';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Trash, CheckCircle2, Lock } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export interface EntityTableProps<T> {
  entities: T[];
  columns: Column<T>[];
  searchTerm?: string;
  onSearch?: (term: string) => void;
  headerFilters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
  };
  loading?: boolean;
  error?: string;
  // Action handlers
  onView?: (entity: T) => void;
  onEdit?: (entity: T) => void;
  onDelete?: (entity: T) => void;
  onApprove?: (entity: T) => void;
  onBlock?: (entity: T) => void;
  // Customization
  entityType?: 'order' | 'customer' | 'product' | 'fitter' | 'user' | 'warehouse' | 'supplier' | 'factory' | 'access-filter-group' | 'country-manager' | 'saddle' | 'brand' | 'option' | 'preset' | 'leathertype' | 'extra';
  showActions?: boolean;
  searchPlaceholder?: string;
  actionButtons?: {
    view?: boolean;
    edit?: boolean;
    delete?: boolean;
    approve?: boolean;
    block?: boolean;
  };
}

export function EntityTable<T extends { id?: string | number }>({
  entities,
  columns,
  searchTerm = '',
  onSearch,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  headerFilters = {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onFilterChange,
  pagination,
  loading,
  error,
  onView,
  onEdit,
  onDelete,
  onApprove,
  onBlock,
  entityType = 'order',
  showActions = true,
  searchPlaceholder,
  actionButtons = { view: true, edit: true, delete: true, approve: false, block: false },
}: EntityTableProps<T>) {
  // Add actions column if showActions is true
  const columnsWithActions: Column<T>[] = showActions
    ? [
        ...columns,
        {
          key: 'actions',
          title: 'OPTIONS',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          render: (value: any, row?: T) => {
            if (!row) return null;
            
            return (
              <div className="flex space-x-2">
                {actionButtons.view && onView && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onView(row)}
                        className="h-8 w-8"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View {entityType}</TooltipContent>
                  </Tooltip>
                )}
                
                {actionButtons.edit && onEdit && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(row)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit {entityType}</TooltipContent>
                  </Tooltip>
                )}
                
                {actionButtons.approve && onApprove && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onApprove(row)}
                        className="h-8 w-8"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Approve {entityType}</TooltipContent>
                  </Tooltip>
                )}
                
                {actionButtons.block && onBlock && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onBlock(row)}
                        className="h-8 w-8 text-orange-500 hover:text-orange-700"
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Block/Unblock {entityType}</TooltipContent>
                  </Tooltip>
                )}

                {actionButtons.delete && onDelete && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(row)}
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete {entityType}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          },
        },
      ]
    : columns;

  return (
    <div className="space-y-4">
      <DataTable
        columns={columnsWithActions}
        data={entities}
        searchPlaceholder={searchPlaceholder || `Search ${entityType}s...`}
        onSearch={onSearch}
        searchTerm={searchTerm}
        pagination={pagination}
        loading={loading}
        error={error}
      />
      
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md">
          Error: {error}
        </div>
      )}
    </div>
  );
}
