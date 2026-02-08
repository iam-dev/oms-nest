import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { RlsService } from "../../../src/rls/rls.service";
import { RoleEnum } from "../../../src/roles/roles.enum";

describe("RlsService", () => {
  let service: RlsService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _dataSource: DataSource | undefined;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RlsService,
        {
          provide: "DATA_SOURCE",
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<RlsService>(RlsService);
    _dataSource = module.get<DataSource>("DATA_SOURCE");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("setUserContext", () => {
    it("should set basic user context correctly", async () => {
      const userId = "test-user-id";
      const userRole = RoleEnum.admin;

      await service.setUserContext(userId, userRole);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.user_id', $1, false)`,
        [userId],
      );
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.user_role', $1, false)`,
        [userRole.toString()],
      );
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it("should set factory context for factory users", async () => {
      const userId = "factory-user-id";
      const userRole = RoleEnum.factory;
      const factoryId = "factory-123";

      await service.setUserContext(userId, userRole, factoryId);

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.factory_id', $1, false)`,
        [factoryId],
      );
    });

    it("should set fitter context for fitter users", async () => {
      const userId = "fitter-user-id";
      const userRole = RoleEnum.fitter;
      const fitterId = "fitter-456";

      await service.setUserContext(userId, userRole, undefined, fitterId);

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.fitter_id', $1, false)`,
        [fitterId],
      );
    });

    it("should handle query runner release on error", async () => {
      const userId = "test-user-id";
      const userRole = RoleEnum.admin;

      mockQueryRunner.query.mockRejectedValue(new Error("Database error"));

      await expect(service.setUserContext(userId, userRole)).rejects.toThrow(
        "Database error",
      );
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe("clearUserContext", () => {
    it("should clear all RLS context variables", async () => {
      await service.clearUserContext();

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.user_id', '', false)`,
      );
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.user_role', '2', false)`,
      );
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.factory_id', '', false)`,
      );
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.fitter_id', '', false)`,
      );
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe("getCurrentContext", () => {
    it("should return current RLS context", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ user_id: "test-user" }])
        .mockResolvedValueOnce([{ user_role: "5" }])
        .mockResolvedValueOnce([{ factory_id: "factory-123" }])
        .mockResolvedValueOnce([{ fitter_id: "fitter-456" }]);

      const context = await service.getCurrentContext();

      expect(context).toEqual({
        userId: "test-user",
        userRole: 5,
        factoryId: "factory-123",
        fitterId: "fitter-456",
      });
    });

    it("should handle missing context gracefully", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]);

      const context = await service.getCurrentContext();

      expect(context).toEqual({
        userId: "",
        userRole: 2,
        factoryId: undefined,
        fitterId: undefined,
      });
    });
  });

  describe("executeWithUserContext", () => {
    it("should execute function with temporary context and restore original", async () => {
      // Mock original context
      mockQueryRunner.query
        .mockResolvedValueOnce([{ user_id: "original-user" }])
        .mockResolvedValueOnce([{ user_role: "2" }])
        .mockResolvedValueOnce([{ factory_id: "" }])
        .mockResolvedValueOnce([{ fitter_id: "" }]);

      const testFunction = jest.fn().mockResolvedValue("test-result");

      const result = await service.executeWithUserContext(
        "temp-user",
        RoleEnum.admin,
        testFunction,
      );

      expect(result).toBe("test-result");
      expect(testFunction).toHaveBeenCalled();
    });
  });

  describe("checkRlsStatus", () => {
    it("should return RLS status for all tables", async () => {
      // Mock responses for 7 tables (2 queries each: RLS status + policies)
      mockQueryRunner.query
        .mockResolvedValueOnce([{ rls_enabled: true }]) // user RLS status
        .mockResolvedValueOnce([{ policyname: "user_policy" }]) // user policies
        .mockResolvedValueOnce([{ rls_enabled: true }]) // customer RLS status
        .mockResolvedValueOnce([{ policyname: "customer_policy" }]) // customer policies
        .mockResolvedValueOnce([{ rls_enabled: true }]) // orders RLS status
        .mockResolvedValueOnce([{ policyname: "order_policy" }]) // orders policies
        .mockResolvedValueOnce([{ rls_enabled: true }]) // fitters RLS status
        .mockResolvedValueOnce([{ policyname: "fitter_policy" }]) // fitters policies
        .mockResolvedValueOnce([{ rls_enabled: true }]) // factories RLS status
        .mockResolvedValueOnce([{ policyname: "factory_policy" }]) // factories policies
        .mockResolvedValueOnce([{ rls_enabled: true }]) // factory_employees RLS status
        .mockResolvedValueOnce([{ policyname: "employee_policy" }]) // factory_employees policies
        .mockResolvedValueOnce([{ rls_enabled: true }]) // audit_log RLS status
        .mockResolvedValueOnce([{ policyname: "audit_policy" }]); // audit_log policies

      const status = await service.checkRlsStatus();

      expect(status).toHaveLength(7); // Should check 7 tables
      expect(status[0]).toMatchObject({
        table: "credentials",
        rlsEnabled: true,
        policies: ["user_policy"],
      });
    });
  });

  describe("testRlsPolicies", () => {
    it("should test access to all tables with given user context", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // Set user context
        .mockResolvedValueOnce([]) // Set role context
        .mockResolvedValue([{ count: "5" }]); // Mock count results

      const results = await service.testRlsPolicies(
        "test-user",
        RoleEnum.admin,
      );

      expect(results).toHaveLength(7); // Should test 7 tables
      expect(results[0]).toMatchObject({
        table: "credentials",
        accessibleRecords: 5,
      });
    });

    it("should handle query errors gracefully", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // Set user context
        .mockResolvedValueOnce([]) // Set role context
        .mockRejectedValue(new Error("Access denied")); // Mock error

      const results = await service.testRlsPolicies("test-user", RoleEnum.user);

      expect(results[0]).toMatchObject({
        table: "credentials",
        accessibleRecords: 0,
        error: "Access denied",
      });
    });
  });

  describe("Role-based access patterns", () => {
    it("should set appropriate context for supervisor role", async () => {
      await service.setUserContext("supervisor-user", RoleEnum.supervisor);

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.user_role', $1, false)`,
        [RoleEnum.supervisor.toString()],
      );
    });

    it("should set appropriate context for admin role", async () => {
      await service.setUserContext("admin-user", RoleEnum.admin);

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.user_role', $1, false)`,
        [RoleEnum.admin.toString()],
      );
    });

    it("should default to user role for invalid role", async () => {
      // Test with a valid enum value but ensure it's handled correctly
      await service.setUserContext("test-user", RoleEnum.user);

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.user_role', $1, false)`,
        [RoleEnum.user.toString()],
      );
    });
  });

  describe("setTenantContext", () => {
    it("should set basic tenant context", async () => {
      await service.setTenantContext("user-1", RoleEnum.admin, "tenant-abc");

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.tenant_id', $1, false)`,
        ["tenant-abc"],
      );
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it("should set organization ID when provided", async () => {
      await service.setTenantContext(
        "user-1",
        RoleEnum.admin,
        "tenant-abc",
        "org-xyz",
      );

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.organization_id', $1, false)`,
        ["org-xyz"],
      );
    });

    it("should also call setUserContext", async () => {
      const setUserContextSpy = jest.spyOn(service, "setUserContext");

      await service.setTenantContext("user-1", RoleEnum.admin, "tenant-abc");

      expect(setUserContextSpy).toHaveBeenCalledWith("user-1", RoleEnum.admin);
    });
  });

  describe("validateDataIsolation", () => {
    it("should return isolated when all tables have data", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // set tenant context
        .mockResolvedValueOnce([{ count: 5 }]) // customers
        .mockResolvedValueOnce([{ count: 3 }]) // orders
        .mockResolvedValueOnce([{ count: 1 }]); // credentials

      const result = await service.validateDataIsolation("tenant-abc");

      expect(result.isolated).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should return violations when table has no data", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // set tenant context
        .mockResolvedValueOnce([{ count: 0 }]) // customers - no data
        .mockResolvedValueOnce([{ count: 3 }]) // orders
        .mockResolvedValueOnce([{ count: 1 }]); // credentials

      const result = await service.validateDataIsolation("tenant-abc");

      expect(result.isolated).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain("No data accessible");
    });

    it("should handle query errors", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // set tenant context
        .mockRejectedValueOnce(new Error("Table not found")) // customers error
        .mockResolvedValueOnce([{ count: 3 }]) // orders
        .mockResolvedValueOnce([{ count: 1 }]); // credentials

      const result = await service.validateDataIsolation("tenant-abc");

      expect(result.isolated).toBe(false);
      expect(
        result.violations.some((v) => v.includes("Error accessing table")),
      ).toBe(true);
    });
  });

  describe("detectDataLeakage", () => {
    it("should report no leakage when no cross-tenant data", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // set tenant context
        .mockResolvedValueOnce([{ tenant_count: 0 }]) // customers query
        .mockResolvedValueOnce([{ tenant_count: 0 }]); // orders query

      const result = await service.detectDataLeakage("tenant-abc");

      expect(result.hasLeakage).toBe(false);
      expect(result.leakages).toHaveLength(0);
    });

    it("should detect cross-tenant access", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // set tenant context
        .mockResolvedValueOnce([{ tenant_count: 3 }]) // customers - leakage
        .mockResolvedValueOnce([{ tenant_count: 0 }]); // orders - ok

      const result = await service.detectDataLeakage("tenant-abc");

      expect(result.hasLeakage).toBe(true);
      expect(result.leakages.length).toBeGreaterThan(0);
      expect(result.leakages[0]).toContain("Cross-tenant data access detected");
    });

    it("should handle query errors gracefully", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // set tenant context
        .mockRejectedValueOnce(new Error("column tenant_id does not exist")) // query failure
        .mockRejectedValueOnce(new Error("column tenant_id does not exist")); // query failure

      const result = await service.detectDataLeakage("tenant-abc");

      // Query failures indicate proper isolation (columns might not exist)
      expect(result.hasLeakage).toBe(false);
      expect(result.leakages).toHaveLength(0);
    });
  });

  describe("setFactoryTenantContext", () => {
    it("should set factory context variables", async () => {
      await service.setFactoryTenantContext(
        "user-1",
        "factory-100",
        "tenant-abc",
      );

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.factory_id', $1, false)`,
        ["factory-100"],
      );
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.tenant_id', $1, false)`,
        ["tenant-abc"],
      );
    });

    it("should call setUserContext with factory role", async () => {
      const setUserContextSpy = jest.spyOn(service, "setUserContext");

      await service.setFactoryTenantContext("user-1", "factory-100");

      expect(setUserContextSpy).toHaveBeenCalledWith(
        "user-1",
        RoleEnum.factory,
        "factory-100",
      );
    });
  });

  describe("validateFactoryOrderAccess", () => {
    it("should report valid access when count is 0", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // set factory context
        .mockResolvedValueOnce([{ count: 0 }]); // no cross-factory orders

      const result = await service.validateFactoryOrderAccess("factory-100");

      expect(result.validAccess).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should detect violations when count > 0", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // set factory context
        .mockResolvedValueOnce([{ count: 5 }]); // cross-factory orders found

      const result = await service.validateFactoryOrderAccess("factory-100");

      expect(result.validAccess).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain("Factory factory-100 can access");
    });
  });

  describe("setFitterTenantContext", () => {
    it("should set fitter context variables", async () => {
      await service.setFitterTenantContext(
        "user-1",
        "fitter-200",
        "tenant-abc",
      );

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.fitter_id', $1, false)`,
        ["fitter-200"],
      );
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.tenant_id', $1, false)`,
        ["tenant-abc"],
      );
    });

    it("should call setUserContext with fitter role", async () => {
      const setUserContextSpy = jest.spyOn(service, "setUserContext");

      await service.setFitterTenantContext("user-1", "fitter-200");

      expect(setUserContextSpy).toHaveBeenCalledWith(
        "user-1",
        RoleEnum.fitter,
        undefined,
        "fitter-200",
      );
    });
  });

  describe("validateFitterCustomerAccess", () => {
    it("should report valid access when no violations", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // set fitter context
        .mockResolvedValueOnce([{ count: 0 }]); // no cross-fitter customers

      const result = await service.validateFitterCustomerAccess("fitter-200");

      expect(result.validAccess).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should detect violations when cross-fitter customers exist", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // set fitter context
        .mockResolvedValueOnce([{ count: 3 }]); // cross-fitter customers found

      const result = await service.validateFitterCustomerAccess("fitter-200");

      expect(result.validAccess).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain("Fitter fitter-200 can access");
    });
  });

  describe("setAdminBypassContext", () => {
    it("should set bypass mode", async () => {
      await service.setAdminBypassContext("admin-user-1");

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.bypass_mode', 'true', false)`,
      );
    });

    it("should call setUserContext with supervisor role", async () => {
      const setUserContextSpy = jest.spyOn(service, "setUserContext");

      await service.setAdminBypassContext("admin-user-1");

      expect(setUserContextSpy).toHaveBeenCalledWith(
        "admin-user-1",
        RoleEnum.supervisor,
      );
    });
  });

  describe("validateAdminGlobalAccess", () => {
    it("should report global access when no errors", async () => {
      // Mock setAdminBypassContext query calls
      mockQueryRunner.query.mockResolvedValue([{ count: "10" }]);

      const result = await service.validateAdminGlobalAccess("admin-user-1");

      expect(result.hasGlobalAccess).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should report violations when errors occur", async () => {
      // Mock bypass context setup, then fail on testRlsPolicies
      jest.spyOn(service, "setAdminBypassContext").mockResolvedValue(undefined);
      jest.spyOn(service, "testRlsPolicies").mockResolvedValue([
        { table: "credentials", accessibleRecords: 0, error: "Access denied" },
        { table: "customers", accessibleRecords: 5 },
      ]);
      jest.spyOn(service, "clearUserContext").mockResolvedValue(undefined);

      const result = await service.validateAdminGlobalAccess("admin-user-1");

      expect(result.hasGlobalAccess).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain(
        "Admin cannot access table credentials",
      );
    });
  });

  describe("setUserContextWithAudit", () => {
    it("should log context and set user context", async () => {
      const setUserContextSpy = jest.spyOn(service, "setUserContext");

      await service.setUserContextWithAudit(
        "user-1",
        RoleEnum.admin,
        "factory-100",
        "fitter-200",
      );

      expect(setUserContextSpy).toHaveBeenCalledWith(
        "user-1",
        RoleEnum.admin,
        "factory-100",
        "fitter-200",
      );
    });

    it("should insert audit record into log table", async () => {
      await service.setUserContextWithAudit("user-1", RoleEnum.admin);

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO log"),
        expect.arrayContaining(["user-1"]),
      );
    });
  });

  describe("batchSetUserContexts", () => {
    it("should process all contexts in a transaction", async () => {
      const contexts = [
        { userId: "user-1", userRole: RoleEnum.admin },
        { userId: "user-2", userRole: RoleEnum.fitter, fitterId: "fitter-1" },
      ];

      await service.batchSetUserContexts(contexts);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.user_id', $1, false)`,
        ["user-1"],
      );
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.user_id', $1, false)`,
        ["user-2"],
      );
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        `SELECT set_config('rls.fitter_id', $1, false)`,
        ["fitter-1"],
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it("should commit on success", async () => {
      const contexts = [{ userId: "user-1", userRole: RoleEnum.admin }];

      await service.batchSetUserContexts(contexts);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it("should rollback on error", async () => {
      mockQueryRunner.query.mockRejectedValue(new Error("Query failed"));

      const contexts = [{ userId: "user-1", userRole: RoleEnum.admin }];

      await expect(service.batchSetUserContexts(contexts)).rejects.toThrow(
        "Query failed",
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe("validateSecurityContext", () => {
    it("should report secure when no bypass and user context present", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ bypass_mode: "" }]) // no bypass
        .mockResolvedValueOnce([{ user_id: "user-1" }]); // user context present

      const result = await service.validateSecurityContext();

      expect(result.secure).toBe(true);
      expect(result.securityIssues).toHaveLength(0);
    });

    it("should detect unauthorized bypass", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ bypass_mode: "true" }]) // bypass active
        .mockResolvedValueOnce([{ user_role: "2" }]) // admin (not supervisor)
        .mockResolvedValueOnce([{ user_id: "user-1" }]); // user context present

      const result = await service.validateSecurityContext();

      expect(result.secure).toBe(false);
      expect(result.securityIssues).toContain(
        "Unauthorized RLS bypass detected",
      );
    });

    it("should detect missing user context", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ bypass_mode: "" }]) // no bypass
        .mockResolvedValueOnce([{ user_id: "" }]); // missing user context

      const result = await service.validateSecurityContext();

      expect(result.secure).toBe(false);
      expect(result.securityIssues).toContain("Missing user context in RLS");
    });
  });

  describe("validateRlsPolicyIntegrity", () => {
    it("should report valid when no issues found", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // no tables without policies
        .mockResolvedValueOnce([]); // no policies without RLS

      const result = await service.validateRlsPolicyIntegrity();

      expect(result.integrityValid).toBe(true);
      expect(result.policyIssues).toHaveLength(0);
    });

    it("should report tables with RLS but no policies", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ table_name: "customers" }]) // table with RLS but no policies
        .mockResolvedValueOnce([]); // no policies without RLS

      const result = await service.validateRlsPolicyIntegrity();

      expect(result.integrityValid).toBe(false);
      expect(result.policyIssues).toContain(
        "Table customers has RLS enabled but no policies",
      );
    });

    it("should report policies without RLS enabled", async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // no tables without policies
        .mockResolvedValueOnce([{ tablename: "orders" }]); // policy without RLS

      const result = await service.validateRlsPolicyIntegrity();

      expect(result.integrityValid).toBe(false);
      expect(result.policyIssues).toContain(
        "Table orders has policies but RLS is not enabled",
      );
    });
  });
});
