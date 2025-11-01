import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getOrCreateSessionId } from './session';
import { safeParseOr } from './schemas';

// Clerk token getter - will be set by ClerkProvider if available
let getClerkTokenFn: (() => Promise<string | null>) | null = null;

// Export function for Clerk to register token getter
export function setClerkTokenGetter(fn: (() => Promise<string | null>) | null) {
  getClerkTokenFn = fn;
}

// Unified API base: use '/api' in dev (Vite proxy), or VITE_API_BASE_URL in prod
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api') as string;

// Offline state management - distinguish backend vs internet
let isBackendUnavailable = false;
let isInternetOffline = false;
const offlineListeners = new Set<(backend: boolean, internet: boolean) => void>();

// Listen to browser online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setInternetStatus(false);
  });
  window.addEventListener('offline', () => {
    setInternetStatus(true);
  });
}

// Helper to check if error is backend-specific (localhost:3001 connection refused)
function isBackendError(error: AxiosError): boolean {
  if (!error.config) return false;
  const url = error.config.url || '';
  const baseURL = error.config.baseURL || API_BASE_URL;
  const fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`;
  
  // ANY request going through /api is a backend request (Vite proxy routes /api -> localhost:3001)
  // OR direct requests to localhost:3001
  const isApiRequest = url.includes('/api') || baseURL.includes('/api') || fullUrl.includes('localhost:3001') || fullUrl.includes('127.0.0.1:3001');
  
  return (
    isApiRequest || // ALL /api requests are backend requests
    error.code === 'ECONNREFUSED' || // Connection refused is always backend when to localhost
    (error.code === 'ERR_NETWORK' && isApiRequest) // Network errors to /api are backend issues
  );
}

export function setBackendStatus(unavailable: boolean) {
  if (isBackendUnavailable !== unavailable) {
    isBackendUnavailable = unavailable;
    offlineListeners.forEach(listener => listener(isBackendUnavailable, isInternetOffline));
  }
}

export function setInternetStatus(offline: boolean) {
  if (isInternetOffline !== offline) {
    isInternetOffline = offline;
    offlineListeners.forEach(listener => listener(isBackendUnavailable, isInternetOffline));
  }
}

export function getBackendStatus() {
  return isBackendUnavailable;
}

export function getOfflineStatus() {
  return isBackendUnavailable || isInternetOffline;
}

// Legacy: subscribe to any offline status (backend or internet)
export function subscribeToOfflineStatus(listener: (offline: boolean) => void) {
  const wrapped = (backend: boolean, internet: boolean) => listener(backend || internet);
  offlineListeners.add(wrapped);
  return () => offlineListeners.delete(wrapped);
}

// New: subscribe to detailed status
export function subscribeToConnectionStatus(listener: (backend: boolean, internet: boolean) => void) {
  offlineListeners.add(listener);
  return () => offlineListeners.delete(listener);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'x-session-id': getOrCreateSessionId() }
});

// Request interceptor: attach session ID and Clerk token if available
api.interceptors.request.use(async (config) => {
  config.headers = config.headers || {};
  config.headers['x-session-id'] = getOrCreateSessionId();
  
  // Add Clerk token if available
  if (getClerkTokenFn) {
    try {
      const token = await getClerkTokenFn();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      // Clerk token unavailable - continue without it
      console.debug('Clerk token unavailable for request', error);
    }
  }
  
  return config;
});

// Response interceptor: offline detection, backoff retry
api.interceptors.response.use(
  (response) => {
    setBackendStatus(false);
    setInternetStatus(false);
    return response;
  },
  async (error: AxiosError) => {
    // Network errors (connection refused, no internet)
    if (!error.response && (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || error.message?.includes('Network Error'))) {
      // FIRST: Check if browser says we're offline (real internet issue)
      const isBrowserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      
      // SECOND: Check if this is a backend error
      const isBackend = isBackendError(error);
      
      if (isBrowserOffline) {
        // Browser says we're offline - real internet issue
        setInternetStatus(true);
        setBackendStatus(false);
      } else if (isBackend) {
        // Backend unavailable (but internet is fine)
        setBackendStatus(true);
        setInternetStatus(false);
      } else {
        // Generic network error to external URL
        // ONLY mark as internet offline if browser confirms we're offline
        // Otherwise, it's just a temporary network hiccup - don't show error
        if (isBrowserOffline) {
          setInternetStatus(true);
          setBackendStatus(false);
        } else {
          // Don't assume anything - just clear both statuses
          // Let individual requests handle their own errors
          setInternetStatus(false);
          setBackendStatus(false);
        }
      }
      
      // Exponential backoff retry (max 3 attempts)
      const config = error.config as InternalAxiosRequestConfig & { __retryCount?: number; __retryDelay?: number };
      if (!config) return Promise.reject(error);
      
      config.__retryCount = (config.__retryCount || 0) + 1;
      const maxRetries = 3;
      
      if (config.__retryCount <= maxRetries) {
        // Exponential backoff with jitter: 1s, 2s, 4s
        config.__retryDelay = Math.min(1000 * Math.pow(2, config.__retryCount - 1) + Math.random() * 1000, 5000);
        
        // Only show toast on first failure for real internet issues (not backend)
        // Backend banner will show for backend issues, so skip toast
        if (config.__retryCount === 1 && typeof window !== 'undefined' && !isBackend && isBrowserOffline) {
          const { toast } = await import('sonner');
          toast.error('Connection lost. Retrying...', { duration: 3000 });
        }
        
        await new Promise(resolve => setTimeout(resolve, config.__retryDelay));
        return api.request(config);
      }
    } else if (error.response) {
      setBackendStatus(false);
      setInternetStatus(false);
    }
    
    return Promise.reject(error);
  }
);

export async function request<T>(
  fn: () => Promise<any>,
  schema?: { safeParse: (u: unknown) => { success: boolean; data?: T } },
  fallback?: T
): Promise<T> {
  try {
    const { data } = await fn();
    const payload = data?.data ?? data;
    if (!schema) return payload;
    return safeParseOr(schema as any, payload, (fallback as T) ?? payload);
  } catch (error: any) {
    const responseData = error?.response?.data;
    const message = responseData?.message || responseData?.error || error?.message || 'Request failed';
    throw new Error(message);
  }
}


