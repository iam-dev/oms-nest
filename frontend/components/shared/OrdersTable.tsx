import { Eye, Edit, Trash, CheckCircle2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Order } from '@/types/Order';
import React from 'react';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { logger } from '@/utils/logger';
import { useUserRole } from '@/hooks/useUserRole';
import { hasScreenPermission, canEditOrder } from '@/utils/rolePermissions';
import { FITTER_RESTRICTED_STATUSES } from '@/utils/orderConstants';
import { UserRole } from '@/types/Role';

export type OrdersTableColumn = Column;

export interface OrdersTableProps {
  orders: Order[];
  columns?: OrdersTableColumn[];
  searchTerm?: string;
  onSearch?: (term: string) => void;
  headerFilters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onViewOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  onApproveOrder?: (order: Order) => void;
  onDeleteOrder?: (order: Order) => void;
  seatSizes?: string[];
  statuses?: string[];
  fitters?: string[];
  dateFrom: Date | undefined;
  setDateFrom: (date: Date | undefined) => void;
  dateTo: Date | undefined;
  setDateTo: (date: Date | undefined) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
  };
}

export function OrdersTable({
  orders,
  columns,
  searchTerm = '',
  onSearch,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  headerFilters = {},
  onFilterChange,
  onViewOrder,
  onEditOrder,
  onApproveOrder,
  onDeleteOrder,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  seatSizes,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  statuses,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fitters,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  pagination,
}: OrdersTableProps) {
  const { role } = useUserRole();

  // Debug role information
  logger.log('OrdersTable: Current role:', role);
  
  // Optionally add OPTIONS column if any action handlers are provided
  const hasActions = onViewOrder || onEditOrder || onApproveOrder || onDeleteOrder;
  const columnsWithActions: OrdersTableColumn[] = hasActions
    ? [
        ...(columns || []),
        {
          key: 'actions',
          title: 'OPTIONS',
          render: (_: unknown, row?: Order) => (
            <div className="flex gap-2">
              {onViewOrder && row && (hasScreenPermission(role, 'ORDER_VIEW') || role === null) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onViewOrder(row)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View Order</TooltipContent>
                </Tooltip>
              )}
              {onEditOrder && row && (() => {
                // Null role fallback: show edit button (matches view/approve/delete pattern)
                if (role === null) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEditOrder(row)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit Order</TooltipContent>
                    </Tooltip>
                  );
                }

                const orderStatus = (row.orderStatus || row.status) as string | undefined;
                const canEdit = canEditOrder(role, orderStatus);
                const isFitterRestricted = role === UserRole.FITTER
                  && orderStatus
                  && FITTER_RESTRICTED_STATUSES.includes(orderStatus);

                if (canEdit) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEditOrder(row)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit Order</TooltipContent>
                    </Tooltip>
                  );
                }

                if (isFitterRestricted) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-40 cursor-not-allowed"
                          disabled
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Orders with status &quot;{orderStatus}&quot; cannot be edited
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return null;
              })()}
              {onApproveOrder && row && (hasScreenPermission(role, 'ORDER_APPROVE') || role === null) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onApproveOrder(row)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Approve Order</TooltipContent>
                </Tooltip>
              )}
              {onDeleteOrder && row && (hasScreenPermission(role, 'ORDER_DELETE') || role === null) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => onDeleteOrder(row)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Order</TooltipContent>
                </Tooltip>
              )}
            </div>
          ),
        },
      ]
    : columns || [];

  return (
    <div>
      <div className="flex flex-row items-center gap-2 mb-4 w-full">
        {/* Left: Search input */}
        {onSearch && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}
        
        {/* Right: date range picker and show button */}
        <div className="flex-1 flex justify-end items-center gap-2">
          <DateRangePicker
            fromDate={dateFrom}
            setFromDate={setDateFrom}
            toDate={dateTo}
            setToDate={setDateTo}
          />
          <button
            className="bg-[#8B0000] text-white rounded px-4 py-1 text-sm font-semibold border border-[#8B0000] hover:bg-[#a60000]"
            style={{ height: 32 }}
            onClick={() => {
              // Force a refresh by updating the headerFilters with a timestamp
              // This will trigger the useEffect in Dashboard that fetches orders
              if (onFilterChange) {
                onFilterChange('dateRefresh', Date.now().toString());
              }
            }}
          >
            Show
          </button>
        </div>
      </div>
      <DataTable
        columns={columnsWithActions}
        data={orders}
        pagination={pagination}
      />
    </div>
  );
}