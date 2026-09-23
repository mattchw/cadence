import { Redis } from "@upstash/redis";
import { databaseSettings } from "./database-config";
import { databaseKey, type AccountRepository } from "./server-store";
import { STORE_KEYS, type StoreEntry, type StoreKey } from "./store-schema";

// Compare-and-set is atomic in Redis, so an old browser cannot silently replace
// progress saved by a newer one. Retrying an already committed write is safe.
export const WRITE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local version = 0
if raw then
  local doc = cjson.decode(raw)
  version = tonumber(doc.version) or 0
  if doc.s == ARGV[1] then return {1, version} end
end
if version ~= tonumber(ARGV[2]) then return {0, version} end
local next = version + 1
redis.call('SET', KEYS[1], cjson.encode({s = ARGV[1], version = next}))
return {1, next}
`;

// A single transaction imports all legacy keys, and only into an empty account.
export const IMPORT_SCRIPT = `
for i, key in ipairs(KEYS) do
  if redis.call('EXISTS', key) == 1 then return 0 end
end
for i, key in ipairs(KEYS) do
  if ARGV[i] ~= '' then
    redis.call('SET', key, cjson.encode({s = ARGV[i], version = 1}))
  end
end
return 1
`;

let client: Redis | null = null;
export function redisClient(): Redis {
  const settings = databaseSettings({
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  });
  client ??= new Redis(settings);
  return client;
}
export function accountRepository(): AccountRepository {
  const redis = redisClient();
  return {
    async get(userId, key): Promise<StoreEntry | null> {
      const doc = await redis.get<{ s: string; version: number }>(
        databaseKey(userId, key),
      );
      if (!doc) return null;
      if (typeof doc.s !== "string" || !Number.isSafeInteger(doc.version))
        throw new Error("Invalid stored record");
      return { value: doc.s, version: doc.version };
    },
    async put(userId, key, value, expectedVersion) {
      const result = await redis.eval<[string, number], [number, number]>(
        WRITE_SCRIPT,
        [databaseKey(userId, key)],
        [value, expectedVersion],
      );
      return { ok: result[0] === 1, version: result[1] };
    },
    async importEmpty(userId, entries) {
      const keys = STORE_KEYS.map((key) => databaseKey(userId, key));
      return (
        (await redis.eval<string[], number>(
          IMPORT_SCRIPT,
          keys,
          STORE_KEYS.map((key) => entries[key] ?? ""),
        )) === 1
      );
    },
  };
}

export async function legacyCloudEntries(): Promise<
  Partial<Record<StoreKey, string>>
> {
  const redis = redisClient();
  const entries: Partial<Record<StoreKey, string>> = {};
  const docs = await Promise.all(
    STORE_KEYS.map((key) => redis.get<{ s: string }>(key)),
  );
  docs.forEach((doc, index) => {
    if (typeof doc?.s === "string") entries[STORE_KEYS[index]] = doc.s;
  });
  return entries;
}
