/**
 * Saddle-modelling catalogue services.
 *
 * The per-model dialogs (Prices / Options / Extra's) need the *whole*
 * catalogue, not the backend's default first page of 10, and the Options
 * page must exclude extras (options.type = 2) server-side so pagination
 * totals stay correct.
 */
import { fetchLeathertypes } from '@/services/leathertypes';
import { fetchPresets } from '@/services/presets';
import { fetchOptions } from '@/services/options';
import { fetchExtras } from '@/services/extras';
import { fetchSaddleLeathersBySaddleId } from '@/services/saddleLeathers';
import { fetchOptionsItemsByOptionId } from '@/services/optionsItems';
import * as apiModule from '@/services/api';

jest.mock('@/services/api', () => ({
  fetchEntities: jest.fn(),
}));

global.fetch = jest.fn();

const mockFetchEntities = jest.mocked(apiModule.fetchEntities);
const mockFetch = global.fetch as jest.Mock;

const emptyHydra = { 'hydra:member': [], 'hydra:totalItems': 0 };

describe('saddle-modelling services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchEntities.mockResolvedValue(emptyHydra);
  });

  describe('fetchLeathertypes', () => {
    test('passes limit through as a query param when given', async () => {
      await fetchLeathertypes({ page: 1, limit: 500 });

      expect(mockFetchEntities).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'leathertypes',
          extraParams: expect.objectContaining({ limit: 500 }),
        }),
      );
    });

    test('passes includeDeleted=true only when asked', async () => {
      await fetchLeathertypes({ includeDeleted: true });
      expect(mockFetchEntities.mock.calls[0][0].extraParams).toMatchObject({ includeDeleted: true });

      await fetchLeathertypes({ includeDeleted: false });
      expect(mockFetchEntities.mock.calls[1][0].extraParams).not.toHaveProperty('includeDeleted');
    });

    test('does not send limit when not given (backend default applies)', async () => {
      await fetchLeathertypes();

      const call = mockFetchEntities.mock.calls[0][0];
      expect(call.extraParams).not.toHaveProperty('limit');
    });
  });

  describe('fetchPresets', () => {
    test('passes limit through so the backend pages match the UI page size', async () => {
      // Regression: the Presets page assumed 30 per page while the backend
      // served 10, so the UI stopped at page 2 of 5 and 22 presets were unreachable.
      await fetchPresets({ page: 2, limit: 30 });

      expect(mockFetchEntities).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'presets',
          page: 2,
          extraParams: expect.objectContaining({ limit: 30 }),
        }),
      );
    });
  });

  describe('fetchOptions', () => {
    test('passes limit and excludeType through as query params', async () => {
      await fetchOptions({ limit: 500, excludeType: 2 });

      expect(mockFetchEntities).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'options',
          extraParams: expect.objectContaining({ limit: 500, excludeType: 2 }),
        }),
      );
    });
  });

  describe('fetchExtras', () => {
    test('always queries options with type=2 and honours limit', async () => {
      await fetchExtras({ limit: 100 });

      expect(mockFetchEntities).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'options',
          extraParams: expect.objectContaining({ type: 2, limit: 100 }),
        }),
      );
    });
  });

  describe('fetchSaddleLeathersBySaddleId', () => {
    test('requests only active rows by default', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await fetchSaddleLeathersBySaddleId(100);

      expect(mockFetch.mock.calls[0][0]).toMatch(/\/saddle-leathers\/saddle\/100$/);
    });

    test('adds includeDeleted=true so disabled leathers keep showing their prices', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await fetchSaddleLeathersBySaddleId(100, { includeDeleted: true });

      expect(mockFetch.mock.calls[0][0]).toMatch(
        /\/saddle-leathers\/saddle\/100\?includeDeleted=true$/,
      );
    });
  });

  describe('fetchOptionsItemsByOptionId', () => {
    test('fetches the items of one option', async () => {
      const items = [{ id: 1, optionId: 4, name: 'NORMAL Cantle', leatherId: 0 }];
      mockFetch.mockResolvedValue({ ok: true, json: async () => items });

      const result = await fetchOptionsItemsByOptionId(4);

      expect(mockFetch.mock.calls[0][0]).toMatch(/\/option-items\/option\/4$/);
      expect(result).toEqual(items);
    });

    test('throws on a non-OK response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

      await expect(fetchOptionsItemsByOptionId(4)).rejects.toThrow('500');
    });
  });
});
