// Comprehensive Order Types
// Based on the old Breeze UI implementation and API structure

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
  createdAt?: string;
  updatedAt?: string;
}

export interface Fitter {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
  isActive?: boolean;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Model {
  id: number;
  name: string;
  brandId?: number;
  brand?: Brand;
  status: 'ACTIVE' | 'INACTIVE';
  basePrice?: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Brand {
  id: number;
  name: string;
  sequence?: number;
  active?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeatherType {
  id: number;
  name: string;
  code?: string;
  color?: string;
  price?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OptionItem {
  id: number;
  name: string;
  code?: string;
  price?: number;
  isActive?: boolean;
  optionId?: number;
  option?: Option;
  createdAt?: string;
  updatedAt?: string;
}

export interface Option {
  id: number;
  name: string;
  group?: string;
  isRequired?: boolean;
  isActive?: boolean;
  items?: OptionItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductSaddleItem {
  id: number;
  productSaddleId: number;
  optionItemId?: number;
  optionItem?: OptionItem;
  quantity?: number;
  price?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductSaddleExtra {
  id: number;
  productSaddleId: number;
  extraId?: number;
  extra?: Extra;
  quantity?: number;
  price?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Extra {
  id: number;
  name: string;
  code?: string;
  price?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductSaddle {
  id: number;
  modelId?: number;
  model?: Model;
  fitterId?: number;
  fitter?: Fitter;
  leatherTypeId?: number;
  leatherType?: LeatherType;
  seatSize?: string;
  treeSize?: string;
  flapLength?: string;
  configuration?: Record<string, unknown>;
  basePrice?: number;
  totalPrice?: number;
  items?: ProductSaddleItem[];
  extras?: ProductSaddleExtra[];
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderLine {
  id: number;
  orderId: number;
  productSaddleId?: number;
  productSaddle?: ProductSaddle;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  discount?: number;
  reference?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: number;
  orderId: number;
  userId?: number;
  user?: User;
  content: string;
  isInternal?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PricingDetails {
  subtotal?: number;
  discount?: number;
  tax?: number;
  shipping?: number;
  total?: number;
  currency?: string;
}

export interface ComprehensiveOrder {
  id: number;
  reference?: string;
  status: OrderStatus;

  // Customer information (INTEGER ID)
  customerId?: number;
  customer?: Customer;
  customerAddress?: Address;

  // Fitter information (INTEGER ID)
  fitterId?: number;
  fitter?: Fitter;
  fitterAddress?: Address;

  // Supplier/Factory information (INTEGER ID)
  factoryId?: number;
  factory?: Supplier;
  
  // Shipping information
  shippingAddress?: Address;
  shippingMethod?: string;
  shippingCost?: number;
  
  // Order details
  orderLines: OrderLine[];
  comments: Comment[];
  
  // Pricing
  pricing: PricingDetails;
  
  // Flags and settings
  isUrgent?: boolean;
  isStock?: boolean;
  isDemo?: boolean;
  isSponsored?: boolean;
  isRepair?: boolean;
  
  // Dates
  orderDate?: string;
  requestedDeliveryDate?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  
  // Metadata
  notes?: string;
  internalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: User;
  updatedBy?: User;
}

export type OrderStatus = 
  | 'DRAFT'
  | 'UNORDERED'
  | 'ORDERED'
  | 'CHANGED'
  | 'APPROVED'
  | 'IN_PRODUCTION_P1'
  | 'IN_PRODUCTION_P2'
  | 'IN_PRODUCTION_P3'
  | 'SHIPPED_TO_FITTER'
  | 'SHIPPED_TO_CUSTOMER'
  | 'INVENTORY'
  | 'ON_HOLD'
  | 'ON_TRIAL'
  | 'COMPLETED_SALE'
  | 'CANCELLED';

export interface ModelItemContainer {
  id: number;
  modelId: number;
  optionItemId: number;
  optionItem?: OptionItem;
  isRequired?: boolean;
  isDefault?: boolean;
  price?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModelLeatherPriceContainer {
  id: number;
  modelId: number;
  leatherTypeId: number;
  leatherType?: LeatherType;
  price: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Preset {
  id: number;
  name: string;
  modelId?: number;
  model?: Model;
  configuration?: Record<string, unknown>;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EnforcedNormalOptionItem {
  id: number;
  optionItemId: number;
  optionItem?: OptionItem;
  modelId?: number;
  model?: Model;
  isEnforced: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Form state interfaces for editing
export interface OrderEditFormState {
  // Step 1: Products and pricing
  orderLines: OrderLine[];
  pricing: PricingDetails;
  
  // Step 2: Customer and shipping
  customer?: Customer;
  customerAddress?: Address;
  fitter?: Fitter;
  fitterAddress?: Address;
  shippingAddress?: Address;
  shippingMethod?: string;
  
  // Step 3: Order settings
  reference?: string;
  status: OrderStatus;
  isUrgent?: boolean;
  isStock?: boolean;
  isDemo?: boolean;
  isSponsored?: boolean;
  isRepair?: boolean;
  notes?: string;
  internalNotes?: string;
  requestedDeliveryDate?: string;
}

export interface ProductSaddleEditFormState {
  modelId?: number;
  fitterId?: number;
  leatherTypeId?: number;
  seatSize?: string;
  treeSize?: string;
  flapLength?: string;
  selectedItems: ProductSaddleItem[];
  selectedExtras: ProductSaddleExtra[];
  configuration: any;
  basePrice: number;
  totalPrice: number;
}

// API response types
export interface ComprehensiveOrderData {
  order: ComprehensiveOrder;
  orderLines: OrderLine[];
  comments: Comment[];
  options: Option[];
  productSaddleExtras: ProductSaddleExtra[];
  productSaddleItems: ProductSaddleItem[];
  modelItems: ModelItemContainer[];
  modelLeatherPrices: ModelLeatherPriceContainer[];
  fitters: Fitter[];
  models: Model[];
  presets: Preset[];
  customers: Customer[];
  suppliers: Supplier[];
  leatherTypes: LeatherType[];
  productSaddles: ProductSaddle[];
}

// Search result types
export interface CustomerSearchResult {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
}

export interface FitterSearchResult {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
}