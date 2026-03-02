'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportCustomViewXlsx, exportGroupXlsx } from '@/utils/exportCustomViewXlsx';
import type { ColumnConfig, ColumnGroupConfig, CustomOrderView } from '@/services/customOrderViews';
import type { CellOverride } from '@/services/customOrderCellOverrides';

interface ExportButtonProps {
  columns: ColumnConfig[];
  columnGroups?: ColumnGroupConfig[];
  orders: Record<string, unknown>[];
  selectedOrderIds: Set<number>;
  overrides: CellOverride[];
  viewName?: string;
  groupViews?: CustomOrderView[];
  groupName?: string;
}

export function ExportButton({
  columns,
  columnGroups,
  orders,
  selectedOrderIds,
  overrides,
  viewName,
  groupViews,
  groupName,
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    const ordersToExport = selectedOrderIds.size > 0
      ? orders.filter((o) => selectedOrderIds.has(Number(o.id || o.orderId)))
      : orders;

    if (ordersToExport.length === 0) return;

    setExporting(true);
    try {
      if (groupViews && groupViews.length > 0 && groupName) {
        // Multi-tab export: one worksheet per tab
        const tabs = groupViews.map((v) => ({
          name: v.name,
          columns: v.columns,
          columnGroups: v.columnGroups,
        }));
        await exportGroupXlsx(tabs, ordersToExport, overrides, groupName);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const safeName = (viewName || 'custom-view').replace(/[^a-zA-Z0-9-_]/g, '_');
        await exportCustomViewXlsx({
          columns,
          columnGroups,
          orders: ordersToExport,
          overrides,
          viewName,
          fileName: `${safeName}-${today}.xlsx`,
        });
      }
    } finally {
      setExporting(false);
    }
  };

  const count = selectedOrderIds.size > 0 ? selectedOrderIds.size : orders.length;
  const isGroupExport = groupViews && groupViews.length > 0;

  return (
    <Button
      onClick={handleExport}
      disabled={exporting || orders.length === 0}
      className={isGroupExport ? 'bg-primary text-white hover:bg-primary/90' : ''}
      variant={isGroupExport ? 'default' : 'outline'}
    >
      <Download className="h-4 w-4 mr-1" />
      {exporting
        ? 'Exporting...'
        : isGroupExport
          ? `Export all tabs (${count} orders)`
          : `Export ${count} order${count !== 1 ? 's' : ''}`}
    </Button>
  );
}
