import jsPDF from 'jspdf';

interface SaddleSpec {
  optionId: number;
  optionName: string;
  displayValue: string;
}

export interface OrderData {
  orderId: number | string;
  saddle: Record<string, string>;
  saddleSpecs: SaddleSpec[];
  fitter: {
    fullName: string;
    email: string;
    [key: string]: string;
  };
  customer?: {
    name: string;
    address: string;
    city: string;
    zipcode: string;
    country: string;
    email: string;
  };
  price: {
    saddlePrice: number;
    tradeIn: number;
    deposit: number;
    discount: number;
    fittingEval: number;
    callFee: number;
    girth: number;
    additional: number;
    shipping: number;
    tax: number;
    total: number;
  };
  notes: string;
  serialno: string;
  orderDate: string;
  orderStatus: string;
  currency: string;
  history: Array<{ date: string; user: string; action: string }>;
}

// Option group mapping based on the Options table "group" column
const optionGroups: Record<string, string> = {
  'Seat Size': '',
  'Tree Size': '',
  'Billets': '',
  'Outer Reinforcement (Wear Strip)': '',
  'Stirrup Bars': 'SEAT',
  'Seat Leather': 'SEAT',
  'SEAT Option': 'SEAT',
  'Skirt': 'SEAT',
  'Welt Color': 'SEAT',
  'CANTLE Option': 'CANTLE',
  'Flap Length': 'FLAPS',
  'Knee Roll': 'FLAPS',
  'Knee Roll/ Pad Leather': 'FLAPS',
  'Flap Leather': 'FLAPS',
  'Loops': 'FLAPS',
  'Facing - Front (on FLAPS for NON Mono)': 'FLAPS',
  'Stitch Color': 'FLAPS',
  'Panel Type': 'PANEL',
  'Front Gusset': 'PANEL',
  'Rear Gusset': 'PANEL',
  'Gusset Leather': 'PANEL',
  'Panel Material': 'PANEL',
  'Panel Leather': 'PANEL',
  'Facing - Back/Rear': 'PANEL',
  'Gullet Lining': 'PANEL',
};

function formatNow(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const h = now.getHours();
  const min = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${dd}-${mm}-${yyyy} ${h12}:${min}${ampm}`;
}

function drawCheckbox(doc: jsPDF, x: number, y: number, size: number = 3) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, y - size + 0.5, size, size);
}

function addHeader(doc: jsPDF, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, 20);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'italic');
  doc.text('Order my saddle', pageWidth - 20, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
}

/**
 * Generate the "Print order" PDF matching production format.
 */
export function generateOrderPDF(orderData: OrderData, existingDoc?: jsPDF) {
  const doc = existingDoc || new jsPDF();
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  const labelX = margin + 5;
  const valueX = margin + 95; // Column for checkbox + value

  addHeader(doc, `Order status printed on ${formatNow()}`);

  let y = 40;
  const boxStartY = y;

  // --- Order ID header line ---
  y += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Order ID: NL ${orderData.orderId}`, labelX, y);
  doc.text(orderData.fitter.fullName, pageWidth / 2, y, { align: 'center' });
  doc.text(`Status: ${orderData.orderStatus}`, pageWidth - margin - 5, y, { align: 'right' });

  y += 8;
  doc.setFontSize(9);

  // --- Model, Leathertype, SerialNumber ---
  const headerFields: [string, string][] = [
    ['Model:', orderData.saddle.model || ''],
    ['Leathertype:', orderData.saddle.leatherType || ''],
    ['SerialNumber:', orderData.serialno || ''],
  ];
  for (const [label, value] of headerFields) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, labelX, y);
    doc.setFont('helvetica', 'normal');
    drawCheckbox(doc, valueX, y);
    doc.text(value, valueX + 6, y);
    y += 6;
  }

  y += 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Options', labelX, y);
  y += 7;
  doc.setFontSize(9);

  // --- Group specs ---
  const ungrouped: SaddleSpec[] = [];
  const grouped: Record<string, SaddleSpec[]> = { SEAT: [], CANTLE: [], FLAPS: [], PANEL: [] };

  for (const spec of orderData.saddleSpecs) {
    const group = optionGroups[spec.optionName];
    if (group && grouped[group]) {
      grouped[group].push(spec);
    } else {
      ungrouped.push(spec);
    }
  }

  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 30) {
      // Draw partial border on current page
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.rect(margin, boxStartY, contentWidth, y - boxStartY + 5);
      doc.addPage();
      y = 20;
    }
  }

  function renderSpec(spec: SaddleSpec, labelIndent: number) {
    const val = spec.displayValue || '';
    const maxValWidth = contentWidth - (valueX - margin) - 10;
    const lines = doc.splitTextToSize(val, maxValWidth);
    const lineHeight = lines.length * 5;
    checkPageBreak(lineHeight + 2);

    doc.setFont('helvetica', 'bold');
    doc.text(`${spec.optionName}:`, labelIndent, y);
    doc.setFont('helvetica', 'normal');
    drawCheckbox(doc, valueX, y);
    doc.text(lines, valueX + 6, y);
    y += Math.max(lineHeight, 5);
  }

  // Ungrouped specs (Seat Size, Tree Size, Billets, Outer Reinforcement)
  for (const spec of ungrouped) {
    renderSpec(spec, labelX);
  }

  // Grouped specs
  const groupOrder = ['SEAT', 'CANTLE', 'FLAPS', 'PANEL'];
  for (const groupName of groupOrder) {
    const specs = grouped[groupName];
    if (specs.length === 0) continue;

    y += 3;
    checkPageBreak(12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${groupName}:`, labelX, y);
    doc.setFontSize(9);
    y += 6;

    for (const spec of specs) {
      renderSpec(spec, labelX + 20);
    }
  }

  // --- Special Notes ---
  if (orderData.notes) {
    y += 5;
    checkPageBreak(14);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Special Notes:', labelX, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(orderData.notes, contentWidth - 10);
    checkPageBreak(noteLines.length * 5 + 2);
    doc.text(noteLines, labelX, y);
    y += noteLines.length * 5;
  }

  // Draw border box
  const boxHeight = y - boxStartY + 5;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(margin, boxStartY, contentWidth, boxHeight);

  return doc;
}

/**
 * Generate a combined PDF for multiple orders (one order per page section).
 */
export function generateBulkOrderPDF(ordersData: OrderData[]): jsPDF {
  const doc = new jsPDF();
  for (let i = 0; i < ordersData.length; i++) {
    if (i > 0) {
      doc.addPage();
    }
    generateOrderPDF(ordersData[i], doc);
  }
  return doc;
}

/**
 * Generate the "Print label" PDF - 2-up label format.
 */
export function generateLabelPDF(orderData: OrderData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  addHeader(doc, `Printed labels on ${formatNow()}`);

  const labelWidth = (pageWidth - 50) / 2;
  const labelHeight = 130;
  const startY = 35;

  const labelSpecs = [
    'Seat Size', 'Tree Size', 'Flap Length', 'Knee Roll',
    'Front Gusset', 'Rear Gusset', 'Gusset Leather', 'Panel Material',
  ];

  function drawLabel(x: number, topY: number) {
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(x, topY, labelWidth, labelHeight);

    let ly = topY + 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Order ID: ${orderData.orderId} NL`, x + 5, ly);

    ly += 8;
    doc.setFontSize(8);
    const labelCol = x + 5;
    const valCol = x + 35;

    const fields: [string, string[]][] = [
      ['Order date:', [orderData.orderDate]],
      ['Fitter:', [orderData.fitter.fullName, orderData.fitter.email]],
      ['', ['']], // spacer
      ['Status:', [orderData.orderStatus]],
      ['Model:', [orderData.saddle.model || '']],
      ['Leathertype:', [orderData.saddle.leatherType || '']],
    ];

    for (const [label, lines] of fields) {
      if (label) {
        doc.setFont('helvetica', 'bold');
        doc.text(label, labelCol, ly);
      }
      doc.setFont('helvetica', 'normal');
      for (let i = 0; i < lines.length; i++) {
        doc.text(lines[i], valCol, ly + (i * 4));
      }
      ly += lines.length * 4 + 1;
    }

    // Saddle specs
    for (const specName of labelSpecs) {
      const spec = orderData.saddleSpecs.find(s => s.optionName === specName);
      if (spec && spec.displayValue) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${spec.optionName}:`, labelCol, ly);
        doc.setFont('helvetica', 'normal');
        doc.text(spec.displayValue, valCol, ly);
        ly += 5;
      }
    }
  }

  drawLabel(20, startY);
  drawLabel(20 + labelWidth + 10, startY);

  return doc;
}
