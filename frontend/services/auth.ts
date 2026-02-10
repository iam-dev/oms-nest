import { API_URL, fetchWithRefresh } from './api-config';

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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to change password: ${response.statusText}`);
  }
}
