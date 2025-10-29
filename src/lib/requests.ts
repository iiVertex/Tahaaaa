import axios from 'axios';
import { getOrCreateSessionId } from './session';
import { safeParseOr } from './schemas';

export const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || '/api',
  headers: { 'x-session-id': getOrCreateSessionId() }
});

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


