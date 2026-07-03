export enum UserRole {
  USER = 'ROLE_USER',
  FITTER = 'ROLE_FITTER',
  ADMIN = 'ROLE_ADMIN',
  SUPPLIER = 'ROLE_SUPPLIER',
  SUPERVISOR = 'ROLE_SUPERVISOR',
}

export type User = {
  id: number | string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  [key: string]: unknown; // Allow additional properties
};
