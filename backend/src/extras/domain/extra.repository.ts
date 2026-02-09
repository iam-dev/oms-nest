import { Extra } from "./extra";
import { ExtraId } from "./value-objects/extra-id.value-object";

/**
 * Extra Domain Repository Interface
 *
 * Defines the contract for extra persistence without exposing infrastructure details.
 * Uses abstract class so NestJS can use it as an injection token.
 */
export abstract class IExtraRepository {
  abstract findById(id: ExtraId): Promise<Extra | null>;
  abstract findByName(name: string): Promise<Extra | null>;
  abstract findAll(options: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ extras: Extra[]; total: number }>;
  abstract findActive(): Promise<Extra[]>;
  abstract save(extra: Extra): Promise<Extra>;
  abstract softDelete(id: ExtraId): Promise<void>;
}
