import { fetchUsers, createUser, updateUser, deleteUser } from '@/services/users';
import { UserRole } from '@/types/Role';

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.Mock;

describe('Users Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage for token
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(JSON.stringify('mock-token')),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
  });

  describe('fetchUsers', () => {
    test('fetches users with correct parameters', async () => {
      const mockResponse = {
        data: [
          {
            id: '1',
            username: 'testuser',
            email: 'test@example.com',
            name: 'Test User',
            typeName: 'admin',
          }
        ],
        totalCount: 1,
        hasNextPage: false,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchUsers();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users'),
        expect.objectContaining({
          credentials: 'include',
        })
      );

      expect(result['hydra:member']).toHaveLength(1);
      expect(result['hydra:totalItems']).toBe(1);
    });

    test('fetches users with custom parameters', async () => {
      const mockResponse = {
        data: [],
        totalCount: 0,
        hasNextPage: false,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await fetchUsers({
        page: 2,
        filters: { username: 'test' },
        orderBy: 'email',
        partial: true
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.anything()
      );
    });

    test('handles fetch users error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      await expect(fetchUsers()).rejects.toThrow('Failed to fetch users');
    });

    test('maps backend roles correctly', async () => {
      const mockResponse = {
        data: [
          { id: '1', username: 'admin1', name: 'Admin User', typeName: 'admin' },
          { id: '2', username: 'fitter1', name: 'Fitter User', typeName: 'fitter' },
          { id: '3', username: 'factory1', name: 'Factory User', typeName: 'factory' },
        ],
        totalCount: 3,
        hasNextPage: false,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchUsers();

      expect(result['hydra:member'][0].role).toBe(UserRole.ADMIN);
      expect(result['hydra:member'][1].role).toBe(UserRole.FITTER);
      expect(result['hydra:member'][2].role).toBe(UserRole.SUPPLIER);
    });
  });

  describe('createUser', () => {
    test('creates user with SaveBundle format', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'securepassword',
        firstName: 'New',
        lastName: 'User',
        role: UserRole.USER,
      };

      const mockResponse = {
        Entities: [{
          id: '123',
          username: 'newuser',
          name: 'New User',
          email: 'newuser@example.com',
        }]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createUser(userData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/save'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('entityAspect'),
        })
      );

      expect(result).toBeDefined();
    });

    test('handles create user error', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'securepassword',
        firstName: 'New',
        lastName: 'User',
        role: UserRole.USER,
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Failed',
      });

      await expect(createUser(userData)).rejects.toThrow('Failed to create user');
    });

    test('handles SaveBundle error response', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'securepassword',
        firstName: 'New',
        lastName: 'User',
        role: UserRole.USER,
      };

      const mockResponse = {
        Errors: [{ ErrorMessage: 'Username already exists' }],
        Entities: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(createUser(userData)).rejects.toThrow('User creation failed');
    });
  });

  describe('updateUser', () => {
    test('updates user via PATCH endpoint', async () => {
      const userId = '123';
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com',
      };

      const mockResponse = {
        id: userId,
        username: 'testuser',
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await updateUser(userId, updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/users/${userId}`),
        expect.objectContaining({
          method: 'PATCH',
        })
      );

      expect(result).toBeDefined();
    });

    test('handles update user error', async () => {
      const userId = '123';
      const updateData = { firstName: 'Updated' };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      });

      await expect(updateUser(userId, updateData)).rejects.toThrow('Failed to update user');
    });

    test('updates user role', async () => {
      const userId = '123';
      const updateData = {
        role: UserRole.ADMIN
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: userId, role: UserRole.ADMIN }),
      });

      await updateUser(userId, updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/users/${userId}`),
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('deleteUser', () => {
    test('deletes user with correct ID', async () => {
      const userId = '123';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await deleteUser(userId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/users/${userId}`),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    test('handles delete user error', async () => {
      const userId = '123';

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Failed to delete user',
        json: async () => ({ message: 'Failed to delete user' }),
      });

      await expect(deleteUser(userId)).rejects.toThrow('Failed to delete user');
    });

    test('handles non-existent user deletion', async () => {
      const userId = 'non-existent';

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: async () => ({ message: 'User not found' }),
      });

      await expect(deleteUser(userId)).rejects.toThrow('User not found');
    });
  });

  describe('Error Handling', () => {
    test('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(fetchUsers()).rejects.toThrow('Network error');
    });

    test('handles API errors with proper error messages', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Unauthorized',
      });

      await expect(fetchUsers()).rejects.toThrow();
    });
  });

  describe('Data Validation', () => {
    test('handles different user roles correctly', async () => {
      const roles = [UserRole.USER, UserRole.FITTER, UserRole.SUPPLIER, UserRole.ADMIN, UserRole.SUPERVISOR];

      for (const role of roles) {
        const userData = {
          username: `user_${role}`,
          email: `${role}@example.com`,
          password: 'password',
          firstName: 'Test',
          lastName: 'User',
          role,
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            Entities: [{ id: '123', username: userData.username, name: 'Test User', role }]
          }),
        });

        const result = await createUser(userData);

        expect(result).toBeDefined();
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/save'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      }
    });

    test('handles user activation status changes', async () => {
      const userId = '123';

      // Test updating user
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ Entities: [{ id: userId }] }),
      });

      await updateUser(userId, { firstName: 'Updated' });
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
