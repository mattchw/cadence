import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import {
  configureStorage,
  clearStorageSession,
  loadJSON,
  saveJSON,
  retrySync,
  syncState,
  resolveConflict,
  legacyBrowserEntries,
  importProgress,
} from "../lib/storage.ts";

const memory = new Map();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  },
  configurable: true,
});
const key = "cadence:profile";
const cacheKey = (id) => `cadence:account:${encodeURIComponent(id)}:${key}`;
function begin(id = "google:alice") {
  clearStorageSession();
  memory.clear();
  configureStorage(id);
}
function server() {
  const remote = new Map();
  let signedIn = "google:alice";
  let offline = false;
  globalThis.fetch = async (url, options = {}) => {
    if (offline) throw new Error("Network unavailable");
    const id = options.headers["X-Cadence-Account"];
    if (id !== signedIn)
      return Response.json({ error: "account_changed" }, { status: 409 });
    const data = options.body ? JSON.parse(options.body) : null;
    const category =
      data?.key ??
      new URL(String(url), "https://cadence.test").searchParams.get("key");
    const name = `${id}/${category}`;
    const current = remote.get(name);
    if (options.method === "POST") {
      if (
        current?.value !== data.value &&
        data.version !== (current?.version ?? 0)
      )
        return Response.json({ error: "conflict" }, { status: 409 });
      const version =
        current?.value === data.value
          ? current.version
          : (current?.version ?? 0) + 1;
      remote.set(name, { value: data.value, version });
      return Response.json({ version });
    }
    return current ? Response.json(current) : new Response("", { status: 404 });
  };
  return {
    remote,
    signIn: (id) => {
      signedIn = id;
    },
    offline: (value) => {
      offline = value;
    },
  };
}

test("saved progress loads in a second browser with no local storage", async () => {
  begin();
  const s = server();
  await loadJSON(key, {});
  saveJSON(key, { goal: "work" });
  assert.equal(await retrySync(), true);
  clearStorageSession();
  memory.clear();
  configureStorage("google:alice");
  assert.deepEqual(await loadJSON(key, {}), { goal: "work" });
  assert.equal(s.remote.size, 1);
});

test("database errors do not return empty defaults; unsynced work survives and retries", async () => {
  begin();
  const s = server();
  await loadJSON(key, {});
  s.offline(true);
  saveJSON(key, { goal: "study" });
  assert.equal(await retrySync(), false);
  assert.equal(JSON.parse(memory.get(cacheKey("google:alice"))).dirty, true);
  await assert.rejects(loadJSON(key, {}), /Network unavailable/);
  assert.equal(syncState().status, "error");
  s.offline(false);
  assert.equal(await retrySync(), true);
  assert.equal(JSON.parse(memory.get(cacheKey("google:alice"))).dirty, false);
  assert.equal(
    JSON.parse(s.remote.get(`google:alice/${key}`).value).goal,
    "study",
  );
});

test("account switch cancels pending writes and never reuses another account’s cache", async () => {
  begin();
  const s = server();
  await loadJSON(key, {});
  saveJSON(key, { goal: "alice draft" });
  configureStorage("google:bob");
  s.signIn("google:bob");
  assert.deepEqual(await loadJSON(key, {}), {});
  await sleep(550);
  assert.equal(s.remote.size, 0);
  assert.equal(
    JSON.parse(JSON.parse(memory.get(cacheKey("google:alice"))).value).goal,
    "alice draft",
  );
  assert.equal(memory.has(cacheKey("google:bob")), false);
});

test("a cookie change in another tab blocks writes from the old account", async () => {
  begin();
  const s = server();
  await loadJSON(key, {});
  s.signIn("google:bob");
  saveJSON(key, { goal: "old tab" });
  assert.equal(await retrySync(), false);
  assert.equal(syncState().status, "account-changed");
  assert.equal(s.remote.size, 0);
});

test("newer cloud progress wins over a clean cache", async () => {
  begin();
  const s = server();
  s.remote.set(`google:alice/${key}`, { value: '{"goal":"old"}', version: 1 });
  await loadJSON(key, {});
  s.remote.set(`google:alice/${key}`, { value: '{"goal":"new"}', version: 2 });
  assert.deepEqual(await loadJSON(key, {}), { goal: "new" });
});

test("conflicting device recovery never overwrites newer cloud data without a choice", async () => {
  begin();
  const s = server();
  s.remote.set(`google:alice/${key}`, {
    value: '{"goal":"initial"}',
    version: 1,
  });
  await loadJSON(key, {});
  s.offline(true);
  saveJSON(key, { goal: "local draft" });
  await retrySync();
  clearStorageSession();
  configureStorage("google:alice");
  s.offline(false);
  s.remote.set(`google:alice/${key}`, {
    value: '{"goal":"other browser"}',
    version: 2,
  });
  assert.deepEqual(await loadJSON(key, {}), { goal: "local draft" });
  assert.equal(syncState().status, "conflict");
  assert.equal(await retrySync(), false);
  assert.equal(s.remote.get(`google:alice/${key}`).version, 2);
  await resolveConflict(key, "cloud");
  assert.deepEqual(await loadJSON(key, {}), { goal: "other browser" });
});

test("explicitly keeping a device draft uses the newest cloud revision", async () => {
  begin();
  const s = server();
  await loadJSON(key, {});
  s.remote.set(`google:alice/${key}`, {
    value: '{"goal":"another browser"}',
    version: 1,
  });
  saveJSON(key, { goal: "keep this draft" });
  await retrySync();
  assert.equal(syncState().status, "conflict");
  await resolveConflict(key, "device");
  assert.equal(s.remote.get(`google:alice/${key}`).version, 2);
  assert.deepEqual(await loadJSON(key, {}), { goal: "keep this draft" });
});

test("an in-flight save cannot mark a newer draft synced prematurely", async () => {
  begin();
  let release;
  const writes = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    writes.push(body);
    if (writes.length === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    return Response.json({ version: writes.length });
  };
  saveJSON(key, { goal: "first" });
  await sleep(550);
  saveJSON(key, { goal: "latest" });
  release();
  await retrySync();
  assert.equal(writes.length, 2);
  assert.equal(writes[1].version, 1);
  const cached = JSON.parse(memory.get(cacheKey("google:alice")));
  assert.equal(JSON.parse(cached.value).goal, "latest");
  assert.equal(cached.dirty, false);
});

test("legacy browser data is offered explicitly and marked imported only after database success", async () => {
  begin();
  memory.set(
    `cadence:device:${key}`,
    JSON.stringify({ value: '{"goal":"old progress"}', dirty: true }),
  );
  assert.deepEqual(legacyBrowserEntries(), {
    [key]: '{"goal":"old progress"}',
  });
  let body;
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return Response.json({ ok: true });
  };
  await importProgress("browser");
  assert.equal(body.entries[key], '{"goal":"old progress"}');
  assert.deepEqual(legacyBrowserEntries(), {});
  clearStorageSession();
});
