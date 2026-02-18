import { vi } from 'vitest';

export function mockApiResponse<T>(data: T) {
  return Promise.resolve(data);
}

export function mockApiError(message: string, status = 400) {
  const error = new Error(message);
  (error as unknown as Record<string, unknown>).status = status;
  return Promise.reject(error);
}

export function createMockApi() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
}
