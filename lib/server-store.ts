import type { AccountUser } from "./auth-policy";
import { validAccountId } from "./auth-policy";
import {
  isStoreKey,
  validStoredValue,
  type StoreKey,
  type StoreEntry,
} from "./store-schema";

export interface AccountRepository {
  get(userId: string, key: StoreKey): Promise<StoreEntry | null>;
  put(
    userId: string,
    key: StoreKey,
    value: string,
    expectedVersion: number,
  ): Promise<{ ok: boolean; version: number }>;
  importEmpty(
    userId: string,
    entries: Partial<Record<StoreKey, string>>,
  ): Promise<boolean>;
}
export interface StoreDependencies {
  user: () => Promise<AccountUser | null>;
  repository: () => AccountRepository;
}
const MAX_BYTES = 3 * 1024 * 1024;
export function privateJSON(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
export function databaseKey(userId: string, key: StoreKey): string {
  if (!validAccountId(userId) || !isStoreKey(key))
    throw new Error("Invalid storage namespace");
  return `cadence:user:${userId}:${key.slice("cadence:".length)}`;
}
export function requestProblem(
  req: Request,
  user: AccountUser | null,
  mutation = false,
): Response | null {
  if (!user || !validAccountId(user.id))
    return privateJSON({ error: "unauthorized" }, 401);
  // A tab signed in as A must not read or write B's data after the cookie changes.
  if (req.headers.get("X-Cadence-Account") !== user.id)
    return privateJSON({ error: "account_changed" }, 409);
  if (mutation) {
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      return privateJSON({ error: "JSON required" }, 415);
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin)
      return privateJSON({ error: "origin_not_allowed" }, 403);
  }
  return null;
}
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES)
    throw new Error("too_large");
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("invalid_json");
  return data as Record<string, unknown>;
}
export function createStoreHandlers(deps: StoreDependencies) {
  return {
    async GET(req: Request): Promise<Response> {
      const user = await deps.user();
      const problem = requestProblem(req, user);
      if (problem || !user) return problem!;
      const key = new URL(req.url).searchParams.get("key");
      if (!isStoreKey(key)) return privateJSON({ error: "invalid_key" }, 400);
      try {
        const entry = await deps.repository().get(user.id, key);
        return entry
          ? privateJSON({ key, ...entry })
          : privateJSON({ error: "not_found" }, 404);
      } catch {
        return privateJSON({ error: "database_unavailable" }, 503);
      }
    },
    async POST(req: Request): Promise<Response> {
      const user = await deps.user();
      const problem = requestProblem(req, user, true);
      if (problem || !user) return problem!;
      let body: Record<string, unknown>;
      try {
        body = await readBody(req);
      } catch {
        return privateJSON({ error: "invalid_body" }, 400);
      }
      const { key, value, version } = body;
      if (
        !isStoreKey(key) ||
        !validStoredValue(key, value) ||
        !Number.isSafeInteger(version) ||
        Number(version) < 0
      )
        return privateJSON({ error: "invalid_entry" }, 400);
      try {
        const result = await deps
          .repository()
          .put(user.id, key, value, Number(version));
        return result.ok
          ? privateJSON({ version: result.version })
          : privateJSON({ error: "conflict" }, 409);
      } catch {
        return privateJSON({ error: "database_unavailable" }, 503);
      }
    },
  };
}

export function createImportHandler(deps: StoreDependencies) {
  return async function POST(req: Request): Promise<Response> {
    const user = await deps.user();
    const problem = requestProblem(req, user, true);
    if (problem || !user) return problem!;
    let body: Record<string, unknown>;
    try {
      body = await readBody(req);
    } catch {
      return privateJSON({ error: "invalid_body" }, 400);
    }
    const entries = body.entries;
    if (
      !entries ||
      typeof entries !== "object" ||
      Array.isArray(entries) ||
      !Object.keys(entries).length ||
      !Object.entries(entries).every(
        ([key, value]) => isStoreKey(key) && validStoredValue(key, value),
      )
    )
      return privateJSON({ error: "invalid_entries" }, 400);
    try {
      const imported = await deps
        .repository()
        .importEmpty(user.id, entries as Partial<Record<StoreKey, string>>);
      return imported
        ? privateJSON({ ok: true })
        : privateJSON({ error: "account_has_progress" }, 409);
    } catch {
      return privateJSON({ error: "database_unavailable" }, 503);
    }
  };
}
