import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { loadJSON, saveJSON, storageNotice } from "../lib/storage.ts";

const memory = new Map();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  },
  configurable: true,
});
const originalFetch = globalThis.fetch;

test("device saves survive cloud failure and an older cloud value cannot overwrite them", async () => {
  globalThis.fetch = async () => new Response("offline", { status: 503 });
  saveJSON("offline", { draft: "My unsynced draft" });
  assert.equal(JSON.parse(memory.get("cadence:device:offline")).dirty, true);
  await sleep(550);
  assert.match(storageNotice(), /saved on this device/);
  globalThis.fetch = async (_, options) =>
    options?.method === "POST"
      ? new Response("{}")
      : Response.json({
          key: "offline",
          value: JSON.stringify({ draft: "Old remote draft" }),
        });
  assert.deepEqual(await loadJSON("offline", null), {
    draft: "My unsynced draft",
  });
  await sleep(550);
  assert.equal(JSON.parse(memory.get("cadence:device:offline")).dirty, false);
});

test("typing coalesces writes and an in-flight save cannot replace a newer draft", async () => {
  const writes = [];
  let release;
  globalThis.fetch = async (_, options) => {
    const body = JSON.parse(options.body);
    writes.push(JSON.parse(body.value));
    if (writes.length === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    return new Response("{}");
  };
  saveJSON("typing", "a");
  saveJSON("typing", "ab");
  saveJSON("typing", "abc");
  await sleep(550);
  assert.deepEqual(writes, ["abc"]);
  saveJSON("typing", "newest draft");
  release();
  await sleep(50);
  assert.deepEqual(writes, ["abc", "newest draft"]);
  const cached = JSON.parse(memory.get("cadence:device:typing"));
  assert.equal(JSON.parse(cached.value), "newest draft");
  assert.equal(cached.dirty, false);
  await sleep(500);
});

test("read failure uses the cached cloud copy and corrupt data has a safe fallback", async () => {
  globalThis.fetch = async () =>
    Response.json({ key: "cached", value: JSON.stringify({ goal: 4 }) });
  assert.deepEqual(await loadJSON("cached", null), { goal: 4 });
  globalThis.fetch = async () => {
    throw new Error("Network unavailable");
  };
  assert.deepEqual(await loadJSON("cached", null), { goal: 4 });
  memory.set("cadence:device:broken", "{broken");
  assert.deepEqual(await loadJSON("broken", []), []);
  globalThis.fetch = originalFetch;
});
