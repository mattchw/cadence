// Keep an immediate device copy; sync writes in order and coalesce typing.
interface StoredEntry {
  key: string;
  value: string;
}
interface CacheEntry {
  value: string;
  dirty: boolean;
}
const PREFIX = "cadence:device:";
const pending = new Map<string, string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const running = new Set<string>();
const failures = new Set<string>();
const deviceFailures = new Set<string>();
export const STORAGE_EVENT = "cadence-storage-status";
export function storageNotice(): string {
  if (deviceFailures.size)
    return "Device storage is unavailable. Keep this page open until cloud sync succeeds.";
  if (failures.size)
    return "Cloud sync is unavailable. Changes are saved on this device and will retry when you return.";
  return "";
}
function notify() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(STORAGE_EVENT));
}
function cached(key: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    const value = raw ? (JSON.parse(raw) as CacheEntry) : null;
    return value && typeof value.value === "string" ? value : null;
  } catch {
    return null;
  }
}
function cache(key: string, value: string, dirty: boolean) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, dirty }));
    deviceFailures.delete(key);
  } catch {
    deviceFailures.add(key);
  }
  notify();
}
export const storage = {
  async get(key: string): Promise<StoredEntry | null> {
    const res = await fetch(`/api/store?key=${encodeURIComponent(key)}`, {
      credentials: "include",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`store get failed (${res.status})`);
    return (await res.json()) as StoredEntry;
  },
  async set(key: string, value: string): Promise<void> {
    const res = await fetch("/api/store", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`store set failed (${res.status})`);
  },
};
async function flush(key: string): Promise<void> {
  if (running.has(key)) return;
  const value = pending.get(key);
  if (value === undefined) return;
  pending.delete(key);
  running.add(key);
  try {
    await storage.set(key, value);
    failures.delete(key);
    // An older request must never mark a newer draft as synced.
    if (!pending.has(key)) cache(key, value, false);
  } catch {
    failures.add(key);
  } finally {
    running.delete(key);
    notify();
    if (pending.has(key)) void flush(key);
  }
}
export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  const local = cached(key);
  if (local?.dirty) {
    try {
      const value = JSON.parse(local.value) as T;
      saveJSON(key, value);
      return value;
    } catch {
      /* use remote */
    }
  }
  try {
    const entry = await storage.get(key);
    failures.delete(key);
    notify();
    if (entry) {
      const value = JSON.parse(entry.value) as T;
      cache(key, entry.value, false);
      return value;
    }
    // A missing cloud entry is authoritative unless there is an unsynced edit.
    return fallback;
  } catch {
    failures.add(key);
    notify();
    if (local) {
      try {
        return JSON.parse(local.value) as T;
      } catch {
        /* fallback */
      }
    }
    return fallback;
  }
}
export function saveJSON(key: string, value: unknown): void {
  const serialized = JSON.stringify(value);
  cache(key, serialized, true);
  pending.set(key, serialized);
  const previous = timers.get(key);
  if (previous) clearTimeout(previous);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void flush(key);
    }, 500),
  );
}
