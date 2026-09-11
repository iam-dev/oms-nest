import { Controller, Get, INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { configureTrustProxy } from "../../../src/common/configure-trust-proxy";

/**
 * BE-041: the API runs behind the nginx ingress, so the TCP peer is always the
 * ingress controller pod.  Express only derives the real client IP from
 * X-Forwarded-For when `trust proxy` is set, and @nestjs/throttler's default
 * tracker is `req.ip` — so without it every caller shares ONE rate-limit
 * bucket and a single busy client locks everybody out of /auth/email/login.
 */

@Controller("probe")
class ProbeController {
  @Get()
  probe() {
    return { ok: true };
  }
}

/** limit 2 per minute so the third call from one tracker is throttled */
async function buildApp(withTrustProxy: boolean): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 2 }])],
    controllers: [ProbeController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();

  const app = moduleRef.createNestApplication();
  if (withTrustProxy) {
    configureTrustProxy(app);
  }
  await app.init();
  return app;
}

describe("configureTrustProxy", () => {
  describe("without it (the bug)", () => {
    let app: INestApplication;

    beforeEach(async () => {
      app = await buildApp(false);
    });
    afterEach(async () => {
      await app.close();
    });

    it("should lump distinct clients into a single throttle bucket", async () => {
      // Two requests from one client exhaust the limit...
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "203.0.113.1")
        .expect(200);
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "203.0.113.1")
        .expect(200);

      // ...and an unrelated client is locked out, because the tracker is the
      // shared socket address rather than either client's real IP.
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "198.51.100.7")
        .expect(429);
    });
  });

  describe("with it", () => {
    let app: INestApplication;

    beforeEach(async () => {
      app = await buildApp(true);
    });
    afterEach(async () => {
      await app.close();
    });

    it("should give each forwarded client its own throttle bucket", async () => {
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "203.0.113.1")
        .expect(200);
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "203.0.113.1")
        .expect(200);

      // Different client — must not inherit the first client's usage.
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "198.51.100.7")
        .expect(200);
    });

    it("should still throttle a single client once its own limit is spent", async () => {
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "203.0.113.1")
        .expect(200);
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "203.0.113.1")
        .expect(200);
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "203.0.113.1")
        .expect(429);
    });

    it("should ignore client-supplied X-Forwarded-For entries it cannot vouch for", async () => {
      // Only the right-most entry is appended by our own ingress; anything to
      // the left of it is attacker-controlled and must not become the tracker.
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "1.2.3.4, 203.0.113.1")
        .expect(200);
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "5.6.7.8, 203.0.113.1")
        .expect(200);
      // Rotating the spoofed left-hand value must NOT buy a fresh bucket.
      await request(app.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "9.10.11.12, 203.0.113.1")
        .expect(429);
    });
  });
});
