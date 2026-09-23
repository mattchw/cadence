export const STORE_KEYS = [
  "cadence:upgrades",
  "cadence:stats",
  "cadence:profile",
  "cadence:learning",
] as const;
export type StoreKey = (typeof STORE_KEYS)[number];
export interface StoreEntry {
  value: string;
  version: number;
}
export function isStoreKey(value: unknown): value is StoreKey {
  return typeof value === "string" && STORE_KEYS.includes(value as StoreKey);
}
export function validStoredValue(
  key: StoreKey,
  value: unknown,
): value is string {
  if (typeof value !== "string") return false;
  try {
    const data: unknown = JSON.parse(value);
    if (key === "cadence:upgrades") return Array.isArray(data);
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    if (key === "cadence:learning")
      return Array.isArray((data as { records?: unknown }).records);
    return true;
  } catch {
    return false;
  }
}
