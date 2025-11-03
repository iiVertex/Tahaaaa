/**
 * Modern defensive array utilities for React
 * Prevents crashes from undefined/null arrays
 */

/**
 * Safely maps over an array, returning empty array if input is invalid
 * @example safeMap(items, item => <div key={item.id}>{item.name}</div>)
 */
export function safeMap<T, R>(
  arr: T[] | null | undefined,
  fn: (item: T, index: number) => R,
  fallback: R[] = []
): R[] {
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  return arr.map(fn);
}

/**
 * Ensures value is always an array
 */
export function ensureArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

/**
 * Safely filters an array
 */
export function safeFilter<T>(
  arr: T[] | null | undefined,
  predicate: (item: T) => boolean
): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(predicate);
}

/**
 * Safely gets first N items from array
 */
export function safeTake<T>(arr: T[] | null | undefined, count: number): T[] {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return arr.slice(0, Math.max(0, count));
}

/**
 * Checks if array has items (defensive)
 */
export function hasItems<T>(arr: T[] | null | undefined): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

