/**
 * @jest-environment node
 */
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';

/**
 * The middleware verifies the httpOnly `token` cookie with JWT_SECRET, which
 * must be the same secret the backend signs with (AUTH_JWT_SECRET). When it is
 * missing the middleware fails closed and bounces every protected route to
 * /login — even for a perfectly valid session.
 *
 * That misconfiguration is invisible to any test that only asserts "we ended
 * up somewhere", which is how it survived in the local CI e2e job: the UI
 * tests logged in, silently failed to reach /dashboard, and carried on.
 */

const SECRET = 'ci-test-jwt-secret';

async function signToken(secret: string, role = 'admin'): Promise<string> {
  return new SignJWT({ id: 1, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secret));
}

/** A full-page navigation to a protected route, carrying a session cookie. */
function documentRequestTo(pathname: string, token?: string): NextRequest {
  const headers = new Headers({ 'sec-fetch-dest': 'document' });
  if (token) headers.set('cookie', `token=${token}`);
  return new NextRequest(new URL(`http://localhost:3000${pathname}`), { headers });
}

/** Load middleware fresh, since JWT_SECRET is captured at module scope. */
async function runMiddleware(jwtSecret: string | undefined, request: NextRequest) {
  let response: Response | undefined;
  await jest.isolateModulesAsync(async () => {
    if (jwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = jwtSecret;
    }
    const { middleware } = await import('../../middleware');
    response = await middleware(request);
  });
  return response!;
}

function redirectTarget(response: Response): string | null {
  return response.status >= 300 && response.status < 400
    ? response.headers.get('location')
    : null;
}

describe('middleware JWT_SECRET configuration', () => {
  const originalSecret = process.env.JWT_SECRET;

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('should admit a valid session when JWT_SECRET matches the signing secret', async () => {
    const token = await signToken(SECRET);
    const response = await runMiddleware(SECRET, documentRequestTo('/dashboard', token));

    expect(redirectTarget(response)).toBeNull();
  });

  it('should bounce a valid session to /login when JWT_SECRET is unset', async () => {
    // The regression: the session is genuine, the deployment is misconfigured.
    const token = await signToken(SECRET);
    const response = await runMiddleware(undefined, documentRequestTo('/dashboard', token));

    expect(redirectTarget(response)).toContain('/login');
  });

  it('should bounce a session signed with a different secret', async () => {
    const token = await signToken('some-other-secret');
    const response = await runMiddleware(SECRET, documentRequestTo('/dashboard', token));

    expect(redirectTarget(response)).toContain('/login');
  });
});
