import { UserRole } from '@/types/Role';
import { FITTER_RESTRICTED_STATUSES } from '@/utils/orderConstants';

/**
 * Screen/Feature permissions configuration
 * Define which roles can access each screen or feature
 */
export const SCREEN_PERMISSIONS = {
  // Main Navigation
  DASHBOARD: [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR],
  ORDERS: [UserRole.USER, UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
  CUSTOMERS: [UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
  FITTERS: [UserRole.ADMIN, UserRole.SUPERVISOR],
  REPORTS: [UserRole.ADMIN, UserRole.SUPERVISOR],
  MY_VIEWS: [UserRole.ADMIN, UserRole.SUPERVISOR],
  
  // Saddle Modeling
  SADDLE_MODELING: [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
  BRANDS: [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
  MODELS: [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
  LEATHER_TYPES: [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
  OPTIONS: [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
  EXTRAS: [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
  PRESETS: [UserRole.USER, UserRole.ADMIN, UserRole.SUPERVISOR],
  SUPPLIERS: [UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR],
  
  // Account Management - SUPERVISOR only
  ACCOUNT_MANAGEMENT: [UserRole.SUPERVISOR],
  USER_MANAGEMENT: [UserRole.SUPERVISOR],
  WAREHOUSE_MANAGEMENT: [UserRole.SUPERVISOR],
  USER_PERMISSIONS_VIEW: [UserRole.SUPERVISOR],
  ACCESS_FILTER_GROUPS: [UserRole.SUPERVISOR],
  WAREHOUSES: [UserRole.SUPERVISOR],
  COUNTRY_MANAGERS: [UserRole.SUPERVISOR],
  SUPPLIERS_MANAGEMENT: [UserRole.SUPERVISOR],
  
  // Order Actions
  ORDER_CREATE: [UserRole.USER, UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
  ORDER_EDIT: [UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
  ORDER_DELETE: [UserRole.ADMIN, UserRole.SUPERVISOR],
  ORDER_APPROVE: [UserRole.ADMIN, UserRole.SUPERVISOR],
  ORDER_VIEW: [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR],
  
  // Customer Actions
  CUSTOMER_CREATE: [UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
  CUSTOMER_EDIT: [UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
  CUSTOMER_DELETE: [UserRole.ADMIN, UserRole.SUPERVISOR],
  
  // Fitter Actions
  FITTER_CREATE: [UserRole.ADMIN, UserRole.SUPERVISOR],
  FITTER_EDIT: [UserRole.ADMIN, UserRole.SUPERVISOR],
  FITTER_DELETE: [UserRole.ADMIN, UserRole.SUPERVISOR],
  
  // Supplier Actions
  SUPPLIER_CREATE: [UserRole.ADMIN, UserRole.SUPERVISOR],
  SUPPLIER_EDIT: [UserRole.ADMIN, UserRole.SUPERVISOR],
  SUPPLIER_DELETE: [UserRole.ADMIN, UserRole.SUPERVISOR],

  // Saddle Stock Management
  REPAIRS: [UserRole.USER, UserRole.FITTER, UserRole.ADMIN, UserRole.SUPERVISOR],
  MY_SADDLE_STOCK: [UserRole.FITTER],
  AVAILABLE_SADDLE_STOCK: [UserRole.FITTER],
  ALL_SADDLE_STOCK: [UserRole.ADMIN, UserRole.SUPERVISOR],
  
  // User Actions - SUPERVISOR only
  USER_CREATE: [UserRole.SUPERVISOR],
  USER_EDIT: [UserRole.SUPERVISOR],
  USER_DELETE: [UserRole.SUPERVISOR],
  USER_VIEW: [UserRole.SUPERVISOR],

  // Warehouse Actions - SUPERVISOR only
  WAREHOUSE_CREATE: [UserRole.SUPERVISOR],
  WAREHOUSE_EDIT: [UserRole.SUPERVISOR],
  WAREHOUSE_DELETE: [UserRole.SUPERVISOR],
  WAREHOUSE_VIEW: [UserRole.SUPERVISOR],
} as const satisfies Record<string, readonly UserRole[]>;

/**
 * Screen constants for easier referencing in tests and components
 */
export const Screen = {
  DASHBOARD: 'DASHBOARD',
  ORDERS: 'ORDERS',
  CUSTOMERS: 'CUSTOMERS',
  FITTERS: 'FITTERS',
  REPORTS: 'REPORTS',
  SADDLE_MODELING: 'SADDLE_MODELING',
  BRANDS: 'BRANDS',
  MODELS: 'MODELS',
  LEATHER_TYPES: 'LEATHER_TYPES',
  OPTIONS: 'OPTIONS',
  EXTRAS: 'EXTRAS',
  PRESETS: 'PRESETS',
  SUPPLIERS: 'SUPPLIERS',
  ORDER_CREATE: 'ORDER_CREATE',
  ORDER_EDIT: 'ORDER_EDIT',
  ORDER_DELETE: 'ORDER_DELETE',
  ORDER_APPROVE: 'ORDER_APPROVE',
  ORDER_VIEW: 'ORDER_VIEW',
  CUSTOMER_CREATE: 'CUSTOMER_CREATE',
  CUSTOMER_EDIT: 'CUSTOMER_EDIT',
  CUSTOMER_DELETE: 'CUSTOMER_DELETE',
} as const;

/**
 * Permission constants for actions
 */
export const Permission = {
  VIEW: 'VIEW',
  CREATE: 'CREATE',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
} as const;

/**
 * Check if a user role has permission to access a screen/feature.
 *
 * FE-034: SUPERVISOR is strictly superior to ADMIN — it inherits every screen
 * that ADMIN can access, plus its own exclusive screens (USER_*, WAREHOUSE_*).
 * SUPERVISOR does NOT inherit FITTER-only screens (e.g. MY_SADDLE_STOCK) because
 * those represent a domain-specific role, not a rank.
 */
export function hasScreenPermission(
  userRole: UserRole | null,
  screen: keyof typeof SCREEN_PERMISSIONS
): boolean {
  if (!userRole || !screen) return false;

  const allowedRoles = SCREEN_PERMISSIONS[screen] as readonly UserRole[];
  if (!allowedRoles) return false;

  // FE-034: SUPERVISOR inherits all ADMIN permissions.
  // Whenever the permission list contains any role besides FITTER-only roles,
  // SUPERVISOR has access if it would normally have it as SUPERVISOR or ADMIN.
  if (userRole === UserRole.SUPERVISOR) {
    return allowedRoles.includes(UserRole.SUPERVISOR) || allowedRoles.includes(UserRole.ADMIN);
  }

  // ADMIN can access most things except SUPERVISOR-only and FITTER/SUPPLIER-specific features
  if (userRole === UserRole.ADMIN) {
    return allowedRoles.includes(UserRole.ADMIN);
  }

  return allowedRoles.includes(userRole);
}

/**
 * Check if a user role can perform a specific action on a screen/feature
 */
export function canPerformAction(
  userRole: UserRole | null,
  screen: string,
  action: string
): boolean {
  if (!userRole || !screen || !action) return false;

  // Map action to screen permission
  const screenPermission = `${screen}_${action}` as keyof typeof SCREEN_PERMISSIONS;

  // Check if the combined permission exists
  if (SCREEN_PERMISSIONS[screenPermission]) {
    return hasScreenPermission(userRole, screenPermission);
  }

  // Fallback to basic screen permission for VIEW actions
  if (action === 'VIEW') {
    return hasScreenPermission(userRole, screen as keyof typeof SCREEN_PERMISSIONS);
  }

  return false;
}

/**
 * Check if a user role can edit a specific order based on its status.
 * - Admin/Supervisor: always allowed
 * - Fitter: allowed only if the order status is NOT in the restricted list
 * - Other roles: not allowed (no ORDER_EDIT permission)
 */
export function canEditOrder(
  userRole: UserRole | null,
  orderStatus: string | undefined,
): boolean {
  if (!userRole) return false;

  // Admin and Supervisor can always edit
  if (userRole === UserRole.ADMIN || userRole === UserRole.SUPERVISOR) {
    return true;
  }

  // Fitter can edit only if status is not restricted.
  // FE-035: fail closed when orderStatus is undefined — an unknown status should
  // not silently grant edit access; the backend is authoritative.
  if (userRole === UserRole.FITTER) {
    if (!orderStatus) return false;
    return !FITTER_RESTRICTED_STATUSES.includes(orderStatus);
  }

  // Other roles: defer to base ORDER_EDIT permission
  return hasScreenPermission(userRole, 'ORDER_EDIT');
}

/**
 * Get user-friendly role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case UserRole.SUPERVISOR:
      return 'Supervisor';
    case UserRole.ADMIN:
      return 'Administrator';
    case UserRole.FITTER:
      return 'Fitter';
    case UserRole.SUPPLIER:
      return 'Factory';
    case UserRole.USER:
      return 'User';
    default:
      return 'Unknown';
  }
}

/**
 * Navigation items configuration with role permissions
 */
export const NAVIGATION_ITEMS = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    permission: 'DASHBOARD' as keyof typeof SCREEN_PERMISSIONS,
  },
  {
    name: 'Orders',
    href: '/orders',
    permission: 'ORDERS' as keyof typeof SCREEN_PERMISSIONS,
  },
  {
    name: 'Customers',
    href: '/customers',
    permission: 'CUSTOMERS' as keyof typeof SCREEN_PERMISSIONS,
  },
  {
    name: 'Fitters',
    href: '/fitters',
    permission: 'FITTERS' as keyof typeof SCREEN_PERMISSIONS,
  },
  {
    name: 'Reports',
    href: '/reports',
    permission: 'REPORTS' as keyof typeof SCREEN_PERMISSIONS,
  },
] as const;

/**
 * Saddle modeling navigation items
 */
export const SADDLE_MODELING_ITEMS = [
  {
    name: 'Brands',
    href: '/brands',
    permission: 'BRANDS' as keyof typeof SCREEN_PERMISSIONS,
  },
  {
    name: 'Models',
    href: '/models',
    permission: 'MODELS' as keyof typeof SCREEN_PERMISSIONS,
  },
  {
    name: 'Leather Types',
    href: '/leathertypes',
    permission: 'LEATHER_TYPES' as keyof typeof SCREEN_PERMISSIONS,
  },
  {
    name: 'Options',
    href: '/options',
    permission: 'OPTIONS' as keyof typeof SCREEN_PERMISSIONS,
  },
  {
    name: 'Extras',
    href: '/extras',
    permission: 'EXTRAS' as keyof typeof SCREEN_PERMISSIONS,
  },
  {
    name: 'Presets',
    href: '/presets',
    permission: 'PRESETS' as keyof typeof SCREEN_PERMISSIONS,
  },
  {
    name: 'Suppliers',
    href: '/suppliers',
    permission: 'SUPPLIERS' as keyof typeof SCREEN_PERMISSIONS,
  },
] as const;