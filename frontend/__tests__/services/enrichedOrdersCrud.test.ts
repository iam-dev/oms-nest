import { createOrderFromPayload, updateOrder, fetchOrderDetail } from '@/services/enrichedOrders';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Enriched Orders CRUD Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrderFromPayload', () => {
    it('should POST to /api/v1/enriched_orders/create with JSON body', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true, orderId: 999 }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const payload = {
        fitterId: 5,
        specialNotes: 'New order',
        customerName: 'John Doe',
      };

      const result = await createOrderFromPayload(payload);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/enriched_orders/create',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify(payload),
        })
      );

      expect(result).toEqual({ success: true, orderId: 999 });
    });

    it('should throw error on non-ok response with server message', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ message: 'Validation failed' }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(
        createOrderFromPayload({ specialNotes: 'Bad data' })
      ).rejects.toThrow('Validation failed');
    });

    it('should throw fallback error when server returns no message', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Not JSON')),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(
        createOrderFromPayload({ specialNotes: 'Error' })
      ).rejects.toThrow('Failed to create order: 500');
    });
  });

  describe('updateOrder', () => {
    it('should PATCH to /api/v1/enriched_orders/update/{id} with JSON body', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true, orderId: 100 }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const payload = { specialNotes: 'Updated notes' };

      const result = await updateOrder(100, payload);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/enriched_orders/update/100',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
          credentials: 'include',
          body: JSON.stringify(payload),
        })
      );

      expect(result).toEqual({ success: true, orderId: 100 });
    });

    it('should throw error with server message on failure', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValue({ message: 'Fitters cannot edit orders with status: Approved' }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(
        updateOrder(100, { specialNotes: 'Forbidden' })
      ).rejects.toThrow('Fitters cannot edit orders with status: Approved');
    });

    it('should throw fallback error when server returns no message', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Not JSON')),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(
        updateOrder(100, { specialNotes: 'Error' })
      ).rejects.toThrow('Failed to update order: 500');
    });
  });

  describe('fetchOrderDetail', () => {
    it('should GET from /api/v1/enriched_orders/detail/{id}', async () => {
      const mockOrderDetail = {
        id: 100,
        orderId: 100,
        customerName: 'John Doe',
        fitterName: 'Expert Fitter',
        brandName: 'Premium',
        modelName: 'Classic',
        orderStatus: 'Pending',
        priceSaddle: 2500,
        saddleSpecs: [],
        comments: [],
        logEntries: [],
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockOrderDetail),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await fetchOrderDetail(100);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/enriched_orders/detail/100',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
          }),
          credentials: 'include',
        })
      );

      expect(result).toEqual(mockOrderDetail);
      expect(result.customerName).toBe('John Doe');
    });

    it('should throw error on non-ok response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(fetchOrderDetail(999)).rejects.toThrow(
        'Failed to fetch order detail: 404 Not Found'
      );
    });

    it('should include credentials for cookie-based auth', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 1 }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await fetchOrderDetail(1);

      const callArgs = (fetch as jest.Mock).mock.calls[0][1];
      expect(callArgs.credentials).toBe('include');
    });
  });
});
