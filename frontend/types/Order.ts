import type { Customer, Fitter, Supplier } from './ComprehensiveOrder';

export interface SaddleSpecifications {
  brand?: string;
  model?: string;
  seatSize?: string;
  flaps?: string;
  leatherType?: string;
  color?: string;
  [key: string]: string | undefined;
}

export interface Order {
  // Core identifiers - matching backend OrderDto (INTEGER for orders)
  id: number;
  customerId: number;
  orderNumber: string;

  // Status and priority - matching backend
  status: string;
  priority: string;

  // Relationships - matching backend (INTEGER IDs)
  fitterId: number | null;
  factoryId: number | null;

  // Saddle configuration - matching backend saddleSpecifications
  saddleSpecifications: SaddleSpecifications;

  // Instructions and notes
  specialInstructions: string | null;

  // Dates - matching backend
  estimatedDeliveryDate: Date | null;
  actualDeliveryDate: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Financial - matching backend
  totalAmount: number;
  depositPaid: number;
  balanceOwing: number;
  paymentPercentage?: number;

  // Measurements - matching backend
  measurements: Record<string, string | number> | null;

  // Flags - matching backend
  isUrgent: boolean;
  isOverdue?: boolean;
  daysUntilDelivery?: number | null;

  // Seat sizes - matching backend
  seatSizes?: string[] | null;

  // Customer name for search optimization
  customerName?: string | null;

  // Saddle type/model ID for filtering
  saddleId?: string | null;

  // Computed/convenience fields for display
  saddle?: string;
  seatSize?: string | string[];
  customer?: string | Customer;
  fitter?: string | Fitter;
  factory?: string | Supplier;
  date?: string;
  orderTime?: string;
  orderStatus?: string;
  urgent?: boolean;
  reference?: string;

  [key: string]: unknown;
}
