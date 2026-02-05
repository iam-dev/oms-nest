import ExcelJS from 'exceljs';
import { extractSeatSizes } from './orderProcessing';
import { getCustomerName, getFitterName, getDate, getStatus } from './orderHydration';

function formatExportDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = String(d.getFullYear()).slice(-2);
  return `${month} ${day}, '${year}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exportToXlsx(orders: any[]): Promise<void> {
  const columns = ['ID', 'Brand', 'Saddle', 'Seat Size', 'Customer', 'Fitter', 'Date', 'Payment', 'Status', 'Options'];

  const rows = orders.map(order => {
    const brand = order.brand_name || order.brandName || '';
    const model = order.model_name || order.modelName || '';
    const saddle = [brand, model].filter(Boolean).join(' - ');

    return [
      order.orderId || order.id || '',
      brand,
      saddle,
      extractSeatSizes(order),
      getCustomerName(order),
      getFitterName(order),
      formatExportDate(getDate(order)),
      order.paymentStatus || order.payment_status || '',
      getStatus(order) || '',
      (() => {
        const opts = order.options || order.order_options || [];
        if (Array.isArray(opts)) {
          return opts.map((o: any) => (typeof o === 'string' ? o : o?.name || o?.label || '')).filter(Boolean).join(', ');
        }
        return '';
      })(),
    ];
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');

  ws.columns = columns.map(header => {
    const maxLen = Math.max(
      header.length,
      ...rows.map(r => String(r[columns.indexOf(header)] || '').length)
    );
    return { header, width: Math.min(maxLen + 2, 40) };
  });

  rows.forEach(row => ws.addRow(row));

  const today = new Date().toISOString().slice(0, 10);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report-${today}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
