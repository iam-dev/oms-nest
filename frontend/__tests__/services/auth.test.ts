import { updateProfile, changePassword } from '@/services/auth';

// Mock fetch globally (fetchWithRefresh delegates to global fetch)
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.Mock;

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateProfile', () => {
    test('PATCHes /auth/me, never the Supervisor-only /users/:id', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await updateProfile({ firstName: 'Ada', lastName: 'Lovelace' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/api\/v1\/auth\/me$/);
      expect(url).not.toMatch(/\/api\/v1\/users\//);
      expect(options).toMatchObject({ method: 'PATCH', credentials: 'include' });
      expect(JSON.parse(options.body)).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    });

    test('sends an empty lastName so a surname can be cleared', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await updateProfile({ firstName: 'Ada', lastName: '' });

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ firstName: 'Ada', lastName: '' });
    });

    test('omits fields that were not provided', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await updateProfile({ firstName: 'Ada' });

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ firstName: 'Ada' });
    });

    test('surfaces NestJS field validation errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: async () => ({ errors: { firstName: 'mustBeNotEmpty' } }),
      });

      await expect(updateProfile({ firstName: '' })).rejects.toThrow(
        'firstName: mustBeNotEmpty',
      );
    });

    test('falls back to the response message on other failures', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'Forbidden resource' }),
      });

      await expect(updateProfile({ firstName: 'Ada' })).rejects.toThrow('Forbidden resource');
    });
  });

  describe('changePassword', () => {
    test('PATCHes /auth/me with old and new password', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await changePassword('old-secret', 'new-secret');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/api\/v1\/auth\/me$/);
      expect(JSON.parse(options.body)).toEqual({
        password: 'new-secret',
        oldPassword: 'old-secret',
      });
    });

    test('surfaces the backend error for a wrong current password', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: async () => ({ errors: { oldPassword: 'incorrectOldPassword' } }),
      });

      await expect(changePassword('wrong', 'new-secret')).rejects.toThrow(
        'oldPassword: incorrectOldPassword',
      );
    });
  });
});
