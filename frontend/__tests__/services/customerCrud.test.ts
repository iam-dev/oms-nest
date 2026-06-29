import { createCustomer, updateCustomer, deleteCustomer } from '@/services/customers';
import { createFitter, updateFitter, deleteFitter } from '@/services/fitters';

// Mock fetch for testing
global.fetch = jest.fn();

// No localStorage mock needed - auth is cookie-based

describe('Customer CRUD Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // No token mock needed - auth is cookie-based
  });

  describe('createCustomer', () => {
    it('should create customer using REST API format', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '123', name: 'Test Customer', email: 'test@example.com'
        }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const customerData = {
        name: 'Test Customer',
        email: 'test@example.com',
        city: 'Test City'
      };

      const result = await createCustomer(customerData);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/customers',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify(customerData),
        })
      );

      expect(result).toEqual({
        id: '123',
        name: 'Test Customer',
        email: 'test@example.com'
      });
    });

    it('should handle standard JSON request format', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: '456', name: 'Test' }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await createCustomer({ name: 'Test' });

      const requestBody = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);

      expect(requestBody).toEqual({
        name: 'Test'
      });
    });
  });

  describe('updateCustomer', () => {
    it('should update customer using REST API format', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '123', name: 'Updated Customer'
        }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await updateCustomer('123', { name: 'Updated Customer' });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/customers/123',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify({ name: 'Updated Customer' }),
        })
      );
    });
  });

  describe('deleteCustomer', () => {
    it('should delete customer using REST API format', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await deleteCustomer('123');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/customers/123',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Accept': 'application/json',
          }),
          credentials: 'include',
        })
      );
    });
  });
});

describe('Fitter CRUD Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // No token mock needed - auth is cookie-based
  });

  describe('createFitter', () => {
    it('should create fitter using REST API format', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 123, name: 'Test Fitter', username: 'testfitter'
        }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const fitterData = {
        name: 'Test Fitter',
        username: 'testfitter',
        email: 'test@example.com'
      };

      const result = await createFitter(fitterData);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/fitters',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify(fitterData),
        })
      );

      expect(result).toEqual({
        id: 123,
        name: 'Test Fitter',
        username: 'testfitter'
      });
    });

    it('should send correct data structure for fitter', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 456, name: 'Test' }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await createFitter({ name: 'Test' });

      const requestBody = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);

      expect(requestBody).toEqual({ name: 'Test' });
    });
  });

  describe('updateFitter', () => {
    it('should update fitter using REST API format', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 123, name: 'Updated Fitter'
        }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await updateFitter(123, { name: 'Updated Fitter' });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/fitters/123',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify({ name: 'Updated Fitter' }),
        })
      );
    });
  });

  describe('deleteFitter', () => {
    it('should delete fitter using REST API format', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await deleteFitter(123);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/fitters/123',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Accept': 'application/json',
          }),
          credentials: 'include',
        })
      );
    });
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // No token mock needed - auth is cookie-based
  });

  it('should handle server errors gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: jest.fn().mockResolvedValue(JSON.stringify({
        'message': 'server error occurred'
      })),
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    // Should throw error for server issues
    await expect(createCustomer({ name: 'Test' })).rejects.toThrow('Failed to create customer: 500');
  });

  it('should throw error for actual failures', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: jest.fn().mockResolvedValue('Real error'),
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    await expect(createCustomer({ name: 'Test' })).rejects.toThrow('Failed to create customer: 400 Bad Request');
  });
});