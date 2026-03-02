/**
 * All available order fields for custom views.
 * Each column defines a key (matching enriched order field), display label, and category.
 */

export interface SaddleSpec {
  optionId: number;
  optionName: string;
  displayValue: string;
}

export interface CustomViewColumnDef {
  key: string;
  label: string;
  category: string;
  /** Function to extract value from an enriched order row */
  getValue: (row: Record<string, unknown>) => string;
}

function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

function formatDate(val: unknown): string {
  if (!val) return '';
  const d = new Date(String(val));
  if (isNaN(d.getTime())) return str(val);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Extract a saddle spec value from the _saddleSpecs array merged into order rows.
 *  Accepts multiple possible option names to handle DB naming variations. */
function specVal(row: Record<string, unknown>, ...optionNames: string[]): string {
  const specs = row._saddleSpecs as SaddleSpec[] | undefined;
  if (!specs || !Array.isArray(specs)) return '';
  for (const name of optionNames) {
    const match = specs.find((s) => s.optionName === name);
    if (match?.displayValue) return match.displayValue;
  }
  return '';
}

export const CUSTOM_VIEW_COLUMNS: CustomViewColumnDef[] = [
  // Order Info
  { key: 'id', label: 'Order ID', category: 'Order', getValue: (r) => str(r.id || r.orderId) },
  { key: 'orderDate', label: 'Order Date', category: 'Order', getValue: (r) => formatDate(r.order_date || r.orderDate) },
  { key: 'status', label: 'Status', category: 'Order', getValue: (r) => str(r.status_name || r.statusName || r.status) },
  { key: 'paymentStatus', label: 'Payment', category: 'Order', getValue: (r) => str(r.payment_status || r.paymentStatus) },
  { key: 'urgency', label: 'Urgent', category: 'Order', getValue: (r) => (r.urgency || r.isUrgent) ? 'Yes' : 'No' },
  { key: 'sponsored', label: 'Sponsored', category: 'Order', getValue: (r) => r.sponsored ? 'Yes' : 'No' },
  { key: 'demo', label: 'Demo', category: 'Order', getValue: (r) => r.demo ? 'Yes' : 'No' },
  { key: 'repair', label: 'Repair', category: 'Order', getValue: (r) => (r.repair || r.legacyRepair) ? 'Yes' : 'No' },
  { key: 'fitterStock', label: 'Fitter Stock', category: 'Order', getValue: (r) => (r.fitter_stock || r.fitterStock) ? 'Yes' : 'No' },

  // Saddle
  { key: 'brandName', label: 'Brand', category: 'Saddle', getValue: (r) => str(r.brand_name || r.brandName) },
  { key: 'modelName', label: 'Model', category: 'Saddle', getValue: (r) => str(r.model_name || r.modelName) },
  { key: 'seatSize', label: 'Seat Size', category: 'Saddle', getValue: (r) => str(r.seat_size || r.seatSize) || specVal(r, 'Seat Size') },
  { key: 'leatherType', label: 'Leather Type', category: 'Saddle', getValue: (r) => str(r.leather_type || r.leatherType || r.leather_type_name || r.leatherTypeName) },
  { key: 'serialNumber', label: 'Serial Number', category: 'Saddle', getValue: (r) => str(r.serial_number || r.serialNumber) },

  // Customer
  { key: 'customerName', label: 'Customer', category: 'Customer', getValue: (r) => str(r.customer_name || r.customerName) },
  { key: 'customerEmail', label: 'Customer Email', category: 'Customer', getValue: (r) => str(r.customer_email || r.customerEmail) },
  { key: 'customerPhone', label: 'Customer Phone', category: 'Customer', getValue: (r) => str(r.customer_phone || r.customerPhone) },
  { key: 'customerCountry', label: 'Customer Country', category: 'Customer', getValue: (r) => str(r.customer_country || r.customerCountry) },

  // Fitter
  { key: 'fitterName', label: 'Fitter', category: 'Fitter', getValue: (r) => str(r.fitter_name || r.fitterName) },
  { key: 'fitterEmail', label: 'Fitter Email', category: 'Fitter', getValue: (r) => str(r.fitter_email || r.fitterEmail) },
  { key: 'fitterCountry', label: 'Fitter Country', category: 'Fitter', getValue: (r) => str(r.fitter_country || r.fitterCountry) },

  // Factory
  { key: 'factoryName', label: 'Factory', category: 'Factory', getValue: (r) => str(r.factory_name || r.factoryName) },

  // Pricing
  { key: 'totalPrice', label: 'Total Price', category: 'Pricing', getValue: (r) => str(r.total_price || r.totalPrice) },
  { key: 'currency', label: 'Currency', category: 'Pricing', getValue: (r) => str(r.currency) },

  // Saddle Specifications (from orders_info via _saddleSpecs)
  { key: 'seatLeather', label: 'Seat Leather', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Seat Leather') },
  { key: 'inlaid', label: 'Inlaid', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'SEAT Option', 'AVIAR - SEAT Option') },
  { key: 'skirt', label: 'Skirt', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Skirt') },
  { key: 'gulletLeather', label: 'Gullet Leather', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Gullet Lining') },
  { key: 'welt', label: 'Welt', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Welt Color') },
  { key: 'cantle', label: 'Cantle', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'CANTLE Option', 'AVIAR - CANTLE Option') },
  { key: 'stitch', label: 'Stitch', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Stitch Color') },
  { key: 'flapLeather', label: 'Flap Leather', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Flap Leather') },
  { key: 'flapLength', label: 'Flap Length', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Flap Length') },
  { key: 'flapRollType', label: 'Flap Roll Type', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Knee Roll') },
  { key: 'rollLeather', label: 'Roll Leather', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Knee Roll/ Pad Leather', 'AVIAR Knee Roll Leather') },
  { key: 'loops', label: 'Loops', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Loops') },
  { key: 'frontFacing', label: 'Front Facing', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Facing - Front (on FLAPS for NON Mono)', 'AVIAR Front FACING(front/flap)') },
  { key: 'rearFacing', label: 'Rear Facing', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Facing - Back/Rear', 'AVIAR Back FACING') },
  { key: 'backFacing', label: 'Back Facing', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Facing - Back/Rear', 'AVIAR Back FACING') },
  { key: 'gussetLeather', label: 'Gusset Leather', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Gusset Leather') },
  { key: 'frontGusset', label: 'Front Gusset', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Front Gusset') },
  { key: 'backGusset', label: 'Back Gusset', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Rear Gusset') },
  { key: 'seatOptions', label: 'Seat Options', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'SEAT Option', 'AVIAR - SEAT Option') },
  { key: 'padRollType', label: 'Pad Roll Type', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Knee Roll') },
  { key: 'sweatFlap', label: 'Sweat Flap', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Calf / Rear Roll') },
  { key: 'panelLeather', label: 'Panel Leather', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Panel Leather') },
  { key: 'panelMaterial', label: 'Panel Material', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Panel Material') },
  { key: 'skirtBack', label: 'Skirt Back', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Skirt') },
  { key: 'padUnderPadTop', label: 'Pad/Under-Pad/Top', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Flap Position / FWD') },
  { key: 'liningFoam', label: 'Lining/Foam', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Panel Material') },
  { key: 'bars', label: 'Bars', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Stirrup Bars') },
  { key: 'treeSize', label: 'Tree Size', category: 'Saddle Specifications', getValue: (r) => specVal(r, 'Tree Size') },

  // Notes
  { key: 'notes', label: 'Notes', category: 'Other', getValue: (r) => str(r.notes || r.order_notes || r.orderNotes) },
  { key: 'internalNotes', label: 'Internal Notes', category: 'Other', getValue: (r) => str(r.internal_notes || r.internalNotes) },
];

/** Group columns by category for the column manager UI */
export function getColumnsByCategory(): Record<string, CustomViewColumnDef[]> {
  const grouped: Record<string, CustomViewColumnDef[]> = {};
  for (const col of CUSTOM_VIEW_COLUMNS) {
    if (!grouped[col.category]) grouped[col.category] = [];
    grouped[col.category].push(col);
  }
  return grouped;
}

/** Get the default column config (all visible, in catalog order) */
export function getDefaultColumnConfig() {
  return CUSTOM_VIEW_COLUMNS.map((col, i) => ({
    key: col.key,
    label: col.label,
    visible: true,
    order: i,
  }));
}
