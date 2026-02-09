import { updateCustomer } from '@/services/customers';

// Mock fetch globally
global.fetch = jest.fn();

describe('Customer Update Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully update a customer', async () => {
    const mockCustomer = {
      id: 'test-123',
      name: 'John Doe Updated',
      email: 'john.updated@example.com',
      address: '123 Main St',
      city: 'New York',
      country: 'USA',
      state: 'NY',
      zipcode: '10001',
      phoneNo: '555-1234',
      cellNo: '555-5678'
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockCustomer)
    });

    const result = await updateCustomer('test-123', {
      name: 'John Doe Updated',
      email: 'john.updated@example.com'
    });

    expect(result).toEqual(mockCustomer);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/customers/test-123'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }),
        body: JSON.stringify({
          name: 'John Doe Updated',
          email: 'john.updated@example.com'
        })
      })
    );
  });

  it('should throw error for failed updates', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: jest.fn().mockResolvedValueOnce('Validation failed')
    });

    await expect(
      updateCustomer('test-789', { name: '' })
    ).rejects.toThrow('Failed to update customer: 400 Bad Request');
  });

  it('should throw error for server errors', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: jest.fn().mockResolvedValueOnce('Server error')
    });

    await expect(
      updateCustomer('test-456', { name: 'Jane Doe' })
    ).rejects.toThrow('Failed to update customer: 500 Internal Server Error');
  });

  it('should send correct credentials for cookie-based auth', async () => {
    const mockCustomer = {
      id: 'test-auth',
      name: 'Auth Test',
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockCustomer)
    });

    await updateCustomer('test-auth', { name: 'Auth Test' });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }),
      })
    );
  });
});
