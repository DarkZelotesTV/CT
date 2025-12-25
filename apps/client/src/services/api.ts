import { getAllowInsecureHttp, normalizeServerUrlString } from '../utils/apiConfig';

const DEFAULT_BASE_URL = (() => {
  const allowInsecure = getAllowInsecureHttp();
  const envValue = import.meta?.env?.VITE_API_URL as string | undefined;
  const fallback = 'https://localhost:3000';
  return normalizeServerUrlString(envValue || fallback, { allowInsecure });
})();

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

const buildHeaders = (headers?: Record<string, string>): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(headers || {}),
});

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const url = `${DEFAULT_BASE_URL}${path}`;
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: buildHeaders(options.headers),
  };

  if (options.signal !== undefined) {
    init.signal = options.signal;
  }

  if (options.body !== undefined) {
    init.body = options.body === null ? null : JSON.stringify(options.body);
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`API request failed (${response.status}): ${message || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

export type { RequestOptions };
