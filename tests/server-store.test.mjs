import test from "node:test";
import assert from "node:assert/strict";
import {
  googleIdentity,
  validAccountId,
  canImportSharedProgress,
} from "../lib/auth-policy.ts";
import {
  createStoreHandlers,
  createImportHandler,
  databaseKey,
} from "../lib/server-store.ts";
import { STORE_KEYS } from "../lib/store-schema.ts";

const alice = {
  id: "google:alice",
  email: "alice@example.test",
  name: "Alice",
};
const bob = { id: "google:bob", email: "bob@example.test", name: "Bob" };
function fixture() {
  const documents = new Map();
  let user = alice;
  let accesses = 0;
  const repository = {
    async get(id, key) {
      accesses++;
      return documents.get(databaseKey(id, key)) ?? null;
    },
    async put(id, key, value, expected) {
      accesses++;
      const name = databaseKey(id, key);
      const current = documents.get(name);
      const version = current?.version ?? 0;
      if (current?.value === value) return { ok: true, version };
      if (version !== expected) return { ok: false, version };
      documents.set(name, { value, version: version + 1 });
      return { ok: true, version: version + 1 };
    },
    async importEmpty(id, entries) {
      accesses++;
      if (STORE_KEYS.some((key) => documents.has(databaseKey(id, key))))
        return false;
      for (const [key, value] of Object.entries(entries))
        documents.set(databaseKey(id, key), { value, version: 1 });
      return true;
    },
  };
  const deps = { user: async () => user, repository: () => repository };
  return {
    documents,
    handlers: createStoreHandlers(deps),
    import: createImportHandler(deps),
    setUser: (next) => {
      user = next;
    },
    accesses: () => accesses,
  };
}
const request = (method, body, id = alice.id, extraHeaders = {}) =>
  new Request("https://cadence.example/api/store?key=cadence:profile", {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Cadence-Account": id,
      ...extraHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const entry = (value = { goal: "work" }, version = 0, extra = {}) => ({
  key: "cadence:profile",
  value: JSON.stringify(value),
  version,
  ...extra,
});

test("Google identity requires a verified Google account and uses immutable provider ID", () => {
  assert.equal(
    googleIdentity(
      { provider: "google", providerAccountId: "12345" },
      { email_verified: true },
    ),
    "google:12345",
  );
  assert.equal(
    googleIdentity(
      { provider: "google", providerAccountId: "12345" },
      { email_verified: false },
    ),
    null,
  );
  assert.equal(
    googleIdentity(
      { provider: "other", providerAccountId: "12345" },
      { email_verified: true },
    ),
    null,
  );
  assert.equal(googleIdentity(null, undefined), null);
  assert.equal(validAccountId("google:12345"), true);
  assert.equal(validAccountId("other:12345"), false);
});

test("unauthenticated requests are rejected inside routes before touching the database", async () => {
  const f = fixture();
  f.setUser(null);
  assert.equal((await f.handlers.GET(request("GET"))).status, 401);
  assert.equal((await f.handlers.POST(request("POST", entry()))).status, 401);
  assert.equal(
    (await f.import(request("POST", { entries: { "cadence:profile": "{}" } })))
      .status,
    401,
  );
  assert.equal(f.accesses(), 0);
});

test("two Google accounts have isolated progress and a client-supplied userId is ignored", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.handlers.POST(
        request("POST", entry({ goal: "work" }, 0, { userId: bob.id })),
      )
    ).status,
    200,
  );
  const aliceData = await (await f.handlers.GET(request("GET"))).json();
  assert.equal(JSON.parse(aliceData.value).goal, "work");
  f.setUser(bob);
  assert.equal(
    (await f.handlers.GET(request("GET", undefined, bob.id))).status,
    404,
  );
  assert.equal(
    (await f.handlers.POST(request("POST", entry({ goal: "study" }), bob.id)))
      .status,
    200,
  );
  assert.equal(f.documents.size, 2);
  assert.equal(
    JSON.parse(f.documents.get(databaseKey(alice.id, "cadence:profile")).value)
      .goal,
    "work",
  );
});

test("stale-account tabs and cross-origin writes are blocked", async () => {
  const f = fixture();
  f.setUser(bob);
  const changed = await f.handlers.POST(request("POST", entry(), alice.id));
  assert.equal(changed.status, 409);
  assert.equal((await changed.json()).error, "account_changed");
  assert.equal(
    (await f.handlers.GET(request("GET", undefined, alice.id))).status,
    409,
  );
  assert.equal(
    (
      await f.handlers.POST(
        request("POST", entry(), bob.id, { Origin: "https://evil.example" }),
      )
    ).status,
    403,
  );
  assert.equal(f.accesses(), 0);
});

test("unknown keys and invalid records cannot access arbitrary Redis data", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.handlers.POST(
        request(
          "POST",
          entry({}, 0, { key: "cadence:user:google:bob:profile" }),
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (await f.handlers.POST(request("POST", entry({}, -1)))).status,
    400,
  );
  assert.equal(
    (await f.handlers.POST(request("POST", entry({}, 0, { value: "{broken" }))))
      .status,
    400,
  );
  assert.equal(
    (
      await f.handlers.POST(
        request("POST", entry({}, 0, { key: "cadence:upgrades" })),
      )
    ).status,
    400,
  );
  assert.equal(f.accesses(), 0);
});

test("outdated browser writes conflict, while a retry of the same saved value is idempotent", async () => {
  const f = fixture();
  assert.equal(
    (await f.handlers.POST(request("POST", entry({ goal: "work" })))).status,
    200,
  );
  assert.equal(
    (await f.handlers.POST(request("POST", entry({ goal: "work" })))).status,
    200,
  );
  const stale = await f.handlers.POST(
    request("POST", entry({ goal: "study" })),
  );
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error, "conflict");
  assert.equal(
    (await f.handlers.POST(request("POST", entry({ goal: "study" }, 1))))
      .status,
    200,
  );
  const result = await f.handlers.GET(request("GET"));
  assert.match(result.headers.get("Cache-Control"), /no-store/);
  assert.equal((await result.json()).version, 2);
});

test("legacy import fills only the signed-in empty account and never overwrites progress", async () => {
  const f = fixture();
  const entries = {
    "cadence:upgrades": "[]",
    "cadence:profile": '{"goal":"work"}',
  };
  assert.equal(
    (await f.import(request("POST", { entries, userId: bob.id }))).status,
    200,
  );
  const snapshot = JSON.stringify([...f.documents]);
  assert.equal(
    (
      await f.import(
        request("POST", { entries: { "cadence:profile": '{"goal":"study"}' } }),
      )
    ).status,
    409,
  );
  assert.equal(JSON.stringify([...f.documents]), snapshot);
  assert.ok([...f.documents.keys()].every((key) => key.includes(alice.id)));
});

test("database outages return 503 instead of a fake empty account", async () => {
  const handlers = createStoreHandlers({
    user: async () => alice,
    repository: () => {
      throw new Error("Missing configuration");
    },
  });
  assert.equal((await handlers.GET(request("GET"))).status, 503);
  assert.equal((await handlers.POST(request("POST", entry()))).status, 503);
});

test("old shared progress is claimable only by the explicitly configured verified owner", () => {
  assert.equal(canImportSharedProgress(alice, undefined), false);
  assert.equal(canImportSharedProgress(alice, " ALICE@example.test "), true);
  assert.equal(canImportSharedProgress(bob, "alice@example.test"), false);
  assert.equal(
    canImportSharedProgress({ ...alice, email: null }, "alice@example.test"),
    false,
  );
});
