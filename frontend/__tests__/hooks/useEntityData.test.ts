import { renderHook, act, waitFor } from '@testing-library/react';
import { useEntityData } from '@/hooks/useEntityData';

// Mock the API service
jest.mock('@/services/api', () => ({
  fetchEntities: jest.fn()
}));

// Import the mocked function
import { fetchEntities } from '@/services/api';

describe('useEntityData Hook', () => {
  const mockData = [
    { id: '1', name: 'Entity 1' },
    { id: '2', name: 'Entity 2' },
  ];
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('initializes with loading state and fetches data', async () => {
    // Set up the mock to resolve with the expected data structure
    // The hook expects either an array or a hydra response
    (fetchEntities as jest.Mock).mockImplementation(() => {
      return Promise.resolve(mockData);
    });
    
    const { result } = renderHook(() => 
      useEntityData({
        entity: 'orders',
        autoFetch: true,
      })
    );
    
    // Initial state should be loading
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe('');
    
    // Wait for the fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Should have data now
    expect(result.current.data).toEqual(mockData);
    
    // Verify API was called with correct params
    expect(fetchEntities).toHaveBeenCalledWith({
      entity: 'orders',
      page: 1,
      partial: true,
      orderBy: '',
      filter: '',
      extraParams: {},
    });
  });
  
  test('handles hydra:member response format', async () => {
    // Mock a hydra response format
    const hydraResponse = {
      'hydra:member': mockData,
      'hydra:totalItems': 10
    };
    
    (fetchEntities as jest.Mock).mockImplementation(() => {
      return Promise.resolve(hydraResponse);
    });
    
    const { result } = renderHook(() => 
      useEntityData({
        entity: 'orders',
      })
    );
    
    // Wait for the fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Should have data from hydra:member
    expect(result.current.data).toEqual(mockData);
    expect(result.current.totalItems).toBe(10);
  });
  
  test('does not fetch automatically when autoFetch is false', async () => {
    renderHook(() => 
      useEntityData({
        entity: 'orders',
        autoFetch: false,
      })
    );
    
    // API should not have been called
    expect(fetchEntities).not.toHaveBeenCalled();
  });
  
  test('handles API errors', async () => {
    // Mock API to throw an error
    const error = new Error('API error');
    (fetchEntities as jest.Mock).mockImplementation(() => {
      return Promise.reject(error);
    });
    
    const { result } = renderHook(() => 
      useEntityData({
        entity: 'orders',
      })
    );
    
    // Wait for the fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Should have error
    expect(result.current.error).toBe('API error');
    expect(result.current.data).toEqual([]);
  });
  
  test('refetches data when parameters change', async () => {
    // Mock first fetch
    (fetchEntities as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve(mockData);
    });
    
    const { result, rerender } = renderHook(
      (props) => useEntityData(props),
      {
        initialProps: {
          entity: 'orders',
          page: 1,
          filter: '',
        },
      }
    );
    
    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Clear mock calls
    (fetchEntities as jest.Mock).mockClear();
    
    // Mock second fetch
    (fetchEntities as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve(mockData);
    });
    
    // Change page
    rerender({
      entity: 'orders',
      page: 2,
      filter: '',
    });
    
    // Should be loading again
    expect(result.current.loading).toBe(true);
    
    // Wait for the fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Verify API was called with new page
    expect(fetchEntities).toHaveBeenCalledWith({
      entity: 'orders',
      page: 2,
      partial: true,
      orderBy: '',
      filter: '',
      extraParams: {},
    });
  });
  
  test('manually refetches data', async () => {
    // Mock first fetch
    (fetchEntities as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve(mockData);
    });
    
    const { result } = renderHook(() => 
      useEntityData({
        entity: 'orders',
      })
    );
    
    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Clear mock calls
    (fetchEntities as jest.Mock).mockClear();
    
    // Mock second fetch for refetch
    (fetchEntities as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve(mockData);
    });
    
    // Manually refetch
    act(() => {
      result.current.refetch();
    });
    
    // Should be loading again
    expect(result.current.loading).toBe(true);
    
    // Wait for the fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Verify API was called again
    expect(fetchEntities).toHaveBeenCalled();
  });
  
  test('uses initialData when provided', async () => {
    const initialData = [{ id: '3', name: 'Initial Entity' }];
    
    // Mock fetch that will replace initial data
    // We need to wait for the useEffect to run and then resolve the promise
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    
    (fetchEntities as jest.Mock).mockImplementation(() => {
      return promise;
    });
    
    const { result } = renderHook(() => 
      useEntityData({
        entity: 'orders',
        initialData,
      })
    );
    
    // Should start with initialData
    expect(result.current.data).toEqual(initialData);
    
    // Resolve the promise with mockData
    act(() => {
      resolvePromise(mockData);
    });
    
    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Should have updated data
    expect(result.current.data).toEqual(mockData);
  });
});
