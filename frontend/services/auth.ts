import { API_URL, fetchWithRefresh } from './api-config';

/**
 * Self-service profile fields every signed-in role may change about
 * themselves. Username and email are the legacy login identity and are
 * not editable here; account managers change those via User Management.
 */
export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
}

async function throwResponseError(response: Response, fallback: string): Promise<never> {
  const errorData = await response.json().catch(() => ({}));
  // NestJS validation errors (422) return { errors: { field: "message" } }
  if (errorData.errors && typeof errorData.errors === 'object') {
    const messages = Object.entries(errorData.errors)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join(', ');
    throw new Error(messages);
  }
  throw new Error(errorData.message || `${fallback}: ${response.statusText}`);
}

/**
 * Update the signed-in user's own profile via PATCH /auth/me.
 *
 * This deliberately does not go through /users/:id: that endpoint is
 * Supervisor-only account management, whereas every role is allowed to
 * edit their own name.
 */
export async function updateProfile(data: UpdateProfileData): Promise<void> {
  const payload: UpdateProfileData = {};
  if (data.firstName !== undefined) payload.firstName = data.firstName;
  if (data.lastName !== undefined) payload.lastName = data.lastName;

  const response = await fetchWithRefresh(`${API_URL}/api/v1/auth/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwResponseError(response, 'Failed to update profile');
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const response = await fetchWithRefresh(`${API_URL}/api/v1/auth/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ password: newPassword, oldPassword }),
  });

  if (!response.ok) {
    await throwResponseError(response, 'Failed to change password');
  }
}
