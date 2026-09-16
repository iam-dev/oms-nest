/**
 * NestJS list endpoints return `{ data, total, pages }` with `isActive` /
 * `deleted`, while the table columns (written against the old API-Platform
 * shape) read `active`. The generic mapping must bridge that so ACTIVE
 * columns don't show "No" for every row.
 */
import { fetchEntities } from '@/services/api';
import * as apiConfig from '@/services/api-config';

jest.mock('@/services/api-config', () => ({
  API_URL: 'http://api.test',
  fetchWithRefresh: jest.fn(),
}));

const mockFetchWithRefresh = jest.mocked(apiConfig.fetchWithRefresh);

function okJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response;
}

describe('fetchEntities generic NestJS → hydra mapping', () => {
  beforeEach(() => jest.clearAllMocks());

  test('derives `active` from isActive / deleted when the row has no `active`', async () => {
    mockFetchWithRefresh.mockResolvedValue(
      okJson({
        data: [
          { id: 1, name: 'A', isActive: true, deleted: 0 },
          { id: 2, name: 'B', isActive: false, deleted: 1 },
          { id: 3, name: 'C', deleted: 0 },
          { id: 4, name: 'D', active: false, isActive: true },
        ],
        total: 4,
        pages: 1,
      }),
    );

    const result = await fetchEntities({ entity: 'leathertypes' });

    expect(result['hydra:totalItems']).toBe(4);
    expect(result['hydra:member'].map((r: { active?: boolean }) => r.active)).toEqual([
      true,
      false,
      true,
      false, // an explicit `active` is never overridden
    ]);
  });

  test('leaves rows untouched when neither isActive nor deleted is present', async () => {
    mockFetchWithRefresh.mockResolvedValue(
      okJson({ data: [{ id: 1, name: 'X' }], total: 1, pages: 1 }),
    );

    const result = await fetchEntities({ entity: 'leathertypes' });

    expect(result['hydra:member'][0]).toEqual({ id: 1, name: 'X' });
  });
});
