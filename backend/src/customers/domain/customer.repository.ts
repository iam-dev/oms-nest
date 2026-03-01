import { Customer } from "./customer";
import { CustomerId } from "./value-objects/customer-id.value-object";
import { Email } from "./value-objects/email.value-object";

/**
 * Customer Domain Repository Interface
 *
 * Defines the contract for customer persistence without exposing infrastructure details
 * Uses integer IDs to match PostgreSQL schema
 */
export abstract class ICustomerRepository {
  abstract findById(id: CustomerId): Promise<Customer | null>;
  abstract findByEmail(
    email: Email,
    fitterId?: number,
  ): Promise<Customer | null>;
  abstract findByFitterId(fitterId: number): Promise<Customer[]>;
  abstract findByCountry(country: string): Promise<Customer[]>;
  abstract findByCity(city: string): Promise<Customer[]>;
  abstract findActive(): Promise<Customer[]>;
  abstract save(customer: Customer): Promise<void>;
  abstract delete(id: CustomerId): Promise<void>;
  abstract findAll(filters?: {
    fitterId?: number;
    country?: string;
    city?: string;
    isActive?: boolean;
  }): Promise<Customer[]>;
  abstract countByFitterId(fitterId: number): Promise<number>;
  abstract countActive(): Promise<number>;
  abstract findActiveCustomersWithoutFitter(): Promise<Customer[]>;
  abstract existsByEmail(email: Email, fitterId?: number): Promise<boolean>;

  abstract findAllPaginated(options: {
    page: number;
    limit: number;
    fitterId?: number;
    orderFitterId?: number;
    name?: string;
    email?: string;
    country?: string;
    city?: string;
    search?: string;
    id?: number;
  }): Promise<{ customers: Customer[]; total: number }>;

  // Bulk operations for migration support
  abstract bulkCreate(customers: Customer[]): Promise<Customer[]>;
}
