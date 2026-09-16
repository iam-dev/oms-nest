import { toFitterApiPayload, updateFitter, type Fitter } from '@/services/fitters';

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

// A fitter as it arrives from the list endpoint after fetchEntities() mapping:
// backend fields (emailaddress, isActive, fullAddress, displayName, lastLogin)
// plus the frontend-derived ones (email, firstName, lastName).
const listRowFitter: Partial<Fitter> & Record<string, unknown> = {
  id: 25,
  userId: 37,
  name: 'Maurits Tester',
  username: 'mauritsfitter',
  firstName: 'Maurits',
  lastName: 'Tester',
  email: 'changed@example.com',
  emailaddress: 'old@example.com',
  address: 'Stationsweg 1',
  city: 'Zwolle',
  country: 'Netherlands',
  state: '',
  zipcode: '8011 CZ',
  phoneNo: '+316-1',
  cellNo: '+316-2',
  currency: 2,
  enabled: false,
  isActive: true,
  fullAddress: 'Stationsweg 1, Zwolle',
  displayName: 'Fitter in Zwolle',
  lastLogin: 0,
  deleted: 0,
};

describe('toFitterApiPayload', () => {
  test('translates the form field "email" to the backend field "emailaddress"', () => {
    const payload = toFitterApiPayload(listRowFitter);

    expect(payload.emailaddress).toBe('changed@example.com');
    expect(payload).not.toHaveProperty('email');
  });

  test('keeps status (enabled) and currency so the backend can persist them', () => {
    const payload = toFitterApiPayload(listRowFitter);

    expect(payload.enabled).toBe(false);
    expect(payload.currency).toBe(2);
  });

  test('passes through every editable contact/address field', () => {
    const payload = toFitterApiPayload(listRowFitter);

    expect(payload).toMatchObject({
      username: 'mauritsfitter',
      firstName: 'Maurits',
      lastName: 'Tester',
      address: 'Stationsweg 1',
      city: 'Zwolle',
      country: 'Netherlands',
      state: '',
      zipcode: '8011 CZ',
      phoneNo: '+316-1',
      cellNo: '+316-2',
    });
  });

  test('strips read-only / derived fields the backend DTO does not accept', () => {
    const payload = toFitterApiPayload(listRowFitter);

    for (const key of ['id', 'userId', 'name', 'isActive', 'fullAddress', 'displayName', 'lastLogin', 'deleted']) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  test('includes password only when one was entered', () => {
    expect(toFitterApiPayload({ ...listRowFitter, password: 'secret1' }).password).toBe('secret1');
    expect(toFitterApiPayload(listRowFitter)).not.toHaveProperty('password');
  });

  test('omits keys that are undefined so a PATCH does not blank untouched columns', () => {
    const payload = toFitterApiPayload({ city: 'Boston' });

    expect(payload).toEqual({ city: 'Boston' });
  });
});

describe('updateFitter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWithRefresh.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 25 }),
    } as Response);
  });

  test('sends the translated payload (emailaddress, enabled) in the PATCH body', async () => {
    await updateFitter(25, listRowFitter);

    const [url, init] = mockFetchWithRefresh.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/fitters/25');
    expect(init?.method).toBe('PATCH');

    const body = JSON.parse(init?.body as string);
    expect(body.emailaddress).toBe('changed@example.com');
    expect(body.enabled).toBe(false);
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('fullAddress');
  });
});
