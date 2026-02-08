import { logger } from '@/utils/logger';
import { API_URL } from '@/services/api-config';

export interface LoginResponse {
  success: boolean;
  userId?: string | number;
  message?: string;
  user?: any;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/email/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include', // Important for cookies
      body: JSON.stringify({
        email: username, // Backend accepts both username and email
        password: password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.message || 'Authentication failed',
      };
    }

    // Get response data - token is set as httpOnly cookie by backend
    const data = await response.json();

    // Get user info from response body
    const user = data.user;
    if (!user || !user.id) {
      return {
        success: false,
        message: 'No user data received from server',
      };
    }

    // Store minimal user info for UI display
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_user', JSON.stringify(user));
    }

    return {
      success: true,
      userId: user.id,
      user,
    };
  } catch (error) {
    logger.error('Login error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
}

// Helper function to clear auth tokens
export function clearAuthTokens() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_user');
  }
}

// Logout function
export async function logout(): Promise<void> {
  try {
    // Call backend logout endpoint
    const response = await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    // Clear local tokens regardless of backend response
    clearAuthTokens();

    if (!response.ok) {
      logger.warn('Logout endpoint failed, but tokens cleared locally');
    }
  } catch (error) {
    logger.error('Logout error:', error);
    // Still clear local tokens even if network fails
    clearAuthTokens();
  }
}
