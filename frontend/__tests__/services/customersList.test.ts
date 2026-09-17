import { fetchCustomers } from '@/services/customers';
import { fetchEntities } from '@/services/api';

jest.mock('@/services/api', () => ({
  fetchEntities: jest.fn(),
}));

const mockFetchEntities = fetchEntities as jest.MockedFunction<typeof fetchEntities>;

describe('fetchCustomers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchEntities.mockResolvedValue({ 'hydra:member': [], 'hydra:totalItems': 27679 });
  });

  it('forwards the page size so the backend paginates the way the UI counts pages', async () => {
    // Regression: the Customers page assumed 20 per page while the backend
    // served 30, so LAST requested page 1384 of 923 and rendered nothing.
    await fetchCustomers({ page: 1384, limit: 20 });

    expect(mockFetchEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'customers',
        page: 1384,
        extraParams: expect.objectContaining({ limit: 20 }),
      }),
    );
  });
});
