import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Server-side: use internal Docker network URL to bypass Cloudflare/reverse-proxy.
// Client-side: use the public URL (NEXT_PUBLIC_ vars are baked at build time).
const BASE_URL =
  (typeof window === 'undefined' ? process.env.INTERNAL_API_URL : undefined) ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:8080/api/v1';

let _accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  _accessToken = token;
};

export const getAccessToken = (): string | null => _accessToken;

export const clearTokens = () => {
  _accessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('refreshToken');
  }
};

export const apiClient = axios.create({ baseURL: BASE_URL });

// Unwrap backend's standard { success, data, message } envelope
apiClient.interceptors.response.use((res) => {
  if (res.data && typeof res.data === 'object' && 'success' in res.data && 'data' in res.data) {
    res.data = res.data.data;
  }
  return res;
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      const { refreshTokens } = await import('@/lib/auth-refresh');
      const tokens = await refreshTokens();
      original.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return apiClient(original);
    } catch {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  }
);
