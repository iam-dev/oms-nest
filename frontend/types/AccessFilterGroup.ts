export interface AccessFilterGroup {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown; // Allow additional properties
}

export interface AccessFilterGroupsResponse {
  'hydra:member': AccessFilterGroup[];
  'hydra:totalItems': number;
  'hydra:view'?: {
    '@id': string;
    'hydra:first'?: string;
    'hydra:last'?: string;
    'hydra:next'?: string;
    'hydra:previous'?: string;
  };
}