/**
 * HTTP Client for API Testing
 * Mirrors the authentication and request patterns used by the UI
 */

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

interface ApiError {
  message: string;
  status: number;
  statusText: string;
  data?: unknown;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginUser {
  id?: number;
  email?: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

interface LoginResponse {
  token?: string;
  user?: LoginUser;
  message?: string;
}

export class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private cookies: Map<string, string> = new Map();
  private requestTimeout: number = 30000;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  private isTestEnvironment: boolean = typeof global !== 'undefined' && global.process?.env?.NODE_ENV === 'test';
  private activeRequests = new Set<AbortController>();

  constructor(baseUrl: string = (typeof global !== 'undefined' && global.API_BASE_URL) || 'http://localhost:3001/api') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Set request timeout (in milliseconds)
   */
  setRequestTimeout(timeout: number) {
    this.requestTimeout = timeout;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Clear authentication token and cookies
   */
  clearAuth() {
    this.authToken = null;
    this.cookies.clear();
  }

  /**
   * Clean up all active requests (for test cleanup)
   */
  cleanup() {
    // Abort all active requests without logging to prevent Jest warnings
    const activeControllers = Array.from(this.activeRequests);
    this.activeRequests.clear();

    activeControllers.forEach(controller => {
      try {
        if (controller && !controller.signal.aborted) {
          controller.abort();
        }
      } catch {
        // Silently ignore cleanup errors to prevent Jest warnings
      }
    });

    this.authToken = null;
    this.cookies.clear();
  }

  /**
   * Store cookies from Set-Cookie response headers
   */
  private storeCookies(response: Response) {
    const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
    for (const header of setCookieHeaders) {
      const [cookiePart] = header.split(';');
      const eqIdx = cookiePart.indexOf('=');
      if (eqIdx > 0) {
        const name = cookiePart.substring(0, eqIdx).trim();
        const value = cookiePart.substring(eqIdx + 1).trim();
        this.cookies.set(name, value);
      }
    }
  }

  /**
   * Get cookie header string
   */
  private getCookieHeader(): string {
    const parts: string[] = [];
    this.cookies.forEach((value, name) => {
      parts.push(`${name}=${value}`);
    });
    return parts.join('; ');
  }

  /**
   * Safe console logging that respects Jest lifecycle
   */
  private safeLog(level: 'log' | 'warn' | 'error', message: string) {
    // Only log during active test execution, not during cleanup
    if (this.isTestEnvironment && typeof jest !== 'undefined' && (jest as { isTornDown?: boolean }).isTornDown) {
      return; // Jest is shutting down, don't log
    }

    // In test environment, be more conservative about logging
    if (this.isTestEnvironment) {
      return; // Suppress all logging in tests to prevent "Cannot log after tests are done"
    }

    console[level](message);
  }

  /**
   * Get common headers used by the UI
   */
  private getHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...additionalHeaders
    };

    // Send cookies via Cookie header (Node.js fetch doesn't have a cookie jar)
    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    // Legacy fallback: set token as cookie if authToken was set manually
    if (this.authToken && !this.cookies.has('token')) {
      headers['Cookie'] = headers['Cookie']
        ? `${headers['Cookie']}; token=${this.authToken}`
        : `token=${this.authToken}`;
    }

    return headers;
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  private async request<T = unknown>(
    method: string,
    endpoint: string,
    data?: unknown,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.makeRequest<T>(method, endpoint, data, headers);
      } catch (error: unknown) {
        // Don't retry for HTTP errors (401, 403, etc.) - only for network errors
        if (error && typeof error === 'object' && 'status' in error && (error as ApiError).status > 0) {
          throw error;
        }

        // Don't retry on the last attempt
        if (attempt === this.maxRetries) {
          throw error;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Make single HTTP request with error handling
   */
  private async makeRequest<T = unknown>(
    method: string,
    endpoint: string,
    data?: unknown,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    this.activeRequests.add(controller);

    const timeoutId = setTimeout(() => {
      try {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      } catch {
        // Ignore timeout abort errors
      } finally {
        this.activeRequests.delete(controller);
      }
    }, this.requestTimeout);

    const config: RequestInit = {
      method,
      headers: this.getHeaders(headers),
      credentials: 'include', // Include cookies like the UI does
      signal: controller.signal,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      this.activeRequests.delete(controller);

      // Store any cookies from the response
      this.storeCookies(response);

      let responseData;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Convert headers to plain object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      if (!response.ok) {
        const error: ApiError = {
          message: responseData?.message || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
          data: responseData
        };
        throw error;
      }

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      };
    } catch (error) {
      clearTimeout(timeoutId);
      this.activeRequests.delete(controller);

      // Check if it's already an API error with status (from our throw above)
      if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' && error.status > 0) {
        throw error; // Re-throw API errors with valid HTTP status
      }

      // Handle AbortError (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        // Don't log abort errors in test environment to prevent Jest warnings
        this.safeLog('warn', `Request aborted: ${method} ${url}`);
        throw {
          message: 'Request timeout',
          status: 408,
          statusText: 'Request Timeout',
          data: null
        } as ApiError;
      }

      // Handle network errors (connection failed, etc.)
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      this.safeLog('warn', `API request failed: ${method} ${url} - ${errorMessage}`);

      throw {
        message: errorMessage,
        status: 0,
        statusText: 'Network Error',
        data: null
      } as ApiError;
    }
  }

  /**
   * Authentication - matches UI login flow
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    // Use JSON data for NestJS backend
    const loginData = {
      email: credentials.username, // Convert username to email format
      password: credentials.password
    };

    const response = await fetch(`${this.baseUrl}/v1/auth/email/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(loginData),
      credentials: 'include'
    });

    this.storeCookies(response);

    let data: { token?: string; accessToken?: string; user?: LoginUser; message?: string };
    try {
      data = await response.json() as typeof data;
    } catch {
      data = {};
    }

    if (!response.ok) {
      return {
        message: data.message || `Authentication failed: ${response.statusText}`
      };
    }

    // Extract token from NestJS response structure
    const token = data.token || data.accessToken;
    if (token) {
      this.setAuthToken(token);
    }

    return {
      token,
      user: data.user,
      message: data.message || 'Login successful'
    };
  }

  /**
   * Test if user is authenticated
   */
  async checkAuth(): Promise<boolean> {
    if (!this.authToken && !this.cookies.has('token')) {
      return false;
    }

    try {
      // Try accessing a protected endpoint
      await this.get('/v1/users');
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && (error.status === 401 || error.status === 0)) {
        this.clearAuth();
        return false;
      }
      // Other errors might not be auth-related
      return true;
    }
  }

  /**
   * HTTP Methods
   */
  async get<T = unknown>(endpoint: string, params?: Record<string, string | number | boolean | null | undefined>): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      url += `?${searchParams.toString()}`;
    }
    return this.request<T>('GET', url);
  }

  async post<T = unknown>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, data);
  }

  async put<T = unknown>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, data);
  }

  async patch<T = unknown>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, data);
  }

  async delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint);
  }

  /**
   * Health check endpoint
   */
  async health(): Promise<ApiResponse> {
    return this.get('/health');
  }

  /**
   * Get base URL for reference
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get current auth token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }
}

// Export singleton instance for tests
export const apiClient = new ApiClient();

// Export error type for tests
export type { ApiError, ApiResponse, LoginCredentials, LoginResponse };