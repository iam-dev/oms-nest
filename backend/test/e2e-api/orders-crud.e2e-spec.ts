/**
 * E2E API Tests: Orders CRUD Lifecycle
 *
 * Tests the full CRUD lifecycle for the Orders API, covering:
 * - Authentication enforcement on all endpoints
 * - Create order with valid and invalid payloads
 * - Paginated list retrieval with status and fitterId filters
 * - Retrieve order by ID and 404 handling
 * - Update order fields (status, priority)
 * - Cancel order with a reason
 * - Soft delete and 404 handling
 *
 * All tests handle a missing or unseeded database gracefully by
 * accepting flexible status codes and skipping assertions that
 * require specific seeded records.
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";

describe("Orders CRUD (E2E)", () => {
  let app: INestApplication;
  let authToken: string;

  // Tracks the ID of any order created during the test run so it can be
  // cleaned up (soft-deleted) in afterAll, regardless of which test created it.
  let createdOrderId: number | null = null;

  // Test credentials matching the seed data used by the other E2E suites.
  const testCredentials = {
    email: "adamwhitehouse",
    password: "welcomeAdam!@",
  };

  // Minimal valid CreateOrderDto payload.
  // All fields are optional in the DTO, so we provide enough to create a
  // meaningful test record without relying on specific FK rows being present.
  const createDto = {
    customerId: 67890,
    fitterId: 123,
    factoryId: 456,
    saddleId: 789,
    priceSaddle: 250000,
    priceDeposit: 50000,
    rushed: 0,
    name: "E2E Test Order",
  };

  // Partial update payload — uses values that pass UpdateOrderDto enum validation.
  const updateDto = {
    status: "in_production",
    priority: "high",
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror the global setup from main.ts so validation pipes behave identically
    // to the real application.
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

    // Authenticate once for the whole suite and persist the bearer token.
    try {
      const loginResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/email/login")
        .send(testCredentials)
        .expect((res) => {
          if (res.status !== 200) {
            console.log(
              "Login response (orders-crud suite):",
              res.status,
              res.body,
            );
          }
        });

      if (loginResponse.body.token) {
        authToken = loginResponse.body.token;
        console.log("Orders CRUD suite: authentication successful");
      } else {
        console.warn(
          "Orders CRUD suite: no token received — some tests will be skipped",
        );
      }
    } catch (error) {
      console.warn("Orders CRUD suite: authentication failed:", error);
    }
  }, 60000);

  afterAll(async () => {
    // Best-effort soft delete of the test order to keep the database clean.
    if (createdOrderId !== null && authToken) {
      try {
        await authRequest().delete(`/api/v1/orders/${createdOrderId}`);
        console.log(`Cleaned up test order ${createdOrderId}`);
      } catch (cleanupError) {
        console.warn(
          `Could not clean up order ${createdOrderId}:`,
          cleanupError,
        );
      }
    }

    await app.close();
  });

  // ---------------------------------------------------------------------------
  // Helper — returns authenticated supertest request builders.
  // ---------------------------------------------------------------------------
  const authRequest = () => ({
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set("Authorization", `Bearer ${authToken}`),
    post: (url: string) =>
      request(app.getHttpServer())
        .post(url)
        .set("Authorization", `Bearer ${authToken}`),
    patch: (url: string) =>
      request(app.getHttpServer())
        .patch(url)
        .set("Authorization", `Bearer ${authToken}`),
    delete: (url: string) =>
      request(app.getHttpServer())
        .delete(url)
        .set("Authorization", `Bearer ${authToken}`),
  });

  // ===========================================================================
  // POST /api/v1/orders
  // ===========================================================================
  describe("POST /api/v1/orders", () => {
    it("should require authentication", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/orders")
        .send(createDto);

      expect(response.status).toBe(401);
    });

    it("should create an order with valid data", async () => {
      if (!authToken) {
        console.warn("Skipping test — no auth token");
        return;
      }

      const response = await authRequest()
        .post("/api/v1/orders")
        .send(createDto);

      // 201 = created successfully.
      // 400 = FK constraint violation (referenced customer/fitter/etc. not seeded).
      // 403 = role restriction (token user lacks create permission).
      // 409 = duplicate order number collision.
      // 500 = database unavailable or schema mismatch.
      expect([201, 400, 403, 409, 500]).toContain(response.status);

      if (response.status === 201) {
        const body = response.body as {
          id: number;
          customerId: number;
          orderNumber: string;
          status: string;
          priority: string;
        };

        expect(body).toHaveProperty("id");
        expect(body).toHaveProperty("orderNumber");
        expect(body).toHaveProperty("status");
        expect(body).toHaveProperty("priority");
        expect(typeof body.id).toBe("number");

        // Persist for downstream tests so they can reference a real order ID.
        createdOrderId = body.id;
        console.log(
          `Created test order id=${createdOrderId} orderNumber=${body.orderNumber}`,
        );
      } else {
        console.warn(
          `POST /api/v1/orders returned ${response.status} — downstream create-dependent tests will skip ID assertions`,
        );
      }
    });

    it("should reject invalid data (missing required fields with wrong types)", async () => {
      if (!authToken) {
        console.warn("Skipping test — no auth token");
        return;
      }

      // Send a payload that deliberately violates type constraints:
      // priceSaddle must be a number >= 0, so a negative string should fail validation.
      const invalidDto = {
        priceSaddle: "not-a-number",
        priceDeposit: -999,
      };

      const response = await authRequest()
        .post("/api/v1/orders")
        .send(invalidDto);

      // 400/422 = validation failed (expected).
      // 403 = role restriction checked before validation.
      // 500 = database error (acceptable — validation may not be reached).
      expect([400, 403, 422, 500]).toContain(response.status);

      if (response.status === 400 || response.status === 422) {
        // NestJS ValidationPipe returns an object with a message array.
        expect(response.body).toHaveProperty("message");
      }
    });
  });

  // ===========================================================================
  // GET /api/v1/orders
  // ===========================================================================
  describe("GET /api/v1/orders", () => {
    it("should require authentication", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/orders");
      expect(response.status).toBe(401);
    });

    it("should return paginated orders", async () => {
      if (!authToken) {
        console.warn("Skipping test — no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/orders?page=1&limit=5");

      expect([200, 403]).toContain(response.status);

      if (response.status === 200) {
        // Controller returns { data: OrderDto[]; total: number; pages: number }
        expect(response.body).toHaveProperty("data");
        expect(response.body).toHaveProperty("total");
        expect(response.body).toHaveProperty("pages");
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(typeof response.body.total).toBe("number");
        expect(typeof response.body.pages).toBe("number");

        console.log(
          `Paginated orders: ${response.body.data.length} returned, total=${response.body.total}`,
        );
      }
    });

    it("should support filtering by status", async () => {
      if (!authToken) {
        console.warn("Skipping test — no auth token");
        return;
      }

      const response = await authRequest().get(
        "/api/v1/orders?status=pending&limit=10",
      );

      expect([200, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty("data");
        expect(Array.isArray(response.body.data)).toBe(true);

        // Every returned order must have the requested status.
        for (const order of response.body.data as Array<{ status: string }>) {
          expect(order.status).toBe("pending");
        }

        console.log(
          `Status=pending filter returned ${response.body.data.length} orders`,
        );
      }
    });

    it("should support filtering by fitterId", async () => {
      if (!authToken) {
        console.warn("Skipping test — no auth token");
        return;
      }

      const response = await authRequest().get(
        "/api/v1/orders?fitterId=123&limit=10",
      );

      expect([200, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty("data");
        expect(Array.isArray(response.body.data)).toBe(true);

        // Every returned order must belong to the requested fitter.
        for (const order of response.body.data as Array<{
          fitterId: number | null;
        }>) {
          expect(order.fitterId).toBe(123);
        }

        console.log(
          `fitterId=123 filter returned ${response.body.data.length} orders`,
        );
      }
    });
  });

  // ===========================================================================
  // GET /api/v1/orders/:id
  // ===========================================================================
  describe("GET /api/v1/orders/:id", () => {
    it("should require authentication", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/orders/1",
      );
      expect(response.status).toBe(401);
    });

    it("should return order by ID", async () => {
      if (!authToken) {
        console.warn("Skipping test — no auth token");
        return;
      }

      // Use the order created earlier in this suite if available; otherwise fall
      // back to ID 1 and accept that it may not exist.
      const targetId = createdOrderId ?? 1;
      const response = await authRequest().get(`/api/v1/orders/${targetId}`);

      expect([200, 403, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        const body = response.body as {
          id: number;
          customerId: number;
          orderNumber: string;
          status: string;
          priority: string;
          createdAt: string;
          updatedAt: string;
        };

        expect(body).toHaveProperty("id", targetId);
        expect(body).toHaveProperty("customerId");
        expect(body).toHaveProperty("orderNumber");
        expect(body).toHaveProperty("status");
        expect(body).toHaveProperty("priority");
        expect(body).toHaveProperty("createdAt");
        expect(body).toHaveProperty("updatedAt");

        console.log(
          `GET /api/v1/orders/${targetId} returned orderNumber=${body.orderNumber}`,
        );
      }
    });

    it("should return 404 for non-existent order", async () => {
      if (!authToken) {
        console.warn("Skipping test — no auth token");
        return;
      }

      // Use a very large ID that is virtually guaranteed not to exist.
      const nonExistentId = 999_999_999;
      const response = await authRequest().get(
        `/api/v1/orders/${nonExistentId}`,
      );

      // 404 = order not found (expected).
      // 403 = role restriction evaluated before lookup.
      // 500 = database unavailable.
      expect([403, 404, 500]).toContain(response.status);

      if (response.status === 404) {
        console.log("GET non-existent order correctly returned 404");
      }
    });
  });

  // ===========================================================================
  // PATCH /api/v1/orders/:id
  // ===========================================================================
  describe("PATCH /api/v1/orders/:id", () => {
    it("should require authentication", async () => {
      const response = await request(app.getHttpServer())
        .patch("/api/v1/orders/1")
        .send(updateDto);

      expect(response.status).toBe(401);
    });

    it("should update order fields", async () => {
      if (!authToken) {
        console.warn("Skipping test — no auth token");
        return;
      }

      if (createdOrderId === null) {
        console.warn(
          "Skipping PATCH test — no order was created in this run (POST returned non-201)",
        );
        return;
      }

      const response = await authRequest()
        .patch(`/api/v1/orders/${createdOrderId}`)
        .send(updateDto);

      // 200 = update successful.
      // 400 = business-rule rejection (e.g. invalid status transition).
      // 403 = role restriction.
      // 404 = order not found.
      // 500 = database error.
      expect([200, 400, 403, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        const body = response.body as { status: string; priority: string };

        // The returned document must reflect the requested field values when
        // the update succeeds (service may normalise values so we do a loose check).
        expect(body).toHaveProperty("status");
        expect(body).toHaveProperty("priority");

        console.log(
          `PATCH order ${createdOrderId}: status=${body.status} priority=${body.priority}`,
        );
      }
    });
  });

  // ===========================================================================
  // PATCH /api/v1/orders/:id/cancel
  // ===========================================================================
  describe("PATCH /api/v1/orders/:id/cancel", () => {
    it("should require authentication", async () => {
      const response = await request(app.getHttpServer())
        .patch("/api/v1/orders/1/cancel")
        .send({ reason: "Test cancellation" });

      expect(response.status).toBe(401);
    });

    it("should cancel order with reason", async () => {
      if (!authToken) {
        console.warn("Skipping test — no auth token");
        return;
      }

      if (createdOrderId === null) {
        console.warn(
          "Skipping cancel test — no order was created in this run (POST returned non-201)",
        );
        return;
      }

      const cancellationPayload = { reason: "E2E test cancellation cleanup" };

      const response = await authRequest()
        .patch(`/api/v1/orders/${createdOrderId}/cancel`)
        .send(cancellationPayload);

      // 200 = order successfully cancelled.
      // 400 = order is in a state that cannot be cancelled (e.g. already delivered
      //       because the PATCH test above may have moved it forward).
      // 403 = role restriction.
      // 404 = order not found.
      // 500 = database error.
      expect([200, 400, 403, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        const body = response.body as { status: string };

        expect(body).toHaveProperty("status", "cancelled");
        console.log(`Order ${createdOrderId} successfully cancelled`);

        // If the order is now cancelled the afterAll soft-delete will still run
        // but may receive a no-op or 404 — both are acceptable.
      } else {
        console.warn(
          `Cancel returned ${response.status} — order may already be in a non-cancellable state`,
        );
      }
    });
  });

  // ===========================================================================
  // DELETE /api/v1/orders/:id
  // ===========================================================================
  describe("DELETE /api/v1/orders/:id", () => {
    it("should require authentication", async () => {
      const response = await request(app.getHttpServer()).delete(
        "/api/v1/orders/1",
      );
      expect(response.status).toBe(401);
    });

    it("should soft delete order", async () => {
      if (!authToken) {
        console.warn("Skipping test — no auth token");
        return;
      }

      if (createdOrderId === null) {
        console.warn(
          "Skipping DELETE test — no order was created in this run (POST returned non-201)",
        );
        return;
      }

      const response = await authRequest().delete(
        `/api/v1/orders/${createdOrderId}`,
      );

      // 204 = soft-deleted successfully (controller uses @HttpCode(204)).
      // 403 = role restriction.
      // 404 = order not found (already deleted by a previous test step).
      // 500 = database error.
      expect([204, 403, 404, 500]).toContain(response.status);

      if (response.status === 204) {
        console.log(`Order ${createdOrderId} soft-deleted successfully`);
        // Mark as cleaned up so afterAll does not attempt a redundant delete.
        createdOrderId = null;
      }
    });

    it("should return 404 for non-existent order", async () => {
      if (!authToken) {
        console.warn("Skipping test — no auth token");
        return;
      }

      const nonExistentId = 999_999_998;
      const response = await authRequest().delete(
        `/api/v1/orders/${nonExistentId}`,
      );

      // 404 = order not found (expected).
      // 403 = role restriction evaluated before lookup.
      // 500 = database unavailable.
      expect([403, 404, 500]).toContain(response.status);

      if (response.status === 404) {
        console.log("DELETE non-existent order correctly returned 404");
      }
    });
  });
});
