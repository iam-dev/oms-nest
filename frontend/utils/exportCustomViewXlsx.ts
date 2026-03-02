import ExcelJS from 'exceljs';
import { ColumnConfig } from '@/services/customOrderViews';
import { CellOverride } from '@/services/customOrderCellOverrides';
import { CUSTOM_VIEW_COLUMNS } from './customViewColumns';

interface ExportOptions {
  columns: ColumnConfig[];
  orders: Record<string, unknown>[];
  overrides: CellOverride[];
  fileName?: string;
}

/**
 * Export orders to Excel with custom column visibility and cell overrides applied.
 */
export async function exportCustomViewXlsx({
  columns,
  orders,
  overrides,
  fileName,
}: ExportOptions): Promise<void> {
  // Build override lookup: `${orderId}:${columnKey}` -> overrideValue
  const overrideMap = new Map<string, string>();
  for (const o of overrides) {
    overrideMap.set(`${o.orderId}:${o.columnKey}`, o.overrideValue);
  }

  // Get visible columns sorted by order
  const visibleColumns = columns
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);

  // Build column def lookup
  const colDefMap = new Map(CUSTOM_VIEW_COLUMNS.map((c) => [c.key, c]));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Custom View');

  // Set headers
  ws.columns = visibleColumns.map((col) => ({
    header: col.label,
    width: Math.max(col.label.length + 4, 15),
  }));

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add data rows
  for (const order of orders) {
    const orderId = order.id || order.orderId;
    const rowValues = visibleColumns.map((col) => {
      // Check for override first
      const overrideKey = `${orderId}:${col.key}`;
      if (overrideMap.has(overrideKey)) {
        return overrideMap.get(overrideKey)!;
      }
      // Fall back to actual value
      const colDef = colDefMap.get(col.key);
      if (colDef) {
        return colDef.getValue(order);
      }
      return '';
    });
    ws.addRow(rowValues);
  }

  // Auto-size columns based on content
  for (let i = 0; i < visibleColumns.length; i++) {
    const column = ws.getColumn(i + 1);
    let maxLen = visibleColumns[i].label.length;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value || '').length;
      if (len > maxLen) maxLen = len;
    });
    column.width = Math.min(maxLen + 2, 50);
  }

  const today = new Date().toISOString().slice(0, 10);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `custom-view-${today}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
