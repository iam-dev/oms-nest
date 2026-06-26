import {
  getSavedFilters,
  getDefaultFilter,
  createSavedFilter,
  updateSavedFilter,
  deleteSavedFilter,
  SavedFilter,
} from '@/services/reportSavedFilters';
import { SessionExpiredError } from '@/services/api-config';

// Mock global.fetch — fetchWithRefresh delegates to the real fetch internally.
// Mocking at this layer intercepts all calls made by fetchWithRefresh.
global.fetch = jest.fn();

const BASE_URL = 'http://localhost:3001';
const ENDPOINT = `${BASE_URL}/api/v1/report-saved-filters`;

const makeMockSavedFilter = (overrides: Partial<SavedFilter> = {}): SavedFilter => ({
  id: 1,
  userId: 42,
  name: 'My Report Filter',
  filters: { status: 'pending', fitter: 'jane' },
  isDefault: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
  ...overrides,
});

const mockOkResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue(body),
});

const mockErrorResponse = (status: number, body?: unknown) => ({
  ok: false,
  status,
  json: jest.fn().mockResolvedValue(body ?? {}),
});

describe('reportSavedFilters service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getSavedFilters
  // ---------------------------------------------------------------------------
  describe('getSavedFilters', () => {
    it('calls the correct URL with Accept header and credentials', async () => {
      const filters = [makeMockSavedFilter(), makeMockSavedFilter({ id: 2, name: 'Second' })];
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(filters));

      await getSavedFilters();

      expect(fetch).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: 'application/json' }),
          credentials: 'include',
        }),
      );
    });

    it('returns the array of saved filters on success', async () => {
      const filters = [makeMockSavedFilter({ id: 1 }), makeMockSavedFilter({ id: 2 })];
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(filters));

      const result = await getSavedFilters();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it('returns an empty array when the API returns an empty list', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse([]));

      const result = await getSavedFilters();

      expect(result).toEqual([]);
    });

    it('throws with status code on non-ok response', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockErrorResponse(500));

      await expect(getSavedFilters()).rejects.toThrow('Failed to fetch saved filters: 500');
    });

    it('throws with status code on 403 response', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockErrorResponse(403));

      await expect(getSavedFilters()).rejects.toThrow('Failed to fetch saved filters: 403');
    });
  });

  // ---------------------------------------------------------------------------
  // getDefaultFilter
  // ---------------------------------------------------------------------------
  describe('getDefaultFilter', () => {
    it('calls the /default endpoint with correct headers', async () => {
      const filter = makeMockSavedFilter({ isDefault: true });
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(filter));

      await getDefaultFilter();

      expect(fetch).toHaveBeenCalledWith(
        `${ENDPOINT}/default`,
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: 'application/json' }),
          credentials: 'include',
        }),
      );
    });

    it('returns the default filter on success', async () => {
      const filter = makeMockSavedFilter({ isDefault: true, name: 'Default Filter' });
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(filter));

      const result = await getDefaultFilter();

      expect(result).not.toBeNull();
      expect(result!.isDefault).toBe(true);
      expect(result!.name).toBe('Default Filter');
    });

    it('returns null when the server responds with 404', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404, json: jest.fn() });

      const result = await getDefaultFilter();

      expect(result).toBeNull();
    });

    it('returns null when the API returns a falsy/empty body', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockResolvedValue(null) });

      const result = await getDefaultFilter();

      expect(result).toBeNull();
    });

    it('throws with status code on non-ok, non-404 response', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockErrorResponse(500));

      await expect(getDefaultFilter()).rejects.toThrow('Failed to fetch default filter: 500');
    });

    it('throws SessionExpiredError on 401 response (not a 404)', async () => {
      // FE-006: fetchWithRefresh now throws SessionExpiredError on 401 after a failed
      // refresh attempt, rather than propagating the raw 401 response to callers.
      (fetch as jest.Mock).mockResolvedValue(mockErrorResponse(401));

      await expect(getDefaultFilter()).rejects.toBeInstanceOf(SessionExpiredError);
    });
  });

  // ---------------------------------------------------------------------------
  // createSavedFilter
  // ---------------------------------------------------------------------------
  describe('createSavedFilter', () => {
    const payload = {
      name: 'Q1 Filter',
      filters: { status: 'approved', factory: 'FactoryA' },
      isDefault: true,
    };

    it('POSTs to the correct URL', async () => {
      const created = makeMockSavedFilter({ name: payload.name });
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(created));

      await createSavedFilter(payload);

      expect(fetch).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('sends Content-Type and Accept headers', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(makeMockSavedFilter()));

      await createSavedFilter(payload);

      expect(fetch).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        }),
      );
    });

    it('serialises the payload as JSON body', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(makeMockSavedFilter()));

      await createSavedFilter(payload);

      const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
      expect(body).toEqual(payload);
    });

    it('includes credentials in the request', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(makeMockSavedFilter()));

      await createSavedFilter(payload);

      expect((fetch as jest.Mock).mock.calls[0][1].credentials).toBe('include');
    });

    it('returns the created filter on success', async () => {
      const created = makeMockSavedFilter({ id: 99, name: 'Q1 Filter' });
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(created));

      const result = await createSavedFilter(payload);

      expect(result.id).toBe(99);
      expect(result.name).toBe('Q1 Filter');
    });

    it('works without the optional isDefault field', async () => {
      const minimalPayload = { name: 'Minimal', filters: { x: 1 } };
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(makeMockSavedFilter({ name: 'Minimal' })));

      const result = await createSavedFilter(minimalPayload);

      expect(result.name).toBe('Minimal');
      const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
      expect(body).toEqual(minimalPayload);
    });

    it('throws the server error message on non-ok response', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockErrorResponse(422, { message: 'Name already exists' }));

      await expect(createSavedFilter(payload)).rejects.toThrow('Name already exists');
    });

    it('throws a fallback message when the error body has no message', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockErrorResponse(500, {}));

      await expect(createSavedFilter(payload)).rejects.toThrow('Failed to create saved filter: 500');
    });

    it('throws a fallback message when the error body is not valid JSON', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Not JSON')),
      });

      await expect(createSavedFilter(payload)).rejects.toThrow('Failed to create saved filter: 500');
    });
  });

  // ---------------------------------------------------------------------------
  // updateSavedFilter
  // ---------------------------------------------------------------------------
  describe('updateSavedFilter', () => {
    const filterId = 7;
    const patch = { name: 'Renamed Filter', isDefault: true };

    it('PATCHes to the URL containing the filter id', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(makeMockSavedFilter({ id: filterId })));

      await updateSavedFilter(filterId, patch);

      expect(fetch).toHaveBeenCalledWith(
        `${ENDPOINT}/${filterId}`,
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('sends Content-Type and Accept headers', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(makeMockSavedFilter({ id: filterId })));

      await updateSavedFilter(filterId, patch);

      expect(fetch).toHaveBeenCalledWith(
        `${ENDPOINT}/${filterId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        }),
      );
    });

    it('serialises only the provided patch fields as JSON body', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(makeMockSavedFilter({ id: filterId })));

      await updateSavedFilter(filterId, patch);

      const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
      expect(body).toEqual(patch);
    });

    it('includes credentials in the request', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(makeMockSavedFilter({ id: filterId })));

      await updateSavedFilter(filterId, patch);

      expect((fetch as jest.Mock).mock.calls[0][1].credentials).toBe('include');
    });

    it('returns the updated filter on success', async () => {
      const updated = makeMockSavedFilter({ id: filterId, name: 'Renamed Filter', isDefault: true });
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(updated));

      const result = await updateSavedFilter(filterId, patch);

      expect(result.id).toBe(filterId);
      expect(result.name).toBe('Renamed Filter');
      expect(result.isDefault).toBe(true);
    });

    it('uses the id in the URL, not in the body', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockOkResponse(makeMockSavedFilter({ id: filterId })));

      await updateSavedFilter(filterId, patch);

      const [calledUrl, calledOptions] = (fetch as jest.Mock).mock.calls[0];
      expect(calledUrl).toContain(`/${filterId}`);
      const body = JSON.parse(calledOptions.body);
      expect(body).not.toHaveProperty('id');
    });

    it('throws the server error message on non-ok response', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockErrorResponse(409, { message: 'Conflict: name taken' }));

      await expect(updateSavedFilter(filterId, patch)).rejects.toThrow('Conflict: name taken');
    });

    it('throws a fallback message when the error body has no message', async () => {
      (fetch as jest.Mock).mockResolvedValue(mockErrorResponse(500, {}));

      await expect(updateSavedFilter(filterId, patch)).rejects.toThrow('Failed to update saved filter: 500');
    });

    it('throws a fallback message when the error body is not valid JSON', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        json: jest.fn().mockRejectedValue(new Error('Not JSON')),
      });

      await expect(updateSavedFilter(filterId, patch)).rejects.toThrow('Failed to update saved filter: 503');
    });
  });

  // ---------------------------------------------------------------------------
  // deleteSavedFilter
  // ---------------------------------------------------------------------------
  describe('deleteSavedFilter', () => {
    const filterId = 5;

    it('sends a DELETE request to the URL containing the filter id', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204, json: jest.fn() });

      await deleteSavedFilter(filterId);

      expect(fetch).toHaveBeenCalledWith(
        `${ENDPOINT}/${filterId}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('includes credentials in the request', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204, json: jest.fn() });

      await deleteSavedFilter(filterId);

      expect((fetch as jest.Mock).mock.calls[0][1].credentials).toBe('include');
    });

    it('resolves with undefined (void) on success', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204, json: jest.fn() });

      const result = await deleteSavedFilter(filterId);

      expect(result).toBeUndefined();
    });

    it('encodes the correct id in the URL', async () => {
      const otherId = 999;
      (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204, json: jest.fn() });

      await deleteSavedFilter(otherId);

      const calledUrl = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toBe(`${ENDPOINT}/${otherId}`);
    });

    it('throws with status code on non-ok response', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404, json: jest.fn() });

      await expect(deleteSavedFilter(filterId)).rejects.toThrow('Failed to delete saved filter: 404');
    });

    it('throws with status code on 403 response', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403, json: jest.fn() });

      await expect(deleteSavedFilter(filterId)).rejects.toThrow('Failed to delete saved filter: 403');
    });
  });
});
