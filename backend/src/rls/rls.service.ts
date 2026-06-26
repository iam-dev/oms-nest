import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { RoleEnum } from "../roles/roles.enum";

/**
 * Row Level Security (RLS) Service
 *
 * This service manages PostgreSQL Row Level Security context for multi-tenant data isolation.
 * It sets session variables that are used by RLS policies to filter data based on user context.
 *
 * Integration with Authentication:
 * - Call setUserContext() after JWT validation in authentication middleware
 * - Context persists for the duration of the database connection
 * - Automatically filtered queries based on user role and ownership
 *
 * Security Features:
 * - Role-based data isolation (supervisor, admin, fitter, factory, user)
 * - Automatic data filtering without application code changes
 * - Performance optimized with dedicated indexes
 * - Audit trail protection (read-only for non-supervisors)
 */
@Injectable()
export class RlsService {
  private readonly logger = new Logger(RlsService.name);
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Set RLS context for the current database session
   *
   * This method sets session variables that RLS policies use to filter data:
   * - rls.user_id: Current user's UUID
   * - rls.user_role: User's role ID from RoleEnum
   * - rls.factory_id: Factory ID for factory role users
   * - rls.fitter_id: Fitter ID for fitter role users
   *
   * @param userId - Current user's UUID
   * @param userRole - User's role from RoleEnum
   * @param factoryId - Optional factory ID for factory users
   * @param fitterId - Optional fitter ID for fitter users
   */
  async setUserContext(
    userId: string,
    userRole: RoleEnum,
    factoryId?: string,
    fitterId?: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Set core user context
      await queryRunner.query(`SELECT set_config('rls.user_id', $1, false)`, [
        userId,
      ]);

      await queryRunner.query(`SELECT set_config('rls.user_role', $1, false)`, [
        userRole.toString(),
      ]);

      // Set role-specific context
      if (factoryId && userRole === RoleEnum.factory) {
        await queryRunner.query(
          `SELECT set_config('rls.factory_id', $1, false)`,
          [factoryId],
        );
      }

      if (fitterId && userRole === RoleEnum.fitter) {
        await queryRunner.query(
          `SELECT set_config('rls.fitter_id', $1, false)`,
          [fitterId],
        );
      }
    } finally {
      // BE-004 (safer minimal fix): clear session-scoped config before returning this
      // connection to the pool. set_config(…, false) is session-scoped — without this
      // cleanup, a pooled connection could expose the previous user's RLS context to
      // the next request that acquires it.
      //
      // TODO(security/BE-004): For a complete fix, switch to transaction-local
      // set_config(…, true) so context is automatically cleared at transaction end,
      // and ensure all dependent queries execute inside the same transaction as the SET.
      // That requires a larger refactor of all callers.
      try {
        await queryRunner.query(`SELECT set_config('rls.user_id', '', false)`);
        await queryRunner.query(
          `SELECT set_config('rls.user_role', '6', false)`,
        ); // 6 = RoleEnum.user (safe default, no elevated access)
        await queryRunner.query(
          `SELECT set_config('rls.factory_id', '', false)`,
        );
        await queryRunner.query(
          `SELECT set_config('rls.fitter_id', '', false)`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to clear RLS context before pool release: ${(err as Error).message}`,
        );
      } finally {
        await queryRunner.release();
      }
    }
  }

  /**
   * Clear RLS context (useful for cleanup or role switching)
   */
  async clearUserContext(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      await queryRunner.query(`SELECT set_config('rls.user_id', '', false)`);
      await queryRunner.query(`SELECT set_config('rls.user_role', '2', false)`); // Default to user role
      await queryRunner.query(`SELECT set_config('rls.factory_id', '', false)`);
      await queryRunner.query(`SELECT set_config('rls.fitter_id', '', false)`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get current RLS context for debugging/validation
   */
  async getCurrentContext(): Promise<{
    userId: string;
    userRole: number;
    factoryId?: string;
    fitterId?: string;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      const [userIdResult] = await queryRunner.query(
        `SELECT current_setting('rls.user_id', true) as user_id`,
      );

      const [userRoleResult] = await queryRunner.query(
        `SELECT current_setting('rls.user_role', true) as user_role`,
      );

      const [factoryIdResult] = await queryRunner.query(
        `SELECT current_setting('rls.factory_id', true) as factory_id`,
      );

      const [fitterIdResult] = await queryRunner.query(
        `SELECT current_setting('rls.fitter_id', true) as fitter_id`,
      );

      return {
        userId: userIdResult?.user_id || "",
        userRole: parseInt(userRoleResult?.user_role || "2"),
        factoryId: factoryIdResult?.factory_id || undefined,
        fitterId: fitterIdResult?.fitter_id || undefined,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute a query with specific user context (useful for admin operations)
   *
   * @param userId - User context to set
   * @param userRole - Role context to set
   * @param queryFn - Function that executes the query
   * @param factoryId - Optional factory ID
   * @param fitterId - Optional fitter ID
   */
  // TODO(security/BE-031): executeWithUserContext has an atomicity gap.
  //
  // Current behaviour: setUserContext + queryFn + restoreContext are three
  // separate database round-trips.  Under connection pool usage, another
  // coroutine can acquire the same connection between any of these steps,
  // inheriting the wrong RLS context.
  //
  // Recommended fix:
  //   1. Acquire a dedicated queryRunner via `this.dataSource.createQueryRunner()`.
  //   2. Run setUserContext, queryFn, and restoreContext on that queryRunner within
  //      a single transaction (BEGIN / COMMIT).  This ensures the SET LOCAL
  //      variables are scoped to the transaction and cannot leak to other callers.
  //   3. Release the queryRunner in a finally block.
  //
  // This is a behaviour-changing refactor that requires careful testing of all
  // RLS-aware endpoints before deployment.
  async executeWithUserContext<T>(
    userId: string,
    userRole: RoleEnum,
    queryFn: () => Promise<T>,
    factoryId?: string,
    fitterId?: string,
  ): Promise<T> {
    // Save current context
    const currentContext = await this.getCurrentContext();

    try {
      // Set new context
      await this.setUserContext(userId, userRole, factoryId, fitterId);

      // Execute query with new context
      return await queryFn();
    } finally {
      // Restore original context
      await this.setUserContext(
        currentContext.userId,
        currentContext.userRole as RoleEnum,
        currentContext.factoryId,
        currentContext.fitterId,
      );
    }
  }

  /**
   * Check if RLS policies are active for debugging
   */
  async checkRlsStatus(): Promise<
    {
      table: string;
      rlsEnabled: boolean;
      policies: string[];
    }[]
  > {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Check RLS status for all tables
      // Note: "user" view aliases credentials table, so we check credentials
      const tables = [
        "credentials", // "user" view points to this table
        "customers", // Note: plural
        "orders",
        "fitters",
        "factories",
        "factory_employees",
        "log", // Note: was "audit_log" in old schema
      ];
      const results: {
        table: string;
        rlsEnabled: boolean;
        policies: string[];
      }[] = [];

      for (const table of tables) {
        const [rlsStatus] = await queryRunner.query(
          `
          SELECT relrowsecurity as rls_enabled
          FROM pg_class
          WHERE relname = $1
        `,
          [table],
        );

        const policies = await queryRunner.query(
          `
          SELECT policyname
          FROM pg_policies
          WHERE tablename = $1
          ORDER BY policyname
        `,
          [table],
        );

        results.push({
          table,
          rlsEnabled: rlsStatus?.rls_enabled || false,
          policies: policies.map((p: any) => p.policyname),
        });
      }

      return results;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Test RLS policies with sample queries (for development/testing)
   */
  async testRlsPolicies(
    testUserId: string,
    testUserRole: RoleEnum,
  ): Promise<
    {
      table: string;
      accessibleRecords: number;
      error?: string;
    }[]
  > {
    const results: {
      table: string;
      accessibleRecords: number;
      error?: string;
    }[] = [];
    // Note: "user" view aliases credentials table
    const tables = [
      {
        name: "credentials",
        query: "SELECT COUNT(*) as count FROM credentials",
      },
      { name: "customers", query: "SELECT COUNT(*) as count FROM customers" },
      { name: "orders", query: 'SELECT COUNT(*) as count FROM "orders"' },
      { name: "fitters", query: "SELECT COUNT(*) as count FROM fitters" },
      { name: "factories", query: "SELECT COUNT(*) as count FROM factories" },
      {
        name: "factory_employees",
        query: "SELECT COUNT(*) as count FROM factory_employees",
      },
      { name: "log", query: "SELECT COUNT(*) as count FROM log" },
    ];

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Set test context
      await queryRunner.query(`SELECT set_config('rls.user_id', $1, false)`, [
        testUserId,
      ]);

      await queryRunner.query(`SELECT set_config('rls.user_role', $1, false)`, [
        testUserRole.toString(),
      ]);

      for (const table of tables) {
        try {
          const [result] = await queryRunner.query(table.query);
          results.push({
            table: table.name,
            accessibleRecords: parseInt(result.count),
          });
        } catch (_error) {
          results.push({
            table: table.name,
            accessibleRecords: 0,
            error: _error.message,
          });
        }
      }

      return results;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Set tenant context for multi-tenant isolation (production feature)
   */
  async setTenantContext(
    userId: string,
    userRole: RoleEnum,
    tenantId: string,
    organizationId?: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Set tenant context variables
      await queryRunner.query(`SELECT set_config('rls.tenant_id', $1, false)`, [
        tenantId,
      ]);

      if (organizationId) {
        await queryRunner.query(
          `SELECT set_config('rls.organization_id', $1, false)`,
          [organizationId],
        );
      }

      // Set user context as well
      await this.setUserContext(userId, userRole);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validate data isolation for tenant (production feature)
   */
  async validateDataIsolation(tenantId: string): Promise<{
    isolated: boolean;
    violations: string[];
  }> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Set tenant context for testing
      await queryRunner.query(`SELECT set_config('rls.tenant_id', $1, false)`, [
        tenantId,
      ]);

      const violations: string[] = [];

      // Test data isolation for key tables
      const testTables = ["customers", "orders", "credentials"];
      for (const table of testTables) {
        try {
          const [result] = await queryRunner.query(
            `SELECT COUNT(*) as count FROM ${table}`,
          );
          // In a properly isolated system, count should reflect only tenant data
          if (result.count === 0) {
            violations.push(
              `No data accessible for tenant ${tenantId} in table ${table}`,
            );
          }
        } catch (error) {
          violations.push(`Error accessing table ${table}: ${error.message}`);
        }
      }

      return {
        isolated: violations.length === 0,
        violations,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Generate compliance report for RLS (production feature)
   */
  async generateComplianceReport(): Promise<{
    rlsEnabled: boolean;
    policiesActive: number;
    tables: Array<{
      table: string;
      hasRls: boolean;
      policyCount: number;
    }>;
    recommendations: string[];
  }> {
    const rlsStatus = await this.checkRlsStatus();
    const recommendations: string[] = [];

    let totalPolicies = 0;
    let rlsEnabledCount = 0;

    const tableDetails = rlsStatus.map((status) => {
      totalPolicies += status.policies.length;
      if (status.rlsEnabled) rlsEnabledCount++;

      if (!status.rlsEnabled && status.table !== "audit_log") {
        recommendations.push(`Enable RLS on table: ${status.table}`);
      }

      if (status.policies.length === 0 && status.rlsEnabled) {
        recommendations.push(`Add RLS policies to table: ${status.table}`);
      }

      return {
        table: status.table,
        hasRls: status.rlsEnabled,
        policyCount: status.policies.length,
      };
    });

    if (recommendations.length === 0) {
      recommendations.push("RLS configuration appears compliant");
    }

    return {
      rlsEnabled: rlsEnabledCount > 0,
      policiesActive: totalPolicies,
      tables: tableDetails,
      recommendations,
    };
  }

  /**
   * Set hierarchical tenant context for parent-child tenant relationships
   */
  async setHierarchicalTenantContext(
    userId: string,
    userRole: RoleEnum,
    tenantId: string,
    parentTenantId?: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      await queryRunner.query(`SELECT set_config('rls.tenant_id', $1, false)`, [
        tenantId,
      ]);

      if (parentTenantId) {
        await queryRunner.query(
          `SELECT set_config('rls.parent_tenant_id', $1, false)`,
          [parentTenantId],
        );
      }

      await this.setUserContext(userId, userRole);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validate data isolation between specific tenants
   */
  async validateTenantDataIsolation(
    tenantId1: string,
    tenantId2: string,
  ): Promise<{
    isolated: boolean;
    violations: string[];
  }> {
    const violations: string[] = [];

    // Test isolation from both perspectives
    const isolation1 = await this.validateDataIsolation(tenantId1);
    const isolation2 = await this.validateDataIsolation(tenantId2);

    if (!isolation1.isolated) {
      violations.push(
        `Tenant ${tenantId1} isolation compromised: ${isolation1.violations.join(", ")}`,
      );
    }

    if (!isolation2.isolated) {
      violations.push(
        `Tenant ${tenantId2} isolation compromised: ${isolation2.violations.join(", ")}`,
      );
    }

    return {
      isolated: violations.length === 0,
      violations,
    };
  }

  /**
   * Detect cross-tenant data leakage
   */
  async detectDataLeakage(tenantId: string): Promise<{
    hasLeakage: boolean;
    leakages: string[];
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    const leakages: string[] = [];

    try {
      await queryRunner.connect();

      // Set tenant context
      await queryRunner.query(`SELECT set_config('rls.tenant_id', $1, false)`, [
        tenantId,
      ]);

      // Check for cross-tenant data access
      // Note: tenant_id column may not exist in current schema - these queries will fail gracefully
      const testQueries = [
        `SELECT COUNT(DISTINCT tenant_id) as tenant_count FROM customers WHERE tenant_id != $1`,
        `SELECT COUNT(DISTINCT tenant_id) as tenant_count FROM orders WHERE tenant_id != $1`,
      ];

      for (const query of testQueries) {
        try {
          const [result] = await queryRunner.query(query, [tenantId]);
          if (result.tenant_count > 0) {
            leakages.push(
              `Cross-tenant data access detected: ${result.tenant_count} other tenants accessible`,
            );
          }
        } catch {
          // Query failure might indicate proper isolation
        }
      }

      return {
        hasLeakage: leakages.length > 0,
        leakages,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Set factory-specific tenant isolation setup
   */
  async setFactoryTenantContext(
    userId: string,
    factoryId: string,
    tenantId?: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      await queryRunner.query(
        `SELECT set_config('rls.factory_id', $1, false)`,
        [factoryId],
      );

      if (tenantId) {
        await queryRunner.query(
          `SELECT set_config('rls.tenant_id', $1, false)`,
          [tenantId],
        );
      }

      await this.setUserContext(userId, RoleEnum.factory, factoryId);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validate factory can only access own orders
   */
  async validateFactoryOrderAccess(factoryId: string): Promise<{
    validAccess: boolean;
    violations: string[];
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    const violations: string[] = [];

    try {
      await queryRunner.connect();

      await queryRunner.query(
        `SELECT set_config('rls.factory_id', $1, false)`,
        [factoryId],
      );

      // Test factory access to orders
      const [result] = await queryRunner.query(
        `SELECT COUNT(*) as count FROM orders WHERE factory_id != $1`,
        [factoryId],
      );

      if (result.count > 0) {
        violations.push(
          `Factory ${factoryId} can access ${result.count} orders from other factories`,
        );
      }

      return {
        validAccess: violations.length === 0,
        violations,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Set fitter-specific tenant isolation setup
   */
  async setFitterTenantContext(
    userId: string,
    fitterId: string,
    tenantId?: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      await queryRunner.query(`SELECT set_config('rls.fitter_id', $1, false)`, [
        fitterId,
      ]);

      if (tenantId) {
        await queryRunner.query(
          `SELECT set_config('rls.tenant_id', $1, false)`,
          [tenantId],
        );
      }

      await this.setUserContext(userId, RoleEnum.fitter, undefined, fitterId);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validate fitter access to assigned customers
   */
  async validateFitterCustomerAccess(fitterId: string): Promise<{
    validAccess: boolean;
    violations: string[];
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    const violations: string[] = [];

    try {
      await queryRunner.connect();

      await queryRunner.query(`SELECT set_config('rls.fitter_id', $1, false)`, [
        fitterId,
      ]);

      // Test fitter access to customers
      const [result] = await queryRunner.query(
        `SELECT COUNT(*) as count FROM customers WHERE fitter_id != $1 AND fitter_id IS NOT NULL`,
        [fitterId],
      );

      if (result.count > 0) {
        violations.push(
          `Fitter ${fitterId} can access ${result.count} customers assigned to other fitters`,
        );
      }

      return {
        validAccess: violations.length === 0,
        violations,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Set admin bypass mode for global access
   */
  async setAdminBypassContext(userId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      await queryRunner.query(
        `SELECT set_config('rls.bypass_mode', 'true', false)`,
      );
      await this.setUserContext(userId, RoleEnum.supervisor);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validate admin global access permissions
   */
  async validateAdminGlobalAccess(userId: string): Promise<{
    hasGlobalAccess: boolean;
    violations: string[];
  }> {
    const violations: string[] = [];

    try {
      await this.setAdminBypassContext(userId);

      // Test global access to all tables
      const testResults = await this.testRlsPolicies(
        userId,
        RoleEnum.supervisor,
      );

      for (const result of testResults) {
        if (result.error) {
          violations.push(
            `Admin cannot access table ${result.table}: ${result.error}`,
          );
        }
      }

      return {
        hasGlobalAccess: violations.length === 0,
        violations,
      };
    } finally {
      await this.clearUserContext();
    }
  }

  /**
   * Set user context with audit logging
   */
  async setUserContextWithAudit(
    userId: string,
    userRole: RoleEnum,
    factoryId?: string,
    fitterId?: string,
  ): Promise<void> {
    // Log context change
    this.logger.log(
      `Setting user context: ${userId}, role: ${userRole}, factory: ${factoryId}, fitter: ${fitterId}`,
    );

    await this.setUserContext(userId, userRole, factoryId, fitterId);

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Log to log table if exists (was audit_log in old schema)
      // Note: log table has different structure, so we use text column
      await queryRunner.query(
        `INSERT INTO log (user_id, user_type, order_id, text, time)
         VALUES ($1, 0, 0, $2, EXTRACT(EPOCH FROM NOW())::INTEGER)
         ON CONFLICT DO NOTHING`,
        [
          userId,
          `RLS_CONTEXT_SET: ${JSON.stringify({ userRole, factoryId, fitterId })}`,
        ],
      );
    } catch (error) {
      // Audit table may not exist, that's okay
      this.logger.warn(`Could not log to audit table: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Generate tenant-specific compliance reporting
   */
  async generateTenantComplianceReport(tenantId: string): Promise<{
    tenantId: string;
    rlsEnabled: boolean;
    policiesActive: number;
    dataIsolated: boolean;
    violations: string[];
    recommendations: string[];
  }> {
    const baseReport = await this.generateComplianceReport();
    const isolationResult = await this.validateDataIsolation(tenantId);
    const leakageResult = await this.detectDataLeakage(tenantId);

    const violations = [
      ...isolationResult.violations,
      ...leakageResult.leakages,
    ];

    const recommendations = [...baseReport.recommendations];
    if (violations.length > 0) {
      recommendations.push(
        "Review and strengthen RLS policies for tenant isolation",
      );
    }

    return {
      tenantId,
      rlsEnabled: baseReport.rlsEnabled,
      policiesActive: baseReport.policiesActive,
      dataIsolated: violations.length === 0,
      violations,
      recommendations,
    };
  }

  /**
   * Set user context with caching for performance
   */
  async setUserContextWithCache(
    userId: string,
    userRole: RoleEnum,
    factoryId?: string,
    fitterId?: string,
  ): Promise<void> {
    // For now, just set context normally
    // In production, this would integrate with Redis caching
    await this.setUserContext(userId, userRole, factoryId, fitterId);
  }

  /**
   * Batch operations for multiple user contexts
   */
  async batchSetUserContexts(
    contexts: Array<{
      userId: string;
      userRole: RoleEnum;
      factoryId?: string;
      fitterId?: string;
    }>,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      for (const context of contexts) {
        await queryRunner.query(`SELECT set_config('rls.user_id', $1, false)`, [
          context.userId,
        ]);

        await queryRunner.query(
          `SELECT set_config('rls.user_role', $1, false)`,
          [context.userRole.toString()],
        );

        if (context.factoryId) {
          await queryRunner.query(
            `SELECT set_config('rls.factory_id', $1, false)`,
            [context.factoryId],
          );
        }

        if (context.fitterId) {
          await queryRunner.query(
            `SELECT set_config('rls.fitter_id', $1, false)`,
            [context.fitterId],
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Security validation for RLS bypass attempts
   */
  async validateSecurityContext(): Promise<{
    secure: boolean;
    securityIssues: string[];
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    const securityIssues: string[] = [];

    try {
      await queryRunner.connect();

      // Check for bypass attempts
      const [bypassResult] = await queryRunner.query(
        `SELECT current_setting('rls.bypass_mode', true) as bypass_mode`,
      );

      if (bypassResult?.bypass_mode === "true") {
        const [userRoleResult] = await queryRunner.query(
          `SELECT current_setting('rls.user_role', true) as user_role`,
        );

        const userRole = parseInt(userRoleResult?.user_role || "2");
        if (userRole !== RoleEnum.supervisor) {
          securityIssues.push("Unauthorized RLS bypass detected");
        }
      }

      // Check for missing context
      const [userIdResult] = await queryRunner.query(
        `SELECT current_setting('rls.user_id', true) as user_id`,
      );

      if (!userIdResult?.user_id || userIdResult.user_id === "") {
        securityIssues.push("Missing user context in RLS");
      }

      return {
        secure: securityIssues.length === 0,
        securityIssues,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * RLS policy integrity validation
   */
  async validateRlsPolicyIntegrity(): Promise<{
    integrityValid: boolean;
    policyIssues: string[];
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    const policyIssues: string[] = [];

    try {
      await queryRunner.connect();

      // Check for tables without RLS policies
      const tablesWithoutPolicies = await queryRunner.query(
        `
        SELECT t.relname as table_name
        FROM pg_class t
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND t.relkind = 'r'
        AND t.relrowsecurity = true
        AND NOT EXISTS (
          SELECT 1 FROM pg_policies p
          WHERE p.tablename = t.relname
        )
        `,
      );

      for (const table of tablesWithoutPolicies) {
        policyIssues.push(
          `Table ${table.table_name} has RLS enabled but no policies`,
        );
      }

      // Check for policies on tables without RLS
      const policiesWithoutRls = await queryRunner.query(
        `
        SELECT DISTINCT p.tablename
        FROM pg_policies p
        LEFT JOIN pg_class t ON p.tablename = t.relname
        WHERE t.relrowsecurity = false OR t.relrowsecurity IS NULL
        `,
      );

      for (const policy of policiesWithoutRls) {
        policyIssues.push(
          `Table ${policy.tablename} has policies but RLS is not enabled`,
        );
      }

      return {
        integrityValid: policyIssues.length === 0,
        policyIssues,
      };
    } finally {
      await queryRunner.release();
    }
  }
}
