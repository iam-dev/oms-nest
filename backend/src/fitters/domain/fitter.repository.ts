import { Fitter } from "./fitter";

/**
 * Fitter Domain Repository Interface
 *
 * Defines the contract for fitter persistence without exposing infrastructure details.
 * Uses abstract class so NestJS can use it as an injection token.
 */
export abstract class IFitterRepository {
  abstract findById(id: number): Promise<Fitter | null>;
  abstract findByUserId(userId: number): Promise<Fitter | null>;
  abstract findAllPaginated(options: {
    page: number;
    limit: number;
    city?: string;
    country?: string;
    searchTerm?: string;
    name?: string;
    username?: string;
    status?: string;
  }): Promise<{ fitters: Fitter[]; total: number }>;
  abstract findActive(): Promise<Fitter[]>;
  abstract findDistinctCountries(): Promise<string[]>;
  abstract findByCountry(country: string): Promise<Fitter[]>;
  abstract findByCity(city: string): Promise<Fitter[]>;
  abstract countByCountry(country: string): Promise<number>;
  abstract countActive(): Promise<number>;
  abstract save(fitter: Fitter): Promise<Fitter>;
  abstract softDelete(id: number): Promise<void>;
}
