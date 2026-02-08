import { fetchEntities } from './api';
import { API_URL } from './api-config';
import { User, UserRole } from '@/types/Role';
import { logger } from '@/utils/logger';

const backendRoleToFrontend: Record<string, UserRole> = {
  admin: UserRole.ADMIN,
  fitter: UserRole.FITTER,
  factory: UserRole.SUPPLIER,
  supervisor: UserRole.SUPERVISOR,
  customsaddler: UserRole.SUPPLIER,
  user: UserRole.USER,
};

function mapBackendRole(typeName?: string): UserRole {
  if (!typeName) return UserRole.USER;
  // If already in ROLE_ format, return as-is
  if (typeName.startsWith('ROLE_')) return typeName as UserRole;
  return backendRoleToFrontend[typeName.toLowerCase()] || UserRole.USER;
}

export interface CreateUserData {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  password: string;
  // Optional address fields
  address?: string;
  city?: string;
  country?: string;
  zipcode?: string;
  cellNo?: string;
  phoneNo?: string;
  state?: string;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  password?: string;
}

export interface UsersResponse {
  'hydra:member': User[];
  'hydra:totalItems': number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  currentPage?: number;
  totalPages?: number;
}


/**
 * Fetch users with efficient pagination and server-side filtering
 * Uses the NestJS backend /v1/users endpoint with proper pagination
 */
export async function fetchUsers({
  page = 1,
  limit = 30,
  orderBy = 'email',
  order = 'asc',
  partial = false,
  filters = {},
  searchTerm = '',
  forceRefresh = false
}: {
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
  partial?: boolean;
  filters?: Record<string, string>;
  searchTerm?: string;
  forceRefresh?: boolean;
} = {}): Promise<UsersResponse> {
  logger.log('fetchUsers: Using efficient NestJS backend API...');

  const queryParams = new URLSearchParams();

  // Pagination parameters
  queryParams.append('page', page.toString());
  queryParams.append('limit', Math.min(limit, 50).toString()); // Backend max is 50

  // Build filters for backend
  const backendFilters: Record<string, string> = {};

  // Map frontend filters to backend format
  if (filters.username) backendFilters.username = filters.username;
  if (filters.email) backendFilters.email = filters.email;
  if (filters.firstName) backendFilters.firstName = filters.firstName;
  if (filters.lastName) backendFilters.lastName = filters.lastName;
  if (filters.role) backendFilters.role = filters.role;

  // Search bar: searches across username, name, and email
  if (searchTerm.trim()) {
    backendFilters.search = searchTerm.trim();
  }

  // Add filters as JSON if we have any
  if (Object.keys(backendFilters).length > 0) {
    queryParams.append('filters', JSON.stringify(backendFilters));
  }

  // Add sorting
  const sortConfig = [{
    field: orderBy,
    direction: order
  }];
  queryParams.append('sort', JSON.stringify(sortConfig));

  // Add cache busting if needed
  if (forceRefresh) {
    queryParams.append('_refresh', Date.now().toString());
  }

  const url = `${API_URL}/api/v1/users?${queryParams.toString()}`;

  logger.log('fetchUsers: Calling backend URL:', url);

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('fetchUsers: Backend error:', response.status, errorText);
    throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  logger.log('fetchUsers: Backend response:', {
    hasNext: result.hasNext,
    data: result.data?.length,
    total: result.data?.length
  });

  // Map backend response to frontend format
  const mappedUsers = (result.data || []).map((backendUser: any) => {
    // Split single "name" field into firstName/lastName
    const nameParts = (backendUser.name || '').split(' ').filter((p: string) => p.length > 0);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      ...backendUser,
      firstName: backendUser.firstName || firstName,
      lastName: backendUser.lastName || lastName,
      username: backendUser.username || '',
      email: backendUser.email || '',
      // Map backend typeName to frontend UserRole enum format
      role: mapBackendRole(backendUser.typeName || backendUser.role),
    };
  });

  const totalItems = result.totalCount ?? result.data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  logger.log(`fetchUsers: Processed ${mappedUsers.length} users from backend (total: ${totalItems})`);

  return {
    'hydra:member': mappedUsers,
    'hydra:totalItems': totalItems,
    hasNext: result.hasNextPage ?? result.hasNext ?? false,
    hasPrevious: page > 1,
    currentPage: page,
    totalPages,
  };
}

/**
 * Get a single user by ID
 */
export async function getUser(id: string): Promise<User> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }

  const backendUser = await response.json();

  // Map backend user data to frontend User type
  const nameParts = (backendUser.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return {
    ...backendUser,
    firstName: firstName,
    lastName: lastName,
  };
}

/**
 * Create a new user using BreezeJS SaveBundle architecture
 */
export async function createUser(userData: CreateUserData): Promise<User> {

  // Map firstName + lastName to single name field for backend
  const name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.username;

  // Use provided username directly
  const uniqueUsername = userData.username;
  const uniqueEmail = userData.email || `${userData.username}@example.com`;

  // Determine the correct entity type based on role
  const getEntityTypeName = (role: UserRole): string => {
    switch (role) {
      case UserRole.ADMIN:
        return 'Admin:#App.Entity.User';
      case UserRole.SUPPLIER:
        return 'Supplier:#App.Entity.User';
      case UserRole.FITTER:
        return 'Fitter:#App.Entity.User';
      case UserRole.SUPERVISOR:
        return 'Supervisor:#App.Entity.User';
      case UserRole.USER:
        // For USER role, create as Fitter since that's a common user type
        // The base User entity might not be shown in the API endpoint
        return 'Fitter:#App.Entity.User';
      default:
        return 'Admin:#App.Entity.User';
    }
  };

  // Create BreezeJS-style entity with the correct format for the backend
  const entity = {
    // Include all user fields for creation
    name: name,
    username: uniqueUsername,
    email: uniqueEmail,
    plainPassword: userData.password,
    enabled: true,
    // Required address fields with defaults to prevent validation errors
    address: userData.address || 'Default Address',
    city: userData.city || 'Default City',
    country: userData.country || 'US',
    currency: 'USD',
    zipcode: userData.zipcode || '00000',
    // Optional fields
    cellNo: userData.cellNo || null,
    phoneNo: userData.phoneNo || null,
    state: userData.state || null,
    // BreezeJS entity metadata with correct format for role-based creation
    entityAspect: {
      entityTypeName: getEntityTypeName(userData.role),
      entityState: "Added",
      originalValuesMap: {},
      autoGeneratedKey: null,
      defaultResourceName: "users"
    }
  };

  // Remove undefined fields to keep payload clean
  Object.keys(entity).forEach(key => {
    if (key !== 'entityAspect' && (entity as any)[key] === undefined) {
      delete (entity as any)[key];
    }
  });

  // Create the save bundle structure expected by the backend
  const saveBundle = {
    entities: [entity]
  };

  logger.log('Attempting user creation with BreezeJS SaveBundle:', JSON.stringify(saveBundle, null, 2));

  const response = await fetch(`${API_URL}/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ld+json',
      'Accept': 'application/ld+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    credentials: 'include',
    body: JSON.stringify(saveBundle),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('User creation failed:', response.status, errorText);
    throw new Error(`Failed to create user: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  logger.log('User creation result:', result);

  // Check for errors in SaveBundle response
  if (result.Errors && result.Errors.length > 0) {
    logger.error('SaveBundle errors:', result.Errors);
    logger.error('Full error objects:', JSON.stringify(result.Errors, null, 2));
    const errorMessages = result.Errors.map((err: any) => {
      return err.ErrorMessage || err.message || err.Message || err.error || err.description || JSON.stringify(err);
    }).join(', ');
    throw new Error(`User creation failed: ${errorMessages}`);
  }

  // Helper function to map backend user to frontend User type
  const mapBackendUserToFrontend = (backendUser: any): User => {
    logger.log('🔍 Mapping backend user:', backendUser);

    // Split name into firstName and lastName
    const nameParts = (backendUser.name || '').split(' ').filter((part: string) => part.length > 0);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    logger.log('🔍 Name mapping:', {
      originalName: backendUser.name,
      nameParts,
      firstName,
      lastName
    });

    return {
      // Preserve all original backend fields first
      ...backendUser,
      // Then override with our mapped fields
      firstName: firstName,
      lastName: lastName,
      role: backendUser.role || userData.role,
    };
  };

  // Return the created user from the save result
  if (result.Entities && result.Entities.length > 0) {
    return mapBackendUserToFrontend(result.Entities[0]);
  } else if (result.entities && result.entities.length > 0) {
    return mapBackendUserToFrontend(result.entities[0]);
  } else {
    // If no entity returned in SaveBundle but no errors, creation was likely successful
    logger.log('No entities in SaveBundle response but no errors, returning optimistic data');
    return {
      id: 'pending', // Will be set by backend
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      name: name
    } as User;
  }
}

/**
 * Update an existing user using BreezeJS SaveBundle architecture
 */
export async function updateUser(id: string, userData: UpdateUserData): Promise<User> {

  // Determine the correct entity type based on role (if provided)
  const getEntityTypeName = (role?: UserRole): string => {
    if (!role) return 'User:#App.Entity.User'; // Default if no role specified
    switch (role) {
      case UserRole.ADMIN:
        return 'Admin:#App.Entity.User';
      case UserRole.SUPPLIER:
        return 'Supplier:#App.Entity.User';
      case UserRole.FITTER:
        return 'Fitter:#App.Entity.User';
      case UserRole.SUPERVISOR:
        return 'Supervisor:#App.Entity.User';
      default:
        return 'User:#App.Entity.User';
    }
  };

  // Create entity with the same explicit structure as other entities
  const entity: any = {
    // Include the id field for updates
    id: id,
    // Include fields that are being updated
  };

  // Only add fields that are actually being updated
  if (userData.username !== undefined) {
    entity.username = userData.username;
  }

  if (userData.email !== undefined) {
    entity.email = userData.email;
  }

  // Map firstName + lastName to single name field for backend
  if (userData.firstName !== undefined || userData.lastName !== undefined) {
    const name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
    if (name) {
      entity.name = name;
    }
  }

  if (userData.password !== undefined && userData.password !== '') {
    entity.plainPassword = userData.password;
  }

  // BreezeJS entity metadata with correct format
  entity.entityAspect = {
    entityTypeName: getEntityTypeName(userData.role),
    entityState: "Modified",
    originalValuesMap: {},
    autoGeneratedKey: null,
    defaultResourceName: "users"
  };

  // Remove undefined fields to keep payload clean
  Object.keys(entity).forEach(key => {
    if (key !== 'entityAspect' && (entity as any)[key] === undefined) {
      delete (entity as any)[key];
    }
  });

  // Create the save bundle structure expected by the backend
  const saveBundle = {
    entities: [entity]
  };

  logger.log('Attempting user update with BreezeJS SaveBundle:', JSON.stringify(saveBundle, null, 2));

  const response = await fetch(`${API_URL}/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ld+json',
      'Accept': 'application/ld+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    credentials: 'include',
    body: JSON.stringify(saveBundle),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Update user error response:', errorText);
    throw new Error(`Failed to update user: ${response.statusText}`);
  }

  const result = await response.json();
  logger.log('User update result:', result);

  // Check for errors in SaveBundle response
  if (result.Errors && result.Errors.length > 0) {
    logger.error('SaveBundle errors:', result.Errors);
    logger.error('Full error objects:', JSON.stringify(result.Errors, null, 2));
    const errorMessages = result.Errors.map((err: any) => {
      return err.ErrorMessage || err.message || err.Message || err.error || err.description || JSON.stringify(err);
    }).join(', ');
    throw new Error(`User update failed: ${errorMessages}`);
  }

  // Helper function to map backend user to frontend User type
  const mapBackendUserToFrontend = (backendUser: any): User => {
    logger.log('🔍 Mapping backend user (update):', backendUser);

    // Split name into firstName and lastName
    const nameParts = (backendUser.name || '').split(' ').filter((part: string) => part.length > 0);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    logger.log('🔍 Name mapping (update):', {
      originalName: backendUser.name,
      nameParts,
      firstName,
      lastName
    });

    return {
      // Preserve all original backend fields first
      ...backendUser,
      // Then override with our mapped fields
      firstName: firstName,
      lastName: lastName,
      role: backendUser.role || userData.role || 'ROLE_USER',
    };
  };

  // Handle SaveBundle response format
  if (result.Entities && result.Entities.length > 0) {
    // Use the updated entity from the response
    return mapBackendUserToFrontend(result.Entities[0]);
  } else if (result.entities && result.entities.length > 0) {
    // Fallback for alternative response format
    return mapBackendUserToFrontend(result.entities[0]);
  } else {
    // If no entity returned in SaveBundle but no errors, update was likely successful
    logger.log('No entities in SaveBundle response but no errors, returning optimistic data');
    return {
      id: id,
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role || 'ROLE_USER'
    } as User;
  }
}

/**
 * Delete a user
 */
export async function deleteUser(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to delete user: ${response.statusText}`);
  }
}

/**
 * Get all available user roles
 */
export function getUserRoles(): { value: UserRole; label: string }[] {
  return [
    { value: UserRole.USER, label: 'User' },
    { value: UserRole.FITTER, label: 'Fitter' },
    { value: UserRole.SUPPLIER, label: 'Factory' },
    { value: UserRole.ADMIN, label: 'Administrator' },
    { value: UserRole.SUPERVISOR, label: 'Supervisor' },
  ];
}

/**
 * Get the total count of users efficiently using the backend API
 */
export async function fetchUserCount(): Promise<number> {
  try {
    logger.log('fetchUserCount: Getting total user count from NestJS backend');

    const url = `${API_URL}/api/v1/users?page=1&limit=1`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      logger.error('Error fetching user count:', response.status, response.statusText);
      return 0;
    }

    const result = await response.json();
    const total = result.totalCount ?? result.data?.length ?? 0;
    logger.log('Total user count:', total);
    return total;
  } catch (error) {
    logger.error('Error fetching user count:', error);
    return 0;
  }
}