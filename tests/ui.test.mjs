import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: "http://localhost:3000" },
);
for (const key of [
  "window",
  "document",
  "navigator",
  "localStorage",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "Event",
  "MouseEvent",
]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
    writable: true,
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import("react");
globalThis.React = React; // tsx preserves this project's classic JSX setting.
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { default: App } = await import("../components/cadence.tsx");
const { WritingCoach } = await import("../components/writing-coach.tsx");
const { configureStorage, clearStorageSession } =
  await import("../lib/storage.ts");
const user = {
  id: "google:ui-test",
  email: "learner@example.test",
  name: "Learner",
};
const app = () => React.createElement(App, { user, onSignOut: async () => {} });
const { DEFAULT_PROFILE, emptyWriting, localDate } =
  await import("../lib/learning.ts");

const lesson = {
  title: "A thoughtful invitation",
  passage:
    "Your friend suggests dinner on Friday. You already have plans but would like to meet next week.",
  prompt: "Reply warmly and suggest another day.",
  support: "Acknowledge the invitation before suggesting another day.",
  successCriteria: ["Be warm and clear", "Offer a specific alternative"],
};
const hint = {
  strength: "Your meaning is clear.",
  focus: "register",
  category: "alternative",
  excerpt: "I cannot come.",
  hint: "How could you show that you appreciate the invitation?",
};
const feedback = {
  verdict: "Your response is clear and considerate.",
  rewrite: "Thanks for thinking of me! Could we meet on Tuesday instead?",
  qualities: {
    clarity: "Your alternative is clear.",
    accuracy: "Your sentences are accurate.",
    precision: "Tuesday is specific.",
    appropriateness: "The tone suits a friend.",
  },
  improvement: "You acknowledged the invitation and offered an alternative.",
  next_step: "Pair a refusal with a practical alternative.",
  upgrades: [
    {
      original: "Thanks",
      native: "Thanks for thinking of me",
      why: "Acknowledges the invitation.",
      type: "register",
      category: "alternative",
    },
    {
      original: "Another day",
      native: "Could we meet on Tuesday?",
      why: "Offers a concrete alternative.",
      type: "word-choice",
      category: "alternative",
    },
  ],
};
let root;
const pause = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const text = () => document.body.textContent;
function button(label) {
  const found = [...document.querySelectorAll("button")].find(
    (el) =>
      el.textContent.trim() === label ||
      el.getAttribute("aria-label") === label,
  );
  assert.ok(found, `Missing button: ${label}\n${text()}`);
  return found;
}
async function click(label) {
  await act(async () => {
    button(label).click();
    await pause();
  });
}
async function fill(selector, value) {
  const element = document.querySelector(selector);
  assert.ok(element, `Missing field ${selector}`);
  await act(async () => {
    const prototype =
      element.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : element.tagName === "SELECT"
          ? window.HTMLSelectElement.prototype
          : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(
      element,
      value,
    );
    element.dispatchEvent(
      new Event(element.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
    await pause();
  });
}
async function mount(element) {
  root = createRoot(document.getElementById("root"));
  await act(async () => {
    root.render(element);
    await pause(10);
  });
}
async function unmount() {
  if (root) {
    await act(async () => {
      root.unmount();
      await pause(550);
    });
    root = null;
  }
}
const response = (value) =>
  Response.json({ content: [{ type: "text", text: JSON.stringify(value) }] });

function mockServer(initial = {}) {
  const remote = new Map(Object.entries(initial));
  const versions = new Map(Object.keys(initial).map((key) => [key, 1]));
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith("/api/store")) {
      if (options.method === "POST") {
        const { key, value } = JSON.parse(options.body);
        remote.set(key, JSON.parse(value));
        versions.set(key, (versions.get(key) ?? 0) + 1);
        return Response.json({ version: versions.get(key) });
      }
      const key = new URL(
        String(url),
        "http://localhost:3000",
      ).searchParams.get("key");
      return remote.has(key)
        ? Response.json({
            key,
            value: JSON.stringify(remote.get(key)),
            version: versions.get(key) ?? 1,
          })
        : new Response("", { status: 404 });
    }
    assert.equal(url, "/api/ai");
    const request = JSON.parse(options.body);
    requests.push(request);
    if (request.system.includes("Create one engaging daily"))
      return response(lesson);
    if (request.system.includes("ONE actionable hint")) return response(hint);
    return response(feedback);
  };
  return { requests, remote };
}

test("Today completes review → reading → hint → revision → save, and survives remount without duplicate progress", async () => {
  localStorage.clear();
  clearStorageSession();
  configureStorage(user.id);
  const today = localDate();
  const bank = Array.from({ length: 3 }, (_, i) => ({
    id: `old-${i}`,
    kind: "vocab",
    original: `expression ${i}`,
    native: "a useful meaning",
    why: "An example sentence.",
    type: "vocab",
    focus: "reading",
    createdAt: today,
    due: today,
    reps: 0,
    interval: 0,
    ease: 2.5,
  }));
  const server = mockServer({
    "cadence:profile": { ...DEFAULT_PROFILE, configured: true, minutes: 3 },
    "cadence:upgrades": bank,
  });
  try {
    await mount(app());
    await click("Start my session");
    assert.match(text(), /0 of 1 reviewed/);
    assert.match(text(), /0 practice days/); // Generating a lesson is not practice completion.
    await fill("#review-recall", "My example sentence.");
    await click("Compare with my card");
    await click("Good");
    assert.match(text(), /A thoughtful invitation/);
    await click("I’m ready to try");
    await fill("#writing-draft", "I cannot come. Another day?");
    // The device copy must be available even before the debounced cloud save.
    const local = JSON.parse(
      JSON.parse(
        localStorage.getItem(
          "cadence:account:google%3Aui-test:cadence:learning",
        ),
      ).value,
    );
    assert.equal(local.session.writing.draft, "I cannot come. Another day?");
    await act(async () => root.unmount());
    root = null;
    await mount(app());
    assert.equal(
      document.querySelector("#writing-draft").value,
      "I cannot come. Another day?",
    );
    await click("Help me improve it");
    assert.match(text(), /How could you show that you appreciate/);
    assert.ok(!text().includes(feedback.rewrite));
    await fill(
      "#writing-revision",
      "Thanks! I have plans on Friday. Could we meet on Tuesday?",
    );
    await click("Review my revision");
    assert.match(text(), /Your response is clear and considerate/);
    await click("Save all to bank");
    assert.match(text(), /All saved/);
    const savedBank = JSON.parse(
      JSON.parse(
        localStorage.getItem(
          "cadence:account:google%3Aui-test:cadence:upgrades",
        ),
      ).value,
    );
    assert.equal(savedBank.length, 5); // Three existing cards plus both new suggestions.
    await click("Wrap up my session");
    assert.equal(button("Finish for today").disabled, true);
    await click("About right");
    await click("Finish for today");
    assert.match(text(), /A good place to stop/);
    assert.match(text(), /1 session completed/);
    assert.match(text(), /1 practice days/);
    await act(async () => root.unmount());
    root = null;
    await mount(app());
    assert.match(text(), /1 session completed/);
    assert.ok(!text().includes("Start my session"));
    const data = JSON.parse(
      JSON.parse(
        localStorage.getItem(
          "cadence:account:google%3Aui-test:cadence:learning",
        ),
      ).value,
    );
    assert.equal(data.records.length, 1);
    assert.equal(data.records[0].original, "I cannot come. Another day?");
    assert.equal(data.records[0].reviewed, 1);
    assert.match(data.records[0].revision, /Tuesday/);
    const revisionRequest = server.requests.find((item) =>
      item.system.includes("Give short, evidence-based"),
    );
    const submitted = JSON.parse(revisionRequest.messages[0].content);
    assert.equal(submitted.original, "I cannot come. Another day?");
    assert.match(submitted.response, /Tuesday/);
  } finally {
    await unmount();
  }
});

test("profile settings persist and the next lesson receives separate reading and writing levels", async () => {
  localStorage.clear();
  clearStorageSession();
  configureStorage(user.id);
  const { requests } = mockServer();
  try {
    await mount(app());
    await click("Learner profile");
    const selects = [...document.querySelectorAll("select")];
    assert.equal(selects.length, 7);
    selects[1].id = "test-writing-level";
    await fill("#test-writing-level", "A2");
    selects[0].id = "test-reading-level";
    await fill("#test-reading-level", "B1");
    await click("Save my profile");
    assert.match(text(), /Reading B1 · Writing A2/);
    await click("Start my session");
    await pause();
    const request = requests.find((item) =>
      item.system.includes("Create one engaging daily"),
    );
    const learner = JSON.parse(request.messages[0].content).learner;
    assert.equal(learner.skillLevels.reading, "B1");
    assert.equal(learner.skillLevels.writing, "A2");
  } finally {
    await unmount();
  }
});

test("missing AI configuration and malformed replies keep the draft and allow retry", async () => {
  localStorage.clear();
  clearStorageSession();
  configureStorage(user.id);
  let mode = "missing";
  globalThis.fetch = async () =>
    mode === "missing"
      ? new Response("", { status: 503 })
      : mode === "malformed"
        ? response({ verdict: "incomplete" })
        : response({ ...feedback, upgrades: [] });
  function Harness() {
    const [value, setValue] = React.useState(emptyWriting);
    return React.createElement(WritingCoach, {
      task: "Write a reply",
      focus: "register",
      profile: DEFAULT_PROFILE,
      value,
      onChange: setValue,
      bank: [],
      onSave() {},
    });
  }
  try {
    await mount(React.createElement(Harness));
    await fill("#writing-draft", "Keep this draft.");
    await click("Get feedback directly");
    assert.match(text(), /coach is not configured/);
    assert.equal(
      document.querySelector("#writing-draft").value,
      "Keep this draft.",
    );
    mode = "malformed";
    await click("Get feedback directly");
    assert.match(text(), /feedback was incomplete/);
    mode = "valid";
    await click("Get feedback directly");
    assert.match(text(), /Your response is clear and considerate/);
    assert.ok(!text().includes("Expressions to take with you"));
  } finally {
    await unmount();
  }
});

test("database failure blocks an empty workspace and retry loads the saved account", async () => {
  localStorage.clear();
  clearStorageSession();
  configureStorage(user.id);
  globalThis.fetch = async () =>
    Response.json({ error: "database_unavailable" }, { status: 503 });
  try {
    await mount(app());
    assert.match(text(), /reconnect to your progress/);
    assert.ok(!text().includes("Start my session"));
    mockServer({
      "cadence:profile": {
        ...DEFAULT_PROFILE,
        configured: true,
        levels: { ...DEFAULT_PROFILE.levels, writing: "B2" },
      },
    });
    await click("Retry loading my progress");
    assert.match(text(), /Reading C1 · Writing B2/);
    assert.match(text(), /Saved to your account/);
  } finally {
    await unmount();
  }
});

test("sign out waits for a successful account save", async () => {
  localStorage.clear();
  clearStorageSession();
  configureStorage(user.id);
  const server = mockServer();
  let signedOut = false;
  try {
    await mount(
      React.createElement(App, {
        user,
        onSignOut: async () => {
          signedOut = true;
        },
      }),
    );
    await click("Learner profile");
    await click("Save my profile");
    assert.match(text(), /Saving to your account/);
    await click("Sign out");
    assert.equal(signedOut, true);
    assert.equal(server.remote.get("cadence:profile").configured, true);
  } finally {
    await unmount();
  }
});

test("a database outage does not prevent signing out when nothing is unsaved", async () => {
  localStorage.clear();
  clearStorageSession();
  configureStorage(user.id);
  globalThis.fetch = async () =>
    Response.json({ error: "database_unavailable" }, { status: 503 });
  let signedOut = false;
  try {
    await mount(
      React.createElement(App, {
        user,
        onSignOut: async () => {
          signedOut = true;
        },
      }),
    );
    await click("Sign out");
    assert.equal(signedOut, true);
  } finally {
    await unmount();
  }
});

test("failed saves keep the user signed in until they explicitly leave a device backup", async () => {
  localStorage.clear();
  clearStorageSession();
  configureStorage(user.id);
  mockServer();
  let signedOut = false;
  try {
    await mount(
      React.createElement(App, {
        user,
        onSignOut: async () => {
          signedOut = true;
        },
      }),
    );
    await click("Learner profile");
    await click("Save my profile");
    globalThis.fetch = async () =>
      Response.json({ error: "database_unavailable" }, { status: 503 });
    await click("Sign out");
    assert.equal(signedOut, false);
    assert.match(text(), /latest changes have not reached your account/);
    await click("Sign out without syncing");
    assert.equal(signedOut, true);
    const backup = JSON.parse(
      localStorage.getItem("cadence:account:google%3Aui-test:cadence:profile"),
    );
    assert.equal(backup.dirty, true);
    assert.equal(JSON.parse(backup.value).configured, true);
  } finally {
    await unmount();
  }
});
