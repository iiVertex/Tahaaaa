import axios from 'axios';
import { getOrCreateSessionId } from './session';
import { safeParseOr } from './schemas';

export const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api',
  headers: { 'x-session-id': getOrCreateSessionId() }
});

export async function request<T>(
  fn: () => Promise<any>,
  schema?: { safeParse: (u: unknown) => { success: boolean; data?: T } },
  fallback?: T
): Promise<T> {
  const { data } = await fn();
  if (!schema) return data?.data ?? data;
  return safeParseOr(schema as any, data?.data ?? data, (fallback as T) ?? (data?.data ?? data));
}


