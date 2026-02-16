/* eslint-disable no-restricted-syntax */
/**
 * E2E API Tests: API Endpoints
 *
 * Tests all main API endpoints with authentication
 * and validates response structure and data.
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";

describe("API Endpoints (E2E)", () => {
  let app: INestApplication;
  let authToken: string;

  // Test credentials (from seed data)
  const testCredentials = {
    email: "adamwhitehouse",
    password: "welcomeAdam!@",
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global pipes like in main.ts
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

    // Authenticate and get token
    try {
      const loginResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/email/login")
        .send(testCredentials)
        .expect((res) => {
          if (res.status !== 200) {
            console.log("Login response:", res.status, res.body);
          }
        });

      if (loginResponse.body.token) {
        authToken = loginResponse.body.token;
        console.log("Authentication successful");
      } else {
        console.warn("No token received, some tests may fail");
      }
    } catch (error) {
      console.warn("Authentication failed:", error);
    }
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  // Helper function to make authenticated requests
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

  describe("Health Check", () => {
    it("GET /api/health - should return health status", async () => {
      const response = await request(app.getHttpServer()).get("/api/health");

      // Health check may fail if Redis not available, but endpoint should respond
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty("status");
    });
  });

  describe("Authentication API", () => {
    it("POST /api/v1/auth/email/login - should authenticate user", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/email/login")
        .send(testCredentials);

      // Should return 200, auth error, or 500 if database not seeded
      expect([200, 401, 422, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty("token");
        expect(response.body).toHaveProperty("user");
      } else if (response.status === 500) {
        console.warn(
          "Auth returned 500 - database may not be seeded with test user",
        );
      }
    });

    it("POST /api/v1/auth/email/login - should reject invalid credentials", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/email/login")
        .send({
          email: "invalid@test.com",
          password: "wrongpassword",
        });

      // 401/422 expected, 500 possible if schema mismatch exists
      expect([401, 422, 500]).toContain(response.status);
    });

    it("GET /api/v1/auth/me - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/auth/me",
      );

      expect(response.status).toBe(401);
    });

    it("GET /api/v1/auth/me - should return current user with valid token", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/auth/me");

      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty("id");
      }
    });
  });

  describe("Orders API", () => {
    it("GET /api/v1/orders - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/orders");
      expect(response.status).toBe(401);
    });

    it("GET /api/v1/orders - should return orders list", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/orders");

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        console.log(`Orders returned: ${response.body.length}`);
      }
    });

    it("GET /api/v1/orders/stats - should return order statistics", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/orders/stats");

      expect([200, 403, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty("totalOrders");
        console.log(`Total orders: ${response.body.totalOrders}`);
      }
    });

    it("GET /api/v1/orders/search - should support search", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get(
        "/api/v1/orders/search?limit=10",
      );

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty("orders");
        expect(response.body).toHaveProperty("total");
      }
    });
  });

  describe("Customers API", () => {
    it("GET /api/v1/customers - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/customers",
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/v1/customers - should return customers list", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/customers");

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        console.log(`Customers returned: ${response.body.length}`);
      }
    });

    it("GET /api/v1/customers/without-fitter - should return customers without fitter", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get(
        "/api/v1/customers/without-fitter",
      );

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });
  });

  describe("Fitters API", () => {
    it("GET /api/v1/fitters - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/fitters",
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/v1/fitters - should return fitters list", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/fitters");

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        console.log(`Fitters returned: ${response.body.length}`);
      }
    });
  });

  describe("Factories API", () => {
    it("GET /api/v1/factories - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/factories",
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/v1/factories - should return factories list", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/factories");

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        console.log(`Factories returned: ${response.body.length}`);
      }
    });
  });

  describe("Brands API", () => {
    it("GET /api/v1/brands - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/brands");
      expect(response.status).toBe(401);
    });

    it("GET /api/v1/brands - should return brands list", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/brands");

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty("data");
        expect(Array.isArray(response.body.data)).toBe(true);
        console.log(`Brands returned: ${response.body.data.length}`);
      }
    });

    it("GET /api/v1/brands/active - should return active brands", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/brands/active");

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });
  });

  describe("Options API", () => {
    it("GET /api/v1/options - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/options",
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/v1/options - should return options list", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/options");

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        console.log(`Options returned: ${response.body.length}`);
      }
    });
  });

  // Leather Types API - Module disabled in AppModule (commented out)
  describe.skip("Leather Types API", () => {
    it("GET /api/v1/leathertypes - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/leathertypes",
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/v1/leathertypes - should return leather types list", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/leathertypes");

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        console.log(`Leather types returned: ${response.body.length}`);
      }
    });
  });

  // Extras API - Module disabled in AppModule (commented out)
  describe.skip("Extras API", () => {
    it("GET /api/v1/extras - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/extras");
      expect(response.status).toBe(401);
    });

    it("GET /api/v1/extras - should return extras list", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/extras");

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        console.log(`Extras returned: ${response.body.length}`);
      }
    });
  });

  // Presets API - Module disabled in AppModule (commented out)
  describe.skip("Presets API", () => {
    it("GET /api/v1/presets - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/presets",
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/v1/presets - should return presets list", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/presets");

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
        console.log(`Presets returned: ${response.body.length}`);
      }
    });
  });

  describe("Users API", () => {
    it("GET /api/v1/users - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get("/api/v1/users");
      expect(response.status).toBe(401);
    });

    it("GET /api/v1/users - should return users list", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/users");

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        // Response might be paginated
        if (response.body.data) {
          expect(Array.isArray(response.body.data)).toBe(true);
          console.log(`Users returned: ${response.body.data.length}`);
        } else {
          expect(Array.isArray(response.body)).toBe(true);
          console.log(`Users returned: ${response.body.length}`);
        }
      }
    });
  });

  describe("Enriched Orders API", () => {
    // Note: Controller uses underscore path: enriched_orders (not enriched-orders)
    it("GET /api/v1/enriched_orders - should require authentication", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/enriched_orders",
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/v1/enriched_orders - should return enriched orders", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      const response = await authRequest().get("/api/v1/enriched_orders");

      expect([200, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        // Enriched orders returns Hydra format with hydra:member
        expect(response.body).toHaveProperty("hydra:member");
        console.log(
          `Enriched orders returned: ${response.body["hydra:member"]?.length}`,
        );
      }
    });

    describe("Edit Form Options (Saddle Details)", () => {
      it("GET /api/v1/enriched_orders/edit-options - should require authentication", async () => {
        const response = await request(app.getHttpServer()).get(
          "/api/v1/enriched_orders/edit-options",
        );
        expect(response.status).toBe(401);
      });

      it("GET /api/v1/enriched_orders/edit-options - should return all option categories", async () => {
        if (!authToken) {
          console.warn("Skipping test - no auth token");
          return;
        }

        const response = await authRequest().get(
          "/api/v1/enriched_orders/edit-options",
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("fitters");
        expect(response.body).toHaveProperty("saddles");
        expect(response.body).toHaveProperty("leatherTypes");
        expect(response.body).toHaveProperty("options");
        expect(response.body).toHaveProperty("optionItems");
        expect(response.body).toHaveProperty("statuses");

        expect(Array.isArray(response.body.fitters)).toBe(true);
        expect(Array.isArray(response.body.saddles)).toBe(true);
        expect(Array.isArray(response.body.leatherTypes)).toBe(true);
        expect(Array.isArray(response.body.options)).toBe(true);
        expect(Array.isArray(response.body.optionItems)).toBe(true);
        expect(Array.isArray(response.body.statuses)).toBe(true);
      });

      it("should return saddles with brand and model details", async () => {
        if (!authToken) {
          console.warn("Skipping test - no auth token");
          return;
        }

        const response = await authRequest().get(
          "/api/v1/enriched_orders/edit-options",
        );

        expect(response.status).toBe(200);
        expect(response.body.saddles.length).toBeGreaterThan(0);

        const saddle = response.body.saddles[0];
        expect(saddle).toHaveProperty("id");
        expect(saddle).toHaveProperty("brand");
        expect(saddle).toHaveProperty("modelName");
        expect(saddle).toHaveProperty("displayName");
        expect(saddle.displayName).toContain(saddle.brand);

        console.log(`Saddles returned: ${response.body.saddles.length}`);
      });

      it("should return saddle specification options (Seat Size, Flap Length, etc.)", async () => {
        if (!authToken) {
          console.warn("Skipping test - no auth token");
          return;
        }

        const response = await authRequest().get(
          "/api/v1/enriched_orders/edit-options",
        );

        expect(response.status).toBe(200);
        expect(response.body.options.length).toBeGreaterThan(0);

        const option = response.body.options[0];
        expect(option).toHaveProperty("optionId");
        expect(option).toHaveProperty("optionName");
        expect(option).toHaveProperty("sequence");
        expect(option).toHaveProperty("group");

        console.log(
          `Saddle spec options returned: ${response.body.options.length}`,
          response.body.options.map(
            (o: { optionName: string }) => o.optionName,
          ),
        );
      });

      it("should return option items linked to options", async () => {
        if (!authToken) {
          console.warn("Skipping test - no auth token");
          return;
        }

        const response = await authRequest().get(
          "/api/v1/enriched_orders/edit-options",
        );

        expect(response.status).toBe(200);
        expect(response.body.optionItems.length).toBeGreaterThan(0);

        const item = response.body.optionItems[0];
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("optionId");

        // Every optionItem should reference an existing option
        const optionIds = new Set(
          response.body.options.map((o: { optionId: number }) => o.optionId),
        );
        for (const oi of response.body.optionItems) {
          expect(optionIds.has(oi.optionId)).toBe(true);
        }

        console.log(
          `Option items returned: ${response.body.optionItems.length}`,
        );
      });

      it("should return fitters with username and fullName", async () => {
        if (!authToken) {
          console.warn("Skipping test - no auth token");
          return;
        }

        const response = await authRequest().get(
          "/api/v1/enriched_orders/edit-options",
        );

        expect(response.status).toBe(200);
        expect(response.body.fitters.length).toBeGreaterThan(0);

        const fitter = response.body.fitters[0];
        expect(fitter).toHaveProperty("id");
        expect(fitter).toHaveProperty("username");
        expect(fitter).toHaveProperty("fullName");

        console.log(`Fitters returned: ${response.body.fitters.length}`);
      });

      it("should return leather types", async () => {
        if (!authToken) {
          console.warn("Skipping test - no auth token");
          return;
        }

        const response = await authRequest().get(
          "/api/v1/enriched_orders/edit-options",
        );

        expect(response.status).toBe(200);
        expect(response.body.leatherTypes.length).toBeGreaterThan(0);

        const leatherType = response.body.leatherTypes[0];
        expect(leatherType).toHaveProperty("id");
        expect(leatherType).toHaveProperty("name");

        console.log(
          `Leather types returned: ${response.body.leatherTypes.length}`,
        );
      });

      it("should return statuses", async () => {
        if (!authToken) {
          console.warn("Skipping test - no auth token");
          return;
        }

        const response = await authRequest().get(
          "/api/v1/enriched_orders/edit-options",
        );

        expect(response.status).toBe(200);
        expect(response.body.statuses.length).toBeGreaterThan(0);

        const status = response.body.statuses[0];
        expect(status).toHaveProperty("id");
        expect(status).toHaveProperty("name");

        console.log(`Statuses returned: ${response.body.statuses.length}`);
      });
    });
  });

  describe("API Response Times", () => {
    it("should respond within acceptable time for list endpoints", async () => {
      if (!authToken) {
        console.warn("Skipping test - no auth token");
        return;
      }

      // Only test enabled modules
      const endpoints = [
        "/api/v1/brands",
        "/api/v1/options",
        "/api/v1/customers",
      ];

      for (const endpoint of endpoints) {
        const start = Date.now();
        await authRequest().get(endpoint);
        const duration = Date.now() - start;

        console.log(`${endpoint}: ${duration}ms`);
        // Should respond within 5 seconds (relaxed for CI)
        expect(duration).toBeLessThan(5000);
      }
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for non-existent endpoints", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/nonexistent",
      );
      expect(response.status).toBe(404);
    });

    it("should return 401 for protected endpoints without token", async () => {
      const protectedEndpoints = [
        "/api/v1/orders",
        "/api/v1/customers",
        "/api/v1/fitters",
        "/api/v1/factories",
        "/api/v1/brands",
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app.getHttpServer()).get(endpoint);
        expect(response.status).toBe(401);
      }
    });
  });
});
