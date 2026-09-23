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

test("personal recall resumes, feeds a fresh challenge, and stores evidenced phrase use with the completed session", async () => {
  localStorage.clear();
  clearStorageSession();
  configureStorage(user.id);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDate(yesterdayDate);
  const old = {
    id: "past-correction",
    date: yesterday,
    title: "A choice",
    prompt: "Explain your decision",
    original: "I did a decision yesterday.",
    revision: "",
    feedback: {
      upgrades: [
        {
          original: "did a decision",
          native: "made a decision",
          why: "Use make with decision.",
          type: "collocation",
          category: "correction",
        },
      ],
    },
    minutes: 3,
    reviewed: 0,
    focus: "collocation",
    difficulty: "right",
    readingLevel: "C1",
    writingLevel: "C1",
  };
  const savedPhrase = {
    id: "decision-phrase",
    kind: "vocab",
    original: "make a decision",
    native: "choose between options",
    why: "Useful when planning",
    type: "collocation",
    focus: "work",
    createdAt: yesterday,
    due: yesterday,
    reps: 1,
    interval: 1,
    ease: 2.5,
  };
  const server = mockServer({
    "cadence:profile": { ...DEFAULT_PROFILE, configured: true, minutes: 3 },
    "cadence:learning": { session: null, records: [old] },
    "cadence:upgrades": [savedPhrase],
  });
  const baseFetch = globalThis.fetch;
  let generation;
  let checking;
  let invalidEvidence = true;
  const draft = "I will make a decision tomorrow.";
  globalThis.fetch = async (url, options = {}) => {
    if (url === "/api/ai") {
      const request = JSON.parse(options.body);
      if (request.system.includes("Create one engaging daily")) {
        generation = JSON.parse(request.messages[0].content);
        return response({
          ...lesson,
          title: "A team decision",
          passage: "Your team is choosing a venue for Friday’s meeting.",
          prompt: "Tell your colleague when you will choose the venue.",
        });
      }
      if (request.system.includes("Give short, evidence-based")) {
        checking = JSON.parse(request.messages[0].content);
        return response({
          ...feedback,
          upgrades: [],
          expressionChecks: [
            {
              id: savedPhrase.id,
              status: "used",
              source: "draft",
              evidence: invalidEvidence ? "You did not write this." : draft,
              note: "A natural way to describe choosing the venue.",
            },
          ],
        });
      }
    }
    return baseFetch(url, options);
  };
  try {
    await mount(app());
    await click("Start my session");
    assert.match(text(), /Can you bring it back/);
    assert.ok(
      !document
        .querySelector("#personal-recall")
        .closest("section")
        .textContent.includes("made a decision"),
    );
    await fill("#personal-recall", "made a decision");
    await act(async () => root.unmount());
    root = null;
    await mount(app());
    assert.equal(
      document.querySelector("#personal-recall").value,
      "made a decision",
    );
    await click("Compare with the earlier feedback");
    await click("Recalled it");
    assert.match(text(), /A team decision/);
    assert.equal(generation.personalFocus.correction, "made a decision");
    assert.equal(generation.reuseTargets[0].phrase, "make a decision");
    await click("I’m ready to try");
    assert.match(text(), /Put your saved expressions to work/);
    await fill("#writing-draft", draft);
    await click("Help me improve it");
    await fill(
      "#writing-revision",
      "I will make a decision tomorrow and let you know.",
    );
    await click("Review my revision");
    assert.match(text(), /expression evidence did not match/);
    assert.ok(!text().includes("Used in your first draft"));
    invalidEvidence = false;
    await click("Review my revision");
    assert.match(text(), /Used in your first draft/);
    assert.equal(checking.original, draft);
    assert.equal(checking.reuseTargets[0].id, savedPhrase.id);
    await click("Wrap up my session");
    await click("About right");
    await click("Finish for today");
    assert.match(text(), /A small step you can see/);
    assert.match(text(), /Weak-spot recalls after a break/);
    const saved = server.remote.get("cadence:learning");
    assert.equal(saved.records.length, 2);
    assert.equal(saved.records[1].recall.outcome, "remembered");
    assert.equal(saved.records[1].feedback.expressionChecks[0].evidence, draft);
    assert.equal(saved.records[1].reuseTargets[0].phrase, "make a decision");
    // A second browser starts without the first browser's recovery copy.
    await unmount();
    clearStorageSession();
    localStorage.clear();
    await mount(app());
    assert.match(text(), /A small step you can see/);
    assert.match(text(), /Used in your first draft/);
    assert.match(text(), /2 sessions completed/);
  } finally {
    await unmount();
  }
});

test("Calendar shows saved practice days, opens session details, and navigates months", async () => {
  localStorage.clear();
  clearStorageSession();
  configureStorage(user.id);
  const now = new Date();
  const today = localDate(now);
  const previous = localDate(
    new Date(now.getFullYear(), now.getMonth() - 1, 15, 12),
  );
  const record = (id, date, title) => ({
    id,
    date,
    title,
    prompt: "Explain your idea",
    original: "My first idea.",
    revision: "A clearer idea.",
    feedback: {
      improvement: "You made your meaning clearer.",
      next_step: "Keep the audience in mind.",
    },
    minutes: 10,
    reviewed: 2,
    focus: "register",
    difficulty: "right",
    readingLevel: "C1",
    writingLevel: "C1",
  });
  mockServer({
    "cadence:learning": {
      session: null,
      records: [
        record("a", today, "A thoughtful reply"),
        record("b", today, "Another perspective"),
        record("c", previous, "Last month’s challenge"),
      ],
    },
  });
  try {
    await mount(app());
    await click("Calendar");
    const panel = () =>
      document.querySelector('[aria-label="Selected day’s progress"]');
    assert.match(panel().textContent, /A thoughtful reply/);
    assert.match(panel().textContent, /Another perspective/);
    const selectedDay = document.querySelector('button[aria-pressed="true"]');
    assert.match(
      selectedDay.getAttribute("aria-label"),
      /today, 2 completed sessions/,
    );
    assert.equal(button("Next month").disabled, true);
    const details = panel().querySelector("details");
    await act(async () => details.querySelector("summary").click());
    assert.equal(details.open, true);
    assert.match(details.textContent, /A clearer idea/);
    await click("Previous month");
    assert.match(panel().textContent, /Last month’s challenge/);
    assert.equal(button("Next month").disabled, false);
    const blank = [...document.querySelectorAll("button[aria-label]")].find(
      (el) => el.getAttribute("aria-label").includes("no completed sessions"),
    );
    await act(async () => blank.click());
    assert.match(panel().textContent, /No completed daily sessions/);
    await click("This month");
    assert.match(panel().textContent, /A thoughtful reply/);
    assert.equal(button("Next month").disabled, true);
  } finally {
    await unmount();
  }
});

test("an unfinished session does not mark the calendar as completed", async () => {
  localStorage.clear();
  clearStorageSession();
  configureStorage(user.id);
  mockServer({
    "cadence:learning": {
      session: {
        ...(await import("../lib/learning.ts")).createSession(
          DEFAULT_PROFILE,
          3,
          [],
          [],
          "balanced",
        ),
        stage: "write",
        lesson,
      },
      records: [],
    },
  });
  try {
    await mount(app());
    await click("Calendar");
    assert.match(
      document
        .querySelector('button[aria-pressed="true"]')
        .getAttribute("aria-label"),
      /no completed sessions/,
    );
    assert.match(text(), /0 \/ 4 days this week/);
    await click("Practise today");
    assert.ok(document.querySelector("#writing-draft"));
  } finally {
    await unmount();
  }
});

test("initial setup failures explain the missing database and the account retry button reloads progress", async () => {
  localStorage.clear();
  clearStorageSession();
  configureStorage(user.id);
  globalThis.fetch = async () =>
    Response.json({ error: "database_not_configured" }, { status: 503 });
  try {
    await mount(app());
    assert.match(text(), /KV_REST_API_URL/);
    assert.match(text(), /redeploy/);
    assert.ok(!text().includes("0 practice days"));
    assert.ok(!text().includes("Retry saving"));
    mockServer({ "cadence:profile": { ...DEFAULT_PROFILE, configured: true } });
    await click("Retry loading");
    assert.match(text(), /Start my session/);
    assert.match(text(), /Saved to your account/);
    await click("Learner profile");
    assert.ok(document.querySelector("select"));
  } finally {
    await unmount();
  }
});
