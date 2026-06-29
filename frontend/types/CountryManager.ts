export interface CountryManager {
  id: string;
  country: string;
  managerName?: string;
  email?: string;
  phone?: string;
  region?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown; // Allow additional properties
}

export interface CountryManagersResponse {
  'hydra:member': CountryManager[];
  'hydra:totalItems': number;
  'hydra:view'?: {
    '@id': string;
    'hydra:first'?: string;
    'hydra:last'?: string;
    'hydra:next'?: string;
    'hydra:previous'?: string;
  };
}