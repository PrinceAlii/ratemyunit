import type { ApiResponse } from '@ratemyunit/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiClient {
  private csrfToken: string | null = null;

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    
    const response = await fetch(`${API_URL}/api/auth/csrf`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (data.success && data.data?.token) {
      this.csrfToken = data.data.token;
      return this.csrfToken!;
    }
    throw new Error('Failed to fetch CSRF token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    const needsCsrf = options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method);

    if (needsCsrf && !this.csrfToken) {
      try {
        await this.getCsrfToken();
      } catch (e) {
        console.warn('Could not pre-fetch CSRF token', e);
      }
    }

    const executeRequest = async (): Promise<Response> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (options.headers) {
        const inputHeaders = options.headers as Record<string, string>;
        Object.assign(headers, inputHeaders);
      }

      if (needsCsrf && this.csrfToken) {
        headers['x-csrf-token'] = this.csrfToken;
      }

      return fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    };

    let response = await executeRequest().catch(error => {
      console.error('Fetch error:', error);
      throw error;
    });

    // Handle expired CSRF token (usually 403)
    if (response.status === 403 && needsCsrf) {
       this.csrfToken = null;
       await this.getCsrfToken();
       response = await executeRequest();
    }

    const data: ApiResponse<T> = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'An error occurred');
    }

    return data.data as T;
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
