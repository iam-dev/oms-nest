'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportCustomViewXlsx } from '@/utils/exportCustomViewXlsx';
import type { ColumnConfig } from '@/services/customOrderViews';
import type { CellOverride } from '@/services/customOrderCellOverrides';

interface ExportButtonProps {
  columns: ColumnConfig[];
  orders: Record<string, unknown>[];
  selectedOrderIds: Set<number>;
  overrides: CellOverride[];
  viewName?: string;
}

export function ExportButton({
  columns,
  orders,
  selectedOrderIds,
  overrides,
  viewName,
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    const ordersToExport = selectedOrderIds.size > 0
      ? orders.filter((o) => selectedOrderIds.has(Number(o.id || o.orderId)))
      : orders;

    if (ordersToExport.length === 0) return;

    setExporting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const safeName = (viewName || 'custom-view').replace(/[^a-zA-Z0-9-_]/g, '_');
      await exportCustomViewXlsx({
        columns,
        orders: ordersToExport,
        overrides,
        fileName: `${safeName}-${today}.xlsx`,
      });
    } finally {
      setExporting(false);
    }
  };

  const count = selectedOrderIds.size > 0 ? selectedOrderIds.size : orders.length;

  return (
    <Button
      onClick={handleExport}
      disabled={exporting || orders.length === 0}
      variant="outline"
    >
      <Download className="h-4 w-4 mr-1" />
      {exporting ? 'Exporting...' : `Export ${count} order${count !== 1 ? 's' : ''}`}
    </Button>
  );
}
