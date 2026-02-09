import { Module } from "@nestjs/common";
import { RlsService } from "./rls.service";
import { RlsGuard, EnhancedRlsGuard } from "./rls.guard";

/**
 * Row Level Security Module
 *
 * This module provides RLS context management for multi-tenant data isolation.
 * Import this module in AppModule to enable RLS functionality across the application.
 *
 * Usage:
 * 1. Inject RlsService in authentication middleware/guards
 * 2. Call setUserContext() after JWT validation
 * 3. All subsequent database queries will be automatically filtered
 *
 * Security Benefits:
 * - Automatic data isolation without code changes
 * - Role-based access control at database level
 * - Performance optimized with strategic indexes
 * - Comprehensive audit trail protection
 */
@Module({
  providers: [RlsService, RlsGuard, EnhancedRlsGuard],
  exports: [RlsService, RlsGuard, EnhancedRlsGuard],
})
export class RlsModule {}
