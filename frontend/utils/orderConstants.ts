// Shared constants for Orders/Reports/Dashboard

// Minimum valid order ID — filters out noise numbers (row indices, small integers) from Excel imports
export const MIN_ORDER_ID = 100;

export const seatSizes = ['17', '17.5', '18'];

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

// Legacy statuses for compatibility
export const statuses = ['Ordered', 'In Production P1', 'Approved'];
