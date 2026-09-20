// Shared constants for Orders/Reports/Dashboard

// Minimum valid order ID — filters out noise numbers (row indices, small integers) from Excel imports
export const MIN_ORDER_ID = 100;

export const seatSizes = ['15', '15.5', '16', '16.5', '17', '17.5', '18', '18.5', '19'];

// Order status values - must match database statuses table names exactly
export const orderStatuses = [
  'Unordered',
  'Ordered',
  'Approved',
  'In Production P1',
  'In Production P2',
  'In Production P3',
  'On hold',
  'On trial',
  'Shipped to Fitter',
  'Shipped to Customer',
  'Completed sale',
  'Changed',
  'Awaiting Client Confirmation',
  'Inventory Aiken',
  'Inventory UK',
  'Inventory HOLLAND'
];

// Statuses where fitters are NOT allowed to edit orders: everything an order
// can be in once it has been approved. Admins and Supervisors can edit orders
// in any status. Keep in step with FITTER_LOCKED_STATUS_IDS in
// backend/src/enriched-orders/fitter-order-lock.ts (the backend is authoritative).
export const FITTER_RESTRICTED_STATUSES = [
  'Approved',
  'In Production P1',
  'In Production P2',
  'In Production P3',
  'On hold',
  'On trial',
  'Shipped to Fitter',
  'Shipped to Customer',
  'Completed sale',
  'Inventory Aiken',
  'Inventory UK',
  'Inventory HOLLAND',
];

// Legacy statuses for compatibility
export const statuses = ['Ordered', 'In Production P1', 'Approved'];
