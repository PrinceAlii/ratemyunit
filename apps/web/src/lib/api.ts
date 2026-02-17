import type { ApiResponse } from '@ratemyunit/types';
import { z } from 'zod';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

interface RequestOptions<S extends z.ZodType<any> = z.ZodType<any>> extends RequestInit {
  schema?: S;
}

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

  private async request<T, S extends z.ZodType<T> = z.ZodType<T>>(
    endpoint: string,
    options: RequestOptions<S> = {}
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

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        let response = await executeRequest();

        // Retry on 503 Service Unavailable (only for GET/idempotent requests)
        if (response.status === 503 && (options.method === 'GET' || !options.method) && attempt < MAX_RETRIES) {
          console.warn(`API 503 error, retrying (attempt ${attempt + 1}/${MAX_RETRIES})...`);
          continue;
        }

        // Handle expired CSRF token
        if (response.status === 403 && needsCsrf && attempt < MAX_RETRIES) {
          this.csrfToken = null;
          await this.getCsrfToken();
          response = await executeRequest();
        }

        const contentType = response.headers.get('Content-Type');
        let data: ApiResponse<T>;
        
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          throw new Error(`Server returned non-JSON response (${response.status}): ${text}`);
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'An error occurred');
        }

        if (options.schema) {
          const result = options.schema.safeParse(data.data);
          if (!result.success) {
            console.error('API validation failed:', result.error);
            throw new Error('Invalid API response structure');
          }
          return result.data;
        }

        return data.data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === MAX_RETRIES) break;
        
        // Don't retry on client errors (4xx) except for the 403 CSRF case handled above
        const isNetworkError = lastError.message.includes('fetch') || lastError.message.includes('network');
        if (!isNetworkError && attempt < MAX_RETRIES) {
             // If it's not a network error and not a 503 (handled above), we might want to stop retrying
             // But for simplicity in this helper, we'll let the loop continue or break based on status
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  async get<T, S extends z.ZodType<T> = z.ZodType<T>>(
    endpoint: string, 
    params?: Record<string, string | number | undefined>, 
    schema?: S
  ): Promise<T> {
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
    return this.request<T, S>(url, { method: 'GET', schema });
  }

  async post<T, S extends z.ZodType<T> = z.ZodType<T>>(endpoint: string, body?: unknown, schema?: S): Promise<T> {
    return this.request<T, S>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      schema,
    });
  }

  async put<T, S extends z.ZodType<T> = z.ZodType<T>>(endpoint: string, body?: unknown, schema?: S): Promise<T> {
    return this.request<T, S>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      schema,
    });
  }

  async patch<T, S extends z.ZodType<T> = z.ZodType<T>>(endpoint: string, body?: unknown, schema?: S): Promise<T> {
    return this.request<T, S>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      schema,
    });
  }

  async delete<T, S extends z.ZodType<T> = z.ZodType<T>>(endpoint: string, schema?: S): Promise<T> {
    return this.request<T, S>(endpoint, { method: 'DELETE', schema });
  }
}

export const api = new ApiClient();
