import {
  STORE_KEYS,
  isStoreKey,
  validStoredValue,
  type StoreEntry,
  type StoreKey,
} from "./store-schema";
import { validAccountId } from "./auth-policy";

interface CacheEntry extends StoreEntry {
  dirty: boolean;
}
interface Context {
  id: string;
  versions: Map<StoreKey, number>;
  pending: Map<StoreKey, string>;
  timers: Map<StoreKey, ReturnType<typeof setTimeout>>;
  running: Map<StoreKey, Promise<void>>;
  failures: Set<StoreKey>;
  conflicts: Set<StoreKey>;
  blocked: boolean;
  deviceFailures: Set<StoreKey>;
}
let context: Context | null = null;
export const STORAGE_EVENT = "cadence-storage-status";
export const STORAGE_RELOAD_EVENT = "cadence-storage-reload";

export function configureStorage(accountId: string): void {
  if (!validAccountId(accountId))
    throw new Error("A Google account is required.");
  if (context?.id === accountId) return;
  if (context) for (const timer of context.timers.values()) clearTimeout(timer);
  context = {
    id: accountId,
    versions: new Map(),
    pending: new Map(),
    timers: new Map(),
    running: new Map(),
    failures: new Set(),
    conflicts: new Set(),
    blocked: false,
    deviceFailures: new Set(),
  };
}
export function clearStorageSession(): void {
  if (context) for (const timer of context.timers.values()) clearTimeout(timer);
  context = null;
}
function current(): Context {
  if (!context) throw new Error("Sign in to access your progress.");
  return context;
}
function localKey(ctx: Context, key: StoreKey): string {
  return `cadence:account:${encodeURIComponent(ctx.id)}:${key}`;
}
function notify(ctx: Context): void {
  if (context === ctx && typeof window !== "undefined")
    window.dispatchEvent(new Event(STORAGE_EVENT));
}
export function accountHeaders(): Record<string, string> {
  return { "X-Cadence-Account": current().id };
}
function cached(ctx: Context, key: StoreKey): CacheEntry | null {
  try {
    const raw = localStorage.getItem(localKey(ctx, key));
    const value = raw ? (JSON.parse(raw) as CacheEntry) : null;
    return value &&
      validStoredValue(key, value.value) &&
      Number.isSafeInteger(value.version)
      ? value
      : null;
  } catch {
    return null;
  }
}
function cache(ctx: Context, key: StoreKey, entry: CacheEntry): void {
  try {
    localStorage.setItem(localKey(ctx, key), JSON.stringify(entry));
    ctx.deviceFailures.delete(key);
  } catch {
    ctx.deviceFailures.add(key);
  }
}
export function syncState(): {
  status:
    | "loading"
    | "saving"
    | "saved"
    | "error"
    | "conflict"
    | "account-changed";
  message: string;
  conflicts: StoreKey[];
} {
  const ctx = context;
  const conflicts = ctx ? [...ctx.conflicts] : [];
  if (!ctx)
    return { status: "loading", message: "Loading your account…", conflicts };
  if (ctx.blocked)
    return {
      status: "account-changed",
      message:
        "Your signed-in account changed or expired. Reload to continue. Unsaved work stays with its original account.",
      conflicts,
    };
  if (conflicts.length)
    return {
      status: "conflict",
      message:
        "Progress changed in another browser. Choose which version to keep below.",
      conflicts,
    };
  if (ctx.failures.size)
    return {
      status: "error",
      message: ctx.deviceFailures.size
        ? "Couldn’t save to your account or this device. Keep this page open and retry."
        : "Couldn’t sync with your account yet. Retry before switching browsers.",
      conflicts,
    };
  if (ctx.pending.size || ctx.running.size)
    return { status: "saving", message: "Saving to your account…", conflicts };
  if (ctx.versions.size < STORE_KEYS.length)
    return { status: "loading", message: "Loading your account…", conflicts };
  return { status: "saved", message: "Saved to your account", conflicts };
}
export function hasUnsyncedChanges(): boolean {
  return (
    !!context &&
    (!!context.pending.size ||
      !!context.running.size ||
      STORE_KEYS.some((key) => cached(context!, key)?.dirty))
  );
}
export function storageNotice(): string {
  const state = syncState();
  return ["error", "conflict", "account-changed"].includes(state.status)
    ? state.message
    : "";
}
export function accountIsEmpty(): boolean {
  return (
    !!context &&
    context.versions.size === STORE_KEYS.length &&
    [...context.versions.values()].every((version) => version === 0) &&
    !context.pending.size
  );
}

class SyncError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
async function failure(response: Response, ctx: Context): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (body.error === "database_not_configured")
    throw new SyncError(
      body.error,
      "Account storage is not configured on this deployment. Add KV_REST_API_URL and KV_REST_API_TOKEN to its Vercel environment variables, then redeploy.",
    );
  if (body.error === "database_configuration_invalid")
    throw new SyncError(
      body.error,
      "The database settings are invalid. Use the Upstash HTTPS REST URL and its REST token, without quotes, in Vercel, then redeploy.",
    );
  if (response.status === 401 || body.error === "account_changed") {
    ctx.blocked = true;
    notify(ctx);
    throw new SyncError(
      "account_changed",
      "Your account changed or your session expired. Reload to sign in again.",
    );
  }
  if (body.error === "conflict")
    throw new SyncError("conflict", "Another browser saved newer progress.");
  if (body.error === "account_has_progress")
    throw new SyncError(
      "account_has_progress",
      "This account already has saved progress. The import did not change it.",
    );
  if (body.error === "no_legacy_progress")
    throw new SyncError(
      "no_legacy_progress",
      "No progress was found in the previous shared database.",
    );
  throw new SyncError(
    "unavailable",
    "Your saved progress could not be loaded or saved. Check the database connection, then retry.",
  );
}
async function get(ctx: Context, key: StoreKey): Promise<StoreEntry> {
  const res = await fetch(`/api/store?key=${encodeURIComponent(key)}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "X-Cadence-Account": ctx.id },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) return { value: "", version: 0 };
  if (!res.ok) return failure(res, ctx);
  const data = (await res.json()) as StoreEntry;
  if (
    !validStoredValue(key, data.value) ||
    !Number.isSafeInteger(data.version) ||
    data.version < 1
  )
    throw new Error("The saved record could not be read. Please retry.");
  return data;
}
async function put(
  ctx: Context,
  key: StoreKey,
  value: string,
): Promise<number> {
  const res = await fetch("/api/store", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Cadence-Account": ctx.id,
    },
    body: JSON.stringify({ key, value, version: ctx.versions.get(key) ?? 0 }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return failure(res, ctx);
  const result = (await res.json()) as { version: number };
  if (!Number.isSafeInteger(result.version) || result.version < 1)
    throw new Error("Save confirmation was incomplete.");
  return result.version;
}
async function flush(ctx: Context, key: StoreKey): Promise<void> {
  if (context !== ctx || ctx.blocked || ctx.conflicts.has(key)) return;
  const existing = ctx.running.get(key);
  if (existing) {
    await existing;
    return;
  }
  const value = ctx.pending.get(key);
  if (value === undefined) return;
  ctx.pending.delete(key);
  let succeeded = false;
  const work = (async () => {
    try {
      const version = await put(ctx, key, value);
      if (context !== ctx) return;
      ctx.versions.set(key, version);
      ctx.failures.delete(key);
      succeeded = true;
      cache(ctx, key, {
        value: ctx.pending.get(key) ?? value,
        version,
        dirty: ctx.pending.has(key),
      });
    } catch (error) {
      if (context !== ctx) return;
      if (!ctx.pending.has(key)) ctx.pending.set(key, value);
      if (error instanceof SyncError && error.code === "conflict")
        ctx.conflicts.add(key);
      else ctx.failures.add(key);
    } finally {
      ctx.running.delete(key);
      notify(ctx);
    }
  })();
  ctx.running.set(key, work);
  notify(ctx);
  await work;
  if (succeeded && ctx.pending.has(key)) await flush(ctx, key);
}
export async function retrySync(): Promise<boolean> {
  const ctx = current();
  for (const timer of ctx.timers.values()) clearTimeout(timer);
  ctx.timers.clear();
  await Promise.all(
    [...new Set([...ctx.running.keys(), ...ctx.pending.keys()])].map((key) =>
      flush(ctx, key),
    ),
  );
  // A newer draft may have arrived while an earlier request was running.
  await Promise.all([...ctx.running.values()]);
  if (
    !ctx.failures.size &&
    !ctx.conflicts.size &&
    !ctx.blocked &&
    ctx.pending.size
  ) {
    await Promise.all([...ctx.pending.keys()].map((key) => flush(ctx, key)));
  }
  return (
    context === ctx &&
    !ctx.pending.size &&
    !ctx.failures.size &&
    !ctx.conflicts.size &&
    !ctx.blocked
  );
}
export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  if (!isStoreKey(key)) throw new Error("Unknown progress category.");
  const ctx = current();
  const local = cached(ctx, key);
  let remote: StoreEntry;
  try {
    remote = await get(ctx, key);
  } catch (error) {
    ctx.failures.add(key);
    notify(ctx);
    throw error;
  }
  if (context !== ctx)
    throw new Error("Your account changed. Reload to continue.");
  ctx.versions.set(key, remote.version);
  ctx.failures.delete(key);
  if (local?.dirty && local.value !== remote.value) {
    ctx.pending.set(key, local.value);
    if (local.version !== remote.version) ctx.conflicts.add(key);
    else saveJSON(key, JSON.parse(local.value));
    notify(ctx);
    return JSON.parse(local.value) as T;
  }
  ctx.conflicts.delete(key);
  ctx.pending.delete(key);
  if (remote.version) cache(ctx, key, { ...remote, dirty: false });
  else {
    try {
      localStorage.removeItem(localKey(ctx, key));
    } catch {
      /* optional device backup */
    }
  }
  notify(ctx);
  return remote.version ? (JSON.parse(remote.value) as T) : fallback;
}
export function saveJSON(key: string, value: unknown): void {
  if (!isStoreKey(key)) throw new Error("Unknown progress category.");
  const ctx = current();
  const serialized = JSON.stringify(value);
  if (!validStoredValue(key, serialized))
    throw new Error("Invalid progress data.");
  cache(ctx, key, {
    value: serialized,
    version: ctx.versions.get(key) ?? 0,
    dirty: true,
  });
  ctx.pending.set(key, serialized);
  const previous = ctx.timers.get(key);
  if (previous) clearTimeout(previous);
  ctx.timers.set(
    key,
    setTimeout(() => {
      ctx.timers.delete(key);
      void flush(ctx, key);
    }, 500),
  );
  notify(ctx);
}
export async function resolveConflict(
  key: StoreKey,
  keep: "cloud" | "device",
): Promise<void> {
  const ctx = current();
  const remote = await get(ctx, key);
  if (context !== ctx) return;
  ctx.versions.set(key, remote.version);
  if (keep === "cloud") {
    ctx.pending.delete(key);
    if (remote.version) cache(ctx, key, { ...remote, dirty: false });
    else {
      try {
        localStorage.removeItem(localKey(ctx, key));
      } catch {
        /* optional cache */
      }
    }
  } else {
    const value = ctx.pending.get(key) ?? cached(ctx, key)?.value;
    if (value !== undefined) {
      ctx.pending.set(key, value);
      cache(ctx, key, { value, version: remote.version, dirty: true });
    }
  }
  ctx.conflicts.delete(key);
  ctx.failures.delete(key);
  if (keep === "device") await flush(ctx, key);
  notify(ctx);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(STORAGE_RELOAD_EVENT));
}

export function legacyBrowserEntries(): Partial<Record<StoreKey, string>> {
  const entries: Partial<Record<StoreKey, string>> = {};
  try {
    if (localStorage.getItem("cadence:legacy-imported")) return entries;
    for (const key of STORE_KEYS) {
      const raw = localStorage.getItem(`cadence:device:${key}`);
      const value: unknown = raw
        ? (JSON.parse(raw) as { value?: unknown }).value
        : undefined;
      if (validStoredValue(key, value)) entries[key] = value;
    }
  } catch {
    /* no readable legacy data */
  }
  return entries;
}
export async function importProgress(
  source: "browser" | "cloud",
): Promise<void> {
  const ctx = current();
  const res = await fetch(
    source === "browser" ? "/api/store/import" : "/api/store/legacy",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Cadence-Account": ctx.id,
      },
      body: JSON.stringify(
        source === "browser" ? { entries: legacyBrowserEntries() } : {},
      ),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!res.ok) return failure(res, ctx);
  if (source === "browser") {
    try {
      localStorage.setItem("cadence:legacy-imported", ctx.id);
    } catch {
      /* database import already succeeded */
    }
  }
  if (context === ctx && typeof window !== "undefined")
    window.dispatchEvent(new Event(STORAGE_RELOAD_EVENT));
}
