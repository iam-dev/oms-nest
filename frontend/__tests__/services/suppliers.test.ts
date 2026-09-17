import {
  toFactoryApiPayload,
  createSupplier,
  updateSupplier,
  blockFactory,
  deleteSupplier,
  type Supplier,
} from '@/services/suppliers';

jest.mock('@/services/api', () => ({
  fetchEntities: jest.fn(),
}));

jest.mock('@/services/api-config', () => ({
  API_URL: 'http://api.test',
  fetchWithRefresh: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { fetchWithRefresh } from '@/services/api-config';

const mockFetchWithRefresh = jest.mocked(fetchWithRefresh);

// A factory as it arrives from the list endpoint after fetchEntities() mapping:
// backend fields (emailaddress, isActive, fullAddress, displayName, lastLogin)
// plus the frontend-derived `email`.
const listRowFactory: Partial<Supplier> & Record<string, unknown> = {
  id: 7,
  userId: 417,
  name: 'Lex International',
  username: 'rohansuri',
  email: 'changed@example.com',
  emailaddress: 'rohansuri@lexintnl.com',
  address: '86/300-A, Raipurwa, G.T.Road',
  city: 'Kanpur',
  country: 'India',
  state: 'Uttar Pradesh',
  zipcode: '208003',
  phoneNo: '+91-1',
  cellNo: '+91-2',
  currency: 1,
  enabled: false,
  isActive: true,
  fullAddress: '86/300-A, Kanpur',
  displayName: 'Lex International',
  lastLogin: 1710325260,
  deleted: 0,
};

function okResponse(body: unknown, status = 200): Response {
  return {
    ok: true,
    status,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errorResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    statusText: status === 422 ? 'Unprocessable Entity' : 'Bad Request',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('toFactoryApiPayload', () => {
  test('translates the form field "email" to the backend field "emailaddress"', () => {
    const payload = toFactoryApiPayload(listRowFactory);

    expect(payload.emailaddress).toBe('changed@example.com');
    expect(payload).not.toHaveProperty('email');
  });

  test('keeps name, username and status (enabled) so the backend can persist them', () => {
    const payload = toFactoryApiPayload(listRowFactory);

    expect(payload.name).toBe('Lex International');
    expect(payload.username).toBe('rohansuri');
    expect(payload.enabled).toBe(false);
  });

  test('passes through every editable contact/address field', () => {
    const payload = toFactoryApiPayload(listRowFactory);

    expect(payload).toMatchObject({
      address: '86/300-A, Raipurwa, G.T.Road',
      city: 'Kanpur',
      country: 'India',
      state: 'Uttar Pradesh',
      zipcode: '208003',
      phoneNo: '+91-1',
      cellNo: '+91-2',
    });
  });

  test('strips read-only / derived fields the backend DTO does not accept', () => {
    const payload = toFactoryApiPayload(listRowFactory);

    for (const key of ['id', 'userId', 'isActive', 'fullAddress', 'displayName', 'lastLogin', 'deleted', 'currency']) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  test('omits keys that are undefined so a PATCH does not blank untouched columns', () => {
    const payload = toFactoryApiPayload({ city: 'Boston' });

    expect(payload).toEqual({ city: 'Boston' });
  });
});

describe('createSupplier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithRefresh.mockResolvedValue(okResponse({ id: 8, name: 'New Factory' }, 201));
  });

  test('POSTs the translated payload to /api/v1/factories (not the legacy /save endpoint)', async () => {
    await createSupplier({ ...listRowFactory, id: undefined });

    const [url, init] = mockFetchWithRefresh.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/factories');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });

    const body = JSON.parse(init?.body as string);
    expect(body.emailaddress).toBe('changed@example.com');
    expect(body.username).toBe('rohansuri');
    expect(body.name).toBe('Lex International');
    expect(body).not.toHaveProperty('entityAspect');
    expect(body).not.toHaveProperty('entities');
  });

  test('returns the created factory from the response body', async () => {
    const result = await createSupplier({ name: 'New Factory', username: 'newfactory' });

    expect(result).toEqual({ id: 8, name: 'New Factory' });
  });

  test('surfaces the backend message on a 400 (e.g. duplicate username)', async () => {
    mockFetchWithRefresh.mockResolvedValue(
      errorResponse(400, { statusCode: 400, message: 'Username already exists' }),
    );

    await expect(createSupplier({ username: 'aikenusa' })).rejects.toThrow(
      'Username already exists',
    );
  });

  test('surfaces field errors on a 422 validation failure', async () => {
    mockFetchWithRefresh.mockResolvedValue(
      errorResponse(422, { status: 422, errors: { emailaddress: 'emailaddress must be an email' } }),
    );

    await expect(createSupplier({ username: 'x', email: 'nope' })).rejects.toThrow(
      'emailaddress must be an email',
    );
  });
});

describe('updateSupplier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithRefresh.mockResolvedValue(okResponse({ id: 7, name: 'Lex International' }));
  });

  test('PATCHes the translated payload to /api/v1/factories/:id', async () => {
    await updateSupplier(7, listRowFactory);

    const [url, init] = mockFetchWithRefresh.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/factories/7');
    expect(init?.method).toBe('PATCH');

    const body = JSON.parse(init?.body as string);
    expect(body.emailaddress).toBe('changed@example.com');
    expect(body.enabled).toBe(false);
    expect(body.name).toBe('Lex International');
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('fullAddress');
    expect(body).not.toHaveProperty('entityAspect');
  });

  test('does not send username on update (login names are immutable)', async () => {
    await updateSupplier(7, listRowFactory);

    const [, init] = mockFetchWithRefresh.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body).not.toHaveProperty('username');
  });

  test('returns the updated factory from the response body', async () => {
    const result = await updateSupplier(7, { city: 'Kanpur' });

    expect(result).toEqual({ id: 7, name: 'Lex International' });
  });
});

describe('blockFactory / deleteSupplier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('blockFactory goes through fetchWithRefresh so an expired token is refreshed', async () => {
    mockFetchWithRefresh.mockResolvedValue(okResponse({ enabled: false }));

    const result = await blockFactory(7);

    const [url, init] = mockFetchWithRefresh.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/factories/7/toggle-block');
    expect(init?.method).toBe('PATCH');
    expect(result).toEqual({ enabled: false });
  });

  test('deleteSupplier goes through fetchWithRefresh', async () => {
    mockFetchWithRefresh.mockResolvedValue({ ok: true, status: 204 } as Response);

    await deleteSupplier(7);

    const [url, init] = mockFetchWithRefresh.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/factories/7');
    expect(init?.method).toBe('DELETE');
  });
});
