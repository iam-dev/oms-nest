import ExcelJS from 'exceljs';
import { extractSeatSizes } from './orderProcessing';
import { getCustomerName, getFitterName, getDate, getStatus } from './orderHydration';

interface OrderExportData {
  orderId: string | number;
  orderDate: string;
  orderStatus: string;
  currency: string;
  saddleModel: string;
  saddleLeatherType: string;
  serialNumber: string;
  saddleSpecs: { optionName: string; displayValue?: string }[];
  fitter: Record<string, string>;
  customer: Record<string, string>;
  price: Record<string, number>;
  notes: string;
}

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

export async function exportOrderToXlsx(
  data: OrderExportData,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Order');
  ws.getColumn(1).width = 20;
  ws.getColumn(2).width = 40;
  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' },
  };
  const boldFont: Partial<ExcelJS.Font> = { bold: true };
  const addSection = (title: string) => {
    const row = ws.addRow([title]);
    row.font = boldFont;
    row.getCell(1).fill = headerFill;
    row.getCell(2).fill = headerFill;
  };
  const addField = (label: string, value: string | number | undefined | null) => {
    ws.addRow([label, value ?? '']);
  };
  addSection('Order Information');
  addField('Order ID', data.orderId);
  addField('Order Date', data.orderDate);
  addField('Status', data.orderStatus);
  addField('Currency', data.currency);
  ws.addRow([]);
  addSection('Saddle');
  addField('Model', data.saddleModel);
  addField('Leather Type', data.saddleLeatherType);
  if (data.serialNumber) addField('Serial Number', data.serialNumber);
  ws.addRow([]);
  if (data.saddleSpecs.length > 0) {
    addSection('Options');
    for (const spec of data.saddleSpecs) {
      addField(spec.optionName, spec.displayValue || '');
    }
    ws.addRow([]);
  }
  addSection('Fitter');
  for (const [key, value] of Object.entries(data.fitter)) {
    if (value && value !== '-') addField(key, value);
  }
  ws.addRow([]);
  addSection('Customer');
  for (const [key, value] of Object.entries(data.customer)) {
    if (value) addField(key, value);
  }
  ws.addRow([]);
  addSection('Pricing');
  for (const [key, value] of Object.entries(data.price)) {
    addField(key, Number(value).toFixed(2));
  }
  ws.addRow([]);
  if (data.notes) {
    addSection('Special Notes');
    addField('Notes', data.notes);
  }
  const today = new Date().toISOString().slice(0, 10);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `order-${data.orderId}-${today}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
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
