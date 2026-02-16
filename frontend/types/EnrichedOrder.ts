// TypeScript interface for Enriched Order, matching the backend EnrichedOrder entity

export interface EnrichedOrder {
  id: number;
  customerId?: number;
  fitterId?: number;
  factoryId?: number;
  paymentTime?: string | null;
  orderTime?: string | null;
  lastSeenFitter?: string | null;
  lastSeenSupplier?: string | null;
  lastSeenAdmin?: string | null;
  name?: string;
  reference?: string;
  fitterReference?: string;
  shipmentTarget?: string;
  urgent?: boolean;
  legacyRepair?: boolean;
  repair?: boolean;
  fitterStock?: boolean;
  demo?: boolean;
  sponsored?: boolean;
  orderStatus?: string;
  payment?: string;
  orderAddress?: string;
  orderCity?: string;
  orderZipcode?: string;
  orderState?: string;
  orderCellNo?: string;
  orderCountry?: string;
  currency?: string;
  seatSizes?: string[];

  // Customer fields
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerCity?: string;
  customerZipcode?: string;
  customerState?: string;
  customerCellNo?: string;
  customerPhoneNo?: string;
  customerCountry?: string;

  // Fitter fields
  fitterName?: string;
  fitterUsername?: string;
  fitterEmail?: string;
  fitterAddress?: string;
  fitterCity?: string;
  fitterZipcode?: string;
  fitterState?: string;
  fitterCellNo?: string;
  fitterPhoneNo?: string;
  fitterCountry?: string;

  // Supplier fields
  supplierName?: string;
  supplierUsername?: string;
  supplierEmail?: string;
  supplierAddress?: string;
  supplierCity?: string;
  supplierZipcode?: string;
  supplierState?: string;
  supplierCellNo?: string;
  supplierPhoneNo?: string;
  supplierCountry?: string;
}
