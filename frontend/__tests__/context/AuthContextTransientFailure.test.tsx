import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { AuthProvider, useAuth } from '@/context/AuthContext';

/**
 * A transport-level failure of the /auth/me probe must not be read as
 * "signed out". The session lives in a cookie the server still holds, so a
 * dropped or coalesced request says nothing about whether it is valid.
 *
 * This bit in practice: React StrictMode runs the mount effect twice in dev,
 * so two /auth/me probes race. WebKit dropped one of them, checkAuth's catch
 * tore the session down, and ClientLayoutWrapper bounced a freshly loaded
 * protected page to /login. The same thing happens to a real user whose
 * network blips while refreshing a page.
 *
 * An actual HTTP response is different — that IS evidence, and 401 must log
 * the user out immediately rather than retrying.
 */

jest.mock('@/api/login', () => ({
  login: jest.fn(),
  clearAuthTokens: jest.fn(),
}));

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const TestComponent = () => {
  const { user, isAuthenticated, isLoaded } = useAuth();
  return (
    <div>
      <div data-testid="is-loaded">{isLoaded ? 'true' : 'false'}</div>
      <div data-testid="is-authenticated">{isAuthenticated ? 'true' : 'false'}</div>
      <div data-testid="user-email">{user?.email || 'none'}</div>
    </div>
  );
};

function okUserResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 7,
      email: 'admin@omsaddle.com',
      name: 'Admin User',
      typeName: 'admin',
    }),
  } as unknown as Response;
}

function httpResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({}),
  } as unknown as Response;
}

async function renderAndSettle() {
  // Fresh jotai store per test — the auth atoms are module-level, so the
  // default store would carry state across tests.
  render(
    <Provider store={createStore()}>
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    </Provider>,
  );
  await waitFor(() => expect(screen.getByTestId('is-loaded')).toHaveTextContent('true'));
}

describe('AuthContext session probe resilience', () => {
  beforeEach(() => {
    // mockReset, not clearAllMocks: the latter leaves queued mock*Once values
    // behind, so an unconsumed response would bleed into the next test.
    mockFetch.mockReset();
  });

  afterEach(() => {
    // Auto-cleanup is not wired up in this project's jest setup, so a previous
    // test's DOM would otherwise still be queryable.
    cleanup();
  });

  it('should keep the session when a transient network failure is followed by success', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValueOnce(okUserResponse());

    await renderAndSettle();

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user-email')).toHaveTextContent('admin@omsaddle.com');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should give up and clear the session when the network keeps failing', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockRejectedValueOnce(new TypeError('Load failed'));

    await renderAndSettle();

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
  });

  it('should clear the session immediately on 401 without retrying', async () => {
    // A real response is evidence of being signed out — retrying is pointless.
    mockFetch.mockResolvedValueOnce(httpResponse(401));

    await renderAndSettle();

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
