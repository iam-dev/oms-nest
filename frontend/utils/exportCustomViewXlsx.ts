import ExcelJS from 'exceljs';
import { ColumnConfig, ColumnGroupConfig } from '@/services/customOrderViews';
import { CellOverride } from '@/services/customOrderCellOverrides';
import { CUSTOM_VIEW_COLUMNS } from './customViewColumns';
import { toSeatSizeCellValue } from './exportXlsx';

interface ExportOptions {
  columns: ColumnConfig[];
  columnGroups?: ColumnGroupConfig[];
  orders: Record<string, unknown>[];
  overrides: CellOverride[];
  viewName?: string;
  fileName?: string;
}

/**
 * Build group header spans for visible columns.
 * Returns array of { label, startCol (1-based), endCol (1-based) } for groups
 * that have at least one visible column.
 */
function buildGroupSpans(
  visibleColumns: ColumnConfig[],
  columnGroups: ColumnGroupConfig[],
): Array<{ label: string; startCol: number; endCol: number }> {
  const keyToIndex = new Map<string, number>();
  visibleColumns.forEach((col, i) => keyToIndex.set(col.key, i + 1)); // 1-based

  const spans: Array<{ label: string; startCol: number; endCol: number }> = [];

  for (const group of columnGroups) {
    const indices = group.columnKeys
      .map((k) => keyToIndex.get(k))
      .filter((i): i is number => i !== undefined);

    if (indices.length === 0) continue;

    const startCol = Math.min(...indices);
    const endCol = Math.max(...indices);
    spans.push({ label: group.label, startCol, endCol });
  }

  return spans;
}

/**
 * Export orders to Excel with custom column visibility, cell overrides,
 * and optional column group headers matching factory job sheet format.
 */
export async function exportCustomViewXlsx({
  columns,
  columnGroups,
  orders,
  overrides,
  viewName,
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

  const hasGroups = columnGroups && columnGroups.length > 0;
  const groupSpans = hasGroups ? buildGroupSpans(visibleColumns, columnGroups) : [];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(viewName || 'Custom View');

  // Manually set column widths (don't use ws.columns with header — we build rows manually)
  visibleColumns.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.max(col.label.length + 4, 15);
  });

  let currentRow = 1;

  // Row 1: DATE label + date value + group headers (if groups exist)
  if (hasGroups) {
    const row1 = ws.getRow(currentRow);
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    row1.getCell(1).value = `DATE: ${today}`;
    row1.getCell(1).font = { bold: true, size: 11 };

    // Merge group header cells
    for (const span of groupSpans) {
      const cell = row1.getCell(span.startCol);
      cell.value = span.label;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF450A0A' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      if (span.endCol > span.startCol) {
        ws.mergeCells(currentRow, span.startCol, currentRow, span.endCol);
      }
    }

    row1.height = 22;
    currentRow++;

    // Row 2: View name title
    const row2 = ws.getRow(currentRow);
    row2.getCell(1).value = viewName || 'Custom View';
    row2.getCell(1).font = { bold: true, size: 12 };
    row2.height = 20;
    currentRow++;
  }

  // Column headers row
  const headerRow = ws.getRow(currentRow);
  visibleColumns.forEach((col, i) => {
    headerRow.getCell(i + 1).value = col.label;
  });
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  currentRow++;

  // Data rows
  for (const order of orders) {
    const orderId = order.id || order.orderId;
    const row = ws.getRow(currentRow);
    visibleColumns.forEach((col, i) => {
      // Check for override first
      const overrideKey = `${orderId}:${col.key}`;
      let value: string | number;
      if (overrideMap.has(overrideKey)) {
        value = overrideMap.get(overrideKey)!;
      } else {
        const colDef = colDefMap.get(col.key);
        value = colDef ? colDef.getValue(order) : '';
      }
      if (col.key === 'seatSize' && typeof value === 'string') {
        value = toSeatSizeCellValue(value);
      }
      row.getCell(i + 1).value = value;
    });
    currentRow++;
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

  // Add vertical border lines at group boundaries (left border on first column of each group)
  if (hasGroups) {
    const groupStartCols = new Set<number>();
    for (const span of groupSpans) {
      groupStartCols.add(span.startCol);
    }

    const thinBorder: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } };
    const totalRows = ws.rowCount;
    for (const col of groupStartCols) {
      for (let r = 1; r <= totalRows; r++) {
        const cell = ws.getRow(r).getCell(col);
        cell.border = { ...cell.border, left: thinBorder };
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer, fileName || `custom-view-${today}.xlsx`);
}

/** Trigger browser download from an ArrayBuffer. */
function downloadBuffer(buffer: ExcelJS.Buffer, fileName: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Add a single worksheet to a workbook for a given tab's column config.
 * Reuses the same layout logic as exportCustomViewXlsx.
 */
function addWorksheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  columns: ColumnConfig[],
  columnGroups: ColumnGroupConfig[] | undefined,
  orders: Record<string, unknown>[],
  overrideMap: Map<string, string>,
): void {
  const visibleColumns = columns
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);

  const colDefMap = new Map(CUSTOM_VIEW_COLUMNS.map((c) => [c.key, c]));
  const hasGroups = columnGroups && columnGroups.length > 0;
  const groupSpans = hasGroups ? buildGroupSpans(visibleColumns, columnGroups) : [];

  const ws = wb.addWorksheet(sheetName);

  visibleColumns.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.max(col.label.length + 4, 15);
  });

  let currentRow = 1;

  if (hasGroups) {
    const row1 = ws.getRow(currentRow);
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    row1.getCell(1).value = `DATE: ${today}`;
    row1.getCell(1).font = { bold: true, size: 11 };

    for (const span of groupSpans) {
      const cell = row1.getCell(span.startCol);
      cell.value = span.label;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF450A0A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (span.endCol > span.startCol) {
        ws.mergeCells(currentRow, span.startCol, currentRow, span.endCol);
      }
    }
    row1.height = 22;
    currentRow++;

    const row2 = ws.getRow(currentRow);
    row2.getCell(1).value = sheetName;
    row2.getCell(1).font = { bold: true, size: 12 };
    row2.height = 20;
    currentRow++;
  }

  const headerRow = ws.getRow(currentRow);
  visibleColumns.forEach((col, i) => {
    headerRow.getCell(i + 1).value = col.label;
  });
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  currentRow++;

  for (const order of orders) {
    const orderId = order.id || order.orderId;
    const row = ws.getRow(currentRow);
    visibleColumns.forEach((col, i) => {
      const overrideKey = `${orderId}:${col.key}`;
      let value: string | number;
      if (overrideMap.has(overrideKey)) {
        value = overrideMap.get(overrideKey)!;
      } else {
        const colDef = colDefMap.get(col.key);
        value = colDef ? colDef.getValue(order) : '';
      }
      if (col.key === 'seatSize' && typeof value === 'string') {
        value = toSeatSizeCellValue(value);
      }
      row.getCell(i + 1).value = value;
    });
    currentRow++;
  }

  for (let i = 0; i < visibleColumns.length; i++) {
    const column = ws.getColumn(i + 1);
    let maxLen = visibleColumns[i].label.length;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value || '').length;
      if (len > maxLen) maxLen = len;
    });
    column.width = Math.min(maxLen + 2, 50);
  }

  if (hasGroups) {
    const groupStartCols = new Set<number>();
    for (const span of groupSpans) {
      groupStartCols.add(span.startCol);
    }
    const thinBorder: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } };
    const totalRows = ws.rowCount;
    for (const col of groupStartCols) {
      for (let r = 1; r <= totalRows; r++) {
        const cell = ws.getRow(r).getCell(col);
        cell.border = { ...cell.border, left: thinBorder };
      }
    }
  }
}

interface GroupExportTab {
  name: string;
  columns: ColumnConfig[];
  columnGroups?: ColumnGroupConfig[];
}

/**
 * Export all tabs in a group to a single Excel file, one worksheet per tab.
 */
export async function exportGroupXlsx(
  tabs: GroupExportTab[],
  orders: Record<string, unknown>[],
  overrides: CellOverride[],
  groupName: string,
): Promise<void> {
  const overrideMap = new Map<string, string>();
  for (const o of overrides) {
    overrideMap.set(`${o.orderId}:${o.columnKey}`, o.overrideValue);
  }

  const wb = new ExcelJS.Workbook();

  for (const tab of tabs) {
    addWorksheet(wb, tab.name, tab.columns, tab.columnGroups, orders, overrideMap);
  }

  const today = new Date().toISOString().slice(0, 10);
  const safeName = groupName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer, `${safeName}-${today}.xlsx`);
}
