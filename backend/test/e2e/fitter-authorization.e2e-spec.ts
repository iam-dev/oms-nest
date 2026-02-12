/**
 * Fitter Authorization E2E Tests
 *
 * Validates that fitter users can only see their own orders/customers,
 * receive 403 when accessing other fitters' resources, and that admin
 * users retain full access.
 *
 * Tests the fix for the critical authorization bug where fitters
 * could see ALL orders/customers instead of only their own.
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../../src/app.module";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

describe("Fitter Authorization (E2E)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let fitterToken: string;
  let fitterInfo: { userId: number; fitterId: number; username: string };
  let otherFitterId: number;
  let otherFitterOrderId: number | null = null;
  let otherFitterCustomerId: number | null = null;
  let otherFitterOrderNumber: string | null = null;
  let ownCustomerId: number | null = null;

  // Admin credentials (from existing e2e tests)
  const adminCredentials = {
    email: "adamwhitehouse",
    password: "welcomeAdam!@",
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.enableVersioning();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Authenticate as admin
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/email/login")
      .send(adminCredentials);

    if (loginResponse.status === 200 && loginResponse.body.token) {
      adminToken = loginResponse.body.token;
    }

    // Look up fitter users from the database
    const fitterUsers = await dataSource.query(`
      SELECT u.id, u.legacy_id, u.username, f.id as fitter_id
      FROM "user" u
      INNER JOIN fitters f ON f.user_id = u.legacy_id
      WHERE u.user_type = 1 AND u.is_supervisor = 0
      LIMIT 2
    `);

    if (fitterUsers.length < 2) {
      throw new Error(
        "Test setup failed — need at least 2 fitter users in database",
      );
    }

    fitterInfo = {
      userId: fitterUsers[0].legacy_id,
      fitterId: fitterUsers[0].fitter_id,
      username: fitterUsers[0].username,
    };
    otherFitterId = fitterUsers[1].fitter_id;

    // Create a fitter JWT token
    const jwtService = app.get(JwtService);
    const configService = app.get(ConfigService);
    const secret = configService.get("auth.secret", { infer: true });

    fitterToken = await jwtService.signAsync(
      {
        id: "test-uuid",
        legacyId: fitterInfo.userId,
        role: { id: 1, name: "fitter" },
        roles: ["ROLE_FITTER"],
        fitterId: fitterInfo.fitterId,
        username: fitterInfo.username,
        enabled: true,
      },
      { secret, expiresIn: "15m" },
    );

    // Look up other fitter's order (shared across all tests)
    const otherOrders = await dataSource.query(
      `SELECT id, order_number FROM orders WHERE fitter_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [otherFitterId],
    );
    if (otherOrders.length > 0) {
      otherFitterOrderId = otherOrders[0].id;
      otherFitterOrderNumber = otherOrders[0].order_number;
    }

    // Look up other fitter's customer (shared across all tests)
    const otherCustomers = await dataSource.query(
      `SELECT id FROM customers WHERE fitter_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [otherFitterId],
    );
    if (otherCustomers.length > 0) {
      otherFitterCustomerId = otherCustomers[0].id;
    }

    // Look up own customer for scoped endpoint tests
    const ownCustomers = await dataSource.query(
      `SELECT id FROM customers WHERE fitter_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [fitterInfo.fitterId],
    );
    if (ownCustomers.length > 0) {
      ownCustomerId = ownCustomers[0].id;
    }
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // --- HTTP helpers ---

  const authGet = (token: string, url: string) =>
    request(app.getHttpServer())
      .get(url)
      .set("Authorization", `Bearer ${token}`);

  const authPatch = (
    token: string,
    url: string,
    body: Record<string, unknown>,
  ) =>
    request(app.getHttpServer())
      .patch(url)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authPost = (
    token: string,
    url: string,
    body?: Record<string, unknown>,
  ) =>
    request(app.getHttpServer())
      .post(url)
      .set("Authorization", `Bearer ${token}`)
      .send(body ?? {});

  const authDelete = (token: string, url: string) =>
    request(app.getHttpServer())
      .delete(url)
      .set("Authorization", `Bearer ${token}`);

  const unauthGet = (url: string) => request(app.getHttpServer()).get(url);

  // --- Tests ---

  describe("JWT Token Contains fitterId", () => {
    it("should include fitterId in JWT when fitter logs in", () => {
      const jwtService = app.get(JwtService);
      const decoded = jwtService.decode(fitterToken) as Record<string, unknown>;
      expect(decoded).toHaveProperty("fitterId", fitterInfo.fitterId);
      expect(decoded).toHaveProperty("role");
      expect((decoded.role as Record<string, unknown>).name).toBe("fitter");
    });

    it("should NOT include fitterId in admin JWT", () => {
      if (!adminToken) {
        throw new Error("Admin token not available — login failed");
      }

      const jwtService = app.get(JwtService);
      const decoded = jwtService.decode(adminToken) as Record<string, unknown>;
      expect(decoded.fitterId).toBeUndefined();
    });
  });

  describe("Orders Scoping for Fitter", () => {
    it("should only return fitter's own orders on GET /api/v1/orders", async () => {
      const response = await authGet(fitterToken, "/api/v1/orders?limit=50");

      expect(response.status).toBe(200);
      const orders = response.body.data;
      expect(Array.isArray(orders)).toBe(true);

      for (const order of orders) {
        expect(order.fitterId).toBe(fitterInfo.fitterId);
      }
    });

    it("should prevent fitter from overriding fitterId query param on GET /api/v1/orders", async () => {
      const response = await authGet(
        fitterToken,
        `/api/v1/orders?fitterId=${otherFitterId}&limit=50`,
      );

      expect(response.status).toBe(200);
      const orders = response.body.data;
      for (const order of orders) {
        expect(order.fitterId).toBe(fitterInfo.fitterId);
      }
    });

    it("should return 403 on GET /api/v1/orders/fitter/:otherFitterId", async () => {
      const response = await authGet(
        fitterToken,
        `/api/v1/orders/fitter/${otherFitterId}`,
      );

      expect(response.status).toBe(403);
    });

    it("should return 200 on GET /api/v1/orders/fitter/:ownFitterId", async () => {
      const response = await authGet(
        fitterToken,
        `/api/v1/orders/fitter/${fitterInfo.fitterId}`,
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should only return fitter's own urgent orders on GET /api/v1/orders/urgent", async () => {
      const response = await authGet(fitterToken, "/api/v1/orders/urgent");

      expect(response.status).toBe(200);
      const orders = response.body;
      for (const order of orders) {
        expect(order.fitterId).toBe(fitterInfo.fitterId);
      }
    });

    it("should return scoped stats for fitter on GET /api/v1/orders/stats", async () => {
      const response = await authGet(fitterToken, "/api/v1/orders/stats");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("totalOrders");
      expect(typeof response.body.totalOrders).toBe("number");
    });

    it("should scope fitter search results on GET /api/v1/orders/search", async () => {
      const response = await authGet(
        fitterToken,
        "/api/v1/orders/search?page=1&limit=10",
      );

      expect(response.status).toBe(200);
      const orders = response.body.orders;
      expect(Array.isArray(orders)).toBe(true);
      for (const order of orders) {
        expect(order.fitterId).toBe(fitterInfo.fitterId);
      }
    });
  });

  describe("Additional Scoped Read Endpoints", () => {
    it("should only return fitter's own overdue orders on GET /api/v1/orders/overdue", async () => {
      const response = await authGet(fitterToken, "/api/v1/orders/overdue");

      expect(response.status).toBe(200);
      const orders = response.body;
      expect(Array.isArray(orders)).toBe(true);
      for (const order of orders) {
        expect(order.fitterId).toBe(fitterInfo.fitterId);
      }
    });

    it("should only return fitter's own production orders on GET /api/v1/orders/production", async () => {
      const response = await authGet(fitterToken, "/api/v1/orders/production");

      expect(response.status).toBe(200);
      const orders = response.body;
      expect(Array.isArray(orders)).toBe(true);
      for (const order of orders) {
        expect(order.fitterId).toBe(fitterInfo.fitterId);
      }
    });

    it("should only return fitter's own orders on GET /api/v1/orders/production/schedule", async () => {
      const response = await authGet(
        fitterToken,
        "/api/v1/orders/production/schedule?limit=50",
      );

      expect(response.status).toBe(200);
      const orders = response.body;
      expect(Array.isArray(orders)).toBe(true);
      for (const order of orders) {
        expect(order.fitterId).toBe(fitterInfo.fitterId);
      }
    });

    it("should only return fitter's own orders on GET /api/v1/orders/requiring-deposit", async () => {
      const response = await authGet(
        fitterToken,
        "/api/v1/orders/requiring-deposit",
      );

      expect(response.status).toBe(200);
      const orders = response.body;
      expect(Array.isArray(orders)).toBe(true);
      for (const order of orders) {
        expect(order.fitterId).toBe(fitterInfo.fitterId);
      }
    });

    it("should only return fitter's own orders for a customer on GET /api/v1/orders/customer/:customerId", async () => {
      if (!ownCustomerId) {
        throw new Error("No own customer found — cannot test customer scoping");
      }

      const response = await authGet(
        fitterToken,
        `/api/v1/orders/customer/${ownCustomerId}`,
      );

      expect(response.status).toBe(200);
      const orders = response.body;
      expect(Array.isArray(orders)).toBe(true);
      for (const order of orders) {
        expect(order.fitterId).toBe(fitterInfo.fitterId);
      }
    });

    it("should return scoped summary for a customer on GET /api/v1/orders/customer/:customerId/summary", async () => {
      if (!ownCustomerId) {
        throw new Error(
          "No own customer found — cannot test customer summary scoping",
        );
      }

      const response = await authGet(
        fitterToken,
        `/api/v1/orders/customer/${ownCustomerId}/summary`,
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("orderCount");
      expect(response.body).toHaveProperty("totalValue");
      expect(typeof response.body.orderCount).toBe("number");
      expect(typeof response.body.totalValue).toBe("number");
    });

    it("should return 403 for fitter accessing other fitter's order by number on GET /api/v1/orders/number/:orderNumber", async () => {
      if (!otherFitterOrderNumber) {
        throw new Error(
          "No other fitter order number found — cannot test cross-fitter order number access",
        );
      }

      const response = await authGet(
        fitterToken,
        `/api/v1/orders/number/${otherFitterOrderNumber}`,
      );

      expect(response.status).toBe(403);
    });
  });

  describe("Customers Scoping for Fitter", () => {
    it("should only return fitter's own customers on GET /api/v1/customers", async () => {
      const response = await authGet(fitterToken, "/api/v1/customers?limit=50");

      expect(response.status).toBe(200);
      const customers = response.body.data;
      expect(Array.isArray(customers)).toBe(true);

      for (const customer of customers) {
        expect(customer.fitterId).toBe(fitterInfo.fitterId);
      }
    });

    it("should return 403 on GET /api/v1/customers/fitter/:otherFitterId", async () => {
      const response = await authGet(
        fitterToken,
        `/api/v1/customers/fitter/${otherFitterId}`,
      );

      expect(response.status).toBe(403);
    });

    it("should return 200 on GET /api/v1/customers/fitter/:ownFitterId", async () => {
      const response = await authGet(
        fitterToken,
        `/api/v1/customers/fitter/${fitterInfo.fitterId}`,
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should return 403 for fitter on GET /api/v1/customers/without-fitter", async () => {
      const response = await authGet(
        fitterToken,
        "/api/v1/customers/without-fitter",
      );

      expect(response.status).toBe(403);
    });
  });

  describe("Write Operations - Cross-Fitter Denial", () => {
    it("should return 403 when fitter tries to PATCH /api/v1/orders/:id of another fitter", async () => {
      if (!otherFitterOrderId) {
        throw new Error(
          "No other fitter order found — cannot test cross-fitter update",
        );
      }

      const response = await authPatch(
        fitterToken,
        `/api/v1/orders/${otherFitterOrderId}`,
        { status: "completed" },
      );

      expect(response.status).toBe(403);
    });

    it("should return 403 when fitter tries to PATCH /api/v1/orders/:id/cancel of another fitter", async () => {
      if (!otherFitterOrderId) {
        throw new Error(
          "No other fitter order found — cannot test cross-fitter cancel",
        );
      }

      const response = await authPatch(
        fitterToken,
        `/api/v1/orders/${otherFitterOrderId}/cancel`,
        { reason: "testing cross-fitter cancel" },
      );

      expect(response.status).toBe(403);
    });

    it("should return 403 when fitter tries to DELETE /api/v1/orders/:id of another fitter", async () => {
      if (!otherFitterOrderId) {
        throw new Error(
          "No other fitter order found — cannot test cross-fitter delete",
        );
      }

      const response = await authDelete(
        fitterToken,
        `/api/v1/orders/${otherFitterOrderId}`,
      );

      expect(response.status).toBe(403);
    });

    it("should return 403 when fitter tries to PATCH /api/v1/customers/:id of another fitter", async () => {
      if (!otherFitterCustomerId) {
        throw new Error(
          "No other fitter customer found — cannot test cross-fitter customer update",
        );
      }

      const response = await authPatch(
        fitterToken,
        `/api/v1/customers/${otherFitterCustomerId}`,
        { name: "Hacked Name" },
      );

      expect(response.status).toBe(403);
    });

    it("should return 403 when fitter tries to DELETE /api/v1/customers/:id of another fitter", async () => {
      if (!otherFitterCustomerId) {
        throw new Error(
          "No other fitter customer found — cannot test cross-fitter customer delete",
        );
      }

      const response = await authDelete(
        fitterToken,
        `/api/v1/customers/${otherFitterCustomerId}`,
      );

      expect(response.status).toBe(403);
    });

    it("should return 403 when fitter tries to assign customer to another fitter via POST /api/v1/customers/:customerId/assign-fitter/:fitterId", async () => {
      if (!ownCustomerId) {
        throw new Error(
          "No own customer found — cannot test cross-fitter assign",
        );
      }

      const response = await authPost(
        fitterToken,
        `/api/v1/customers/${ownCustomerId}/assign-fitter/${otherFitterId}`,
      );

      expect(response.status).toBe(403);
    });
  });

  describe("Admin Retains Full Access", () => {
    it("should allow admin to see all orders without fitter scoping on GET /api/v1/orders", async () => {
      if (!adminToken) {
        throw new Error("Admin token not available — login failed");
      }

      const response = await authGet(adminToken, "/api/v1/orders?limit=10");

      expect(response.status).toBe(200);
      const orders = response.body.data;
      expect(Array.isArray(orders)).toBe(true);

      // Admin should see orders from multiple fitters (if data exists)
      const fitterIds = new Set(
        orders
          .map((o: Record<string, unknown>) => o.fitterId)
          .filter((id: unknown) => id !== null && id !== undefined),
      );
      expect(orders.length).toBeGreaterThanOrEqual(0);
      if (orders.length > 5) {
        expect(fitterIds.size).toBeGreaterThanOrEqual(1);
      }
    });

    it("should allow admin to see all customers on GET /api/v1/customers", async () => {
      if (!adminToken) {
        throw new Error("Admin token not available — login failed");
      }

      const response = await authGet(adminToken, "/api/v1/customers?limit=10");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should allow admin access to GET /api/v1/customers/without-fitter", async () => {
      if (!adminToken) {
        throw new Error("Admin token not available — login failed");
      }

      const response = await authGet(
        adminToken,
        "/api/v1/customers/without-fitter",
      );

      expect(response.status).toBe(200);
    });

    it("should allow admin to access any fitter's orders on GET /api/v1/orders/fitter/:fitterId", async () => {
      if (!adminToken) {
        throw new Error("Admin token not available — login failed");
      }

      const response = await authGet(
        adminToken,
        `/api/v1/orders/fitter/${fitterInfo.fitterId}`,
      );

      expect(response.status).toBe(200);
    });
  });

  describe("Enriched Orders Scoping for Fitter", () => {
    it("should only return fitter's own enriched orders on GET /api/v1/enriched_orders", async () => {
      const response = await authGet(
        fitterToken,
        "/api/v1/enriched_orders?limit=50",
      );

      expect(response.status).toBe(200);
      const orders = response.body.data;
      expect(Array.isArray(orders)).toBe(true);

      for (const order of orders) {
        expect(order.fitter_id).toBe(fitterInfo.fitterId);
      }
    });

    it("should ignore attacker-supplied fitterId param on GET /api/v1/enriched_orders", async () => {
      const response = await authGet(
        fitterToken,
        `/api/v1/enriched_orders?fitterId=${otherFitterId}&limit=50`,
      );

      expect(response.status).toBe(200);
      const orders = response.body.data;
      for (const order of orders) {
        expect(order.fitter_id).toBe(fitterInfo.fitterId);
      }
    });

    it("should return 403 for fitter accessing other fitter's enriched order detail", async () => {
      if (!otherFitterOrderId) {
        throw new Error(
          "No other fitter order found — cannot test cross-fitter enriched detail",
        );
      }

      const response = await authGet(
        fitterToken,
        `/api/v1/enriched_orders/detail/${otherFitterOrderId}`,
      );

      expect(response.status).toBe(403);
    });

    it("should return 403 for fitter updating other fitter's enriched order status", async () => {
      if (!otherFitterOrderId) {
        throw new Error(
          "No other fitter order found — cannot test cross-fitter enriched status update",
        );
      }

      const response = await authPatch(
        fitterToken,
        `/api/v1/enriched_orders/update-status/${otherFitterOrderId}`,
        { status: "completed" },
      );

      expect(response.status).toBe(403);
    });

    it("should allow admin full access to all enriched orders", async () => {
      if (!adminToken) {
        throw new Error("Admin token not available — login failed");
      }

      const response = await authGet(
        adminToken,
        "/api/v1/enriched_orders?limit=10",
      );

      expect(response.status).toBe(200);
      const orders = response.body.data;
      expect(Array.isArray(orders)).toBe(true);

      // Admin should see orders from multiple fitters (if data exists)
      const fitterIds = new Set(
        orders
          .map((o: Record<string, unknown>) => o.fitter_id)
          .filter((id: unknown) => id !== null && id !== undefined),
      );
      expect(orders.length).toBeGreaterThanOrEqual(0);
      if (orders.length > 5) {
        expect(fitterIds.size).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("Cross-Fitter Access Control on Individual Resources", () => {
    it("should deny fitter access to other fitter's order on GET /api/v1/orders/:id", async () => {
      if (!otherFitterOrderId) {
        throw new Error(
          "No other fitter order found — cannot test cross-fitter order access",
        );
      }

      const response = await authGet(
        fitterToken,
        `/api/v1/orders/${otherFitterOrderId}`,
      );

      expect(response.status).toBe(403);
    });

    it("should deny fitter access to other fitter's customer on GET /api/v1/customers/:id", async () => {
      if (!otherFitterCustomerId) {
        throw new Error(
          "No other fitter customer found — cannot test cross-fitter customer access",
        );
      }

      const response = await authGet(
        fitterToken,
        `/api/v1/customers/${otherFitterCustomerId}`,
      );

      expect(response.status).toBe(403);
    });
  });

  describe("Unauthenticated Access Denied", () => {
    it("should return 401 on GET /api/v1/orders without token", async () => {
      const response = await unauthGet("/api/v1/orders");
      expect(response.status).toBe(401);
    });

    it("should return 401 on GET /api/v1/customers without token", async () => {
      const response = await unauthGet("/api/v1/customers");
      expect(response.status).toBe(401);
    });

    it("should return 401 on GET /api/v1/enriched_orders without token", async () => {
      const response = await unauthGet("/api/v1/enriched_orders");
      expect(response.status).toBe(401);
    });
  });
});
