import { INestApplication } from "@nestjs/common";

/**
 * Number of reverse proxies between the public internet and this process.
 *
 * In staging and production that is exactly one hop — the nginx ingress
 * controller (see the ingress manifests under kubernetes/).  The DigitalOcean
 * load balancer in front of it speaks PROXY protocol, so nginx already sees
 * the real client address and is the one that writes X-Forwarded-For.
 *
 * Bump this only if another proxy is inserted in front of the ingress.
 */
export const TRUST_PROXY_HOPS = 1;

/**
 * Teach Express how far to trust X-Forwarded-For.
 *
 * Express ignores X-Forwarded-For entirely unless `trust proxy` is set, so
 * `req.ip` would otherwise resolve to the TCP peer — the ingress controller
 * pod — identically for every caller.  @nestjs/throttler's default tracker is
 * `req.ip`, which means all clients would share ONE rate-limit bucket: the
 * 60/hour limit on POST /auth/email/login would apply to the deployment as a
 * whole rather than per client, letting any single busy caller lock everyone
 * else out of logging in.
 *
 * A hop count (rather than `true`) is what makes this safe.  `true` trusts the
 * entire header and would hand the tracker to the left-most entry, which is
 * attacker-supplied; trusting N hops takes the (N+1)-th address from the right,
 * i.e. the one our own ingress appended.  With no proxy in front — local dev —
 * there is no X-Forwarded-For and Express falls back to the socket address.
 */
export function configureTrustProxy(app: INestApplication): void {
  app.getHttpAdapter().getInstance().set("trust proxy", TRUST_PROXY_HOPS);
}
