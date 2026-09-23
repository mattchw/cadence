import test from "node:test";
import assert from "node:assert/strict";
import {
  selectRecall,
  selectReuseTargets,
  validateExpressionChecks,
  containsPhrase,
  loopProgress,
} from "../lib/daily-loop.ts";
import { createSession, DEFAULT_PROFILE, toRecord } from "../lib/learning.ts";
import { generateDailyLesson, getFeedback } from "../lib/ai.ts";
import { configureStorage } from "../lib/storage.ts";

const correction = {
  original: "did a decision",
  native: "made a decision",
  why: "Use make with decision.",
  type: "collocation",
  category: "correction",
};
const oldRecord = (overrides = {}) => ({
  id: "old",
  date: "2026-09-20",
  title: "Planning",
  prompt: "Explain a choice to a colleague",
  original: "I did a decision yesterday.",
  revision: "",
  feedback: { upgrades: [correction] },
  minutes: 3,
  reviewed: 0,
  focus: "collocation",
  difficulty: "right",
  readingLevel: "C1",
  writingLevel: "C1",
  ...overrides,
});
const target = {
  id: "phrase",
  phrase: "make a decision",
  meaning: "choose between options",
  savedOn: "2026-09-20",
};
const card = {
  id: target.id,
  kind: "vocab",
  original: target.phrase,
  native: target.meaning,
  why: "Useful at work",
  type: "collocation",
  focus: "work",
  createdAt: target.savedOn,
  due: "2026-09-20",
  reps: 1,
  interval: 1,
  ease: 2.5,
};

test("recall uses an actual earlier correction, never an optional alternative or invented quote", () => {
  assert.equal(selectRecall([oldRecord()], "2026-09-20"), null);
  assert.equal(
    selectRecall(
      [
        oldRecord({
          feedback: { upgrades: [{ ...correction, category: "alternative" }] },
        }),
      ],
      "2026-09-21",
    ),
    null,
  );
  assert.equal(
    selectRecall(
      [oldRecord({ original: "I wrote something else." })],
      "2026-09-21",
    ),
    null,
  );
  const selected = selectRecall([oldRecord()], "2026-09-21");
  assert.equal(selected.original, "did a decision");
  assert.equal(selected.revealed, false);
  assert.equal(selected.outcome, null);
});

test("successful recall spaces out to three then seven days; missed recall returns the next day", () => {
  const recall = selectRecall([oldRecord()], "2026-09-21");
  const first = oldRecord({
    id: "first",
    date: "2026-09-21",
    feedback: { upgrades: [] },
    recall: {
      ...recall,
      attempt: "made a decision",
      revealed: true,
      outcome: "remembered",
    },
  });
  assert.equal(selectRecall([oldRecord(), first], "2026-09-22"), null);
  assert.ok(selectRecall([oldRecord(), first], "2026-09-24"));
  const second = { ...first, id: "second", date: "2026-09-24" };
  assert.equal(selectRecall([oldRecord(), first, second], "2026-09-30"), null);
  assert.ok(selectRecall([oldRecord(), first, second], "2026-10-01"));
  const missed = { ...first, recall: { ...first.recall, outcome: "again" } };
  assert.ok(selectRecall([oldRecord(), missed], "2026-09-22"));
});

test("a short session replaces its bank review with a personal recall and saves the loop snapshot", () => {
  const session = createSession(
    DEFAULT_PROFILE,
    3,
    [card],
    [oldRecord()],
    "balanced",
    "2026-09-21",
  );
  assert.equal(session.stage, "recall");
  assert.equal(session.focus, "collocation");
  assert.equal(session.reviewIds.length, 0);
  assert.equal(session.reuseTargets.length, 1);
  session.recall = {
    ...session.recall,
    attempt: "made a decision",
    revealed: true,
    outcome: "remembered",
  };
  session.lesson = {
    title: "A fresh context",
    prompt: "Reply",
    passage: "Context",
    support: "Hint",
    successCriteria: ["Be clear"],
  };
  session.writing.feedback = { verdict: "Clear", expressionChecks: [] };
  session.difficulty = "right";
  const saved = toRecord(session);
  assert.equal(saved.recall.attempt, "made a decision");
  assert.equal(saved.reuseTargets[0].phrase, "make a decision");
  session.recall.attempt = "changed";
  assert.equal(saved.recall.attempt, "made a decision");
});

test("reuse selects older expressions, not vocab definitions, and rotates already-used targets", () => {
  const another = { ...card, id: "another", original: "on balance" };
  const fresh = { ...card, id: "fresh", createdAt: "2026-09-21" };
  const repeated = { ...card, id: "duplicate" };
  const records = [
    oldRecord({
      feedback: { expressionChecks: [{ id: card.id, status: "used" }] },
    }),
  ];
  const targets = selectReuseTargets(
    [card, fresh, another, repeated],
    records,
    "2026-09-21",
    2,
    "collocation",
  );
  assert.equal(targets[0].phrase, "on balance");
  assert.equal(targets.length, 2);
  assert.equal(new Set(targets.map((entry) => entry.phrase)).size, 2);
  assert.ok(!targets.some((entry) => entry.id === "fresh"));
  assert.equal(
    selectReuseTargets([card], [], "2026-09-21", 1, "collocation")[0].phrase,
    card.original,
  );
});

test("expression credit requires exact learner evidence with whole phrase boundaries", () => {
  const draft = "I will make a decision tomorrow.";
  const check = {
    id: target.id,
    status: "used",
    source: "draft",
    evidence: draft,
    note: "A natural combination.",
  };
  assert.equal(
    validateExpressionChecks([check], [target], draft)[0].source,
    "draft",
  );
  assert.throws(
    () =>
      validateExpressionChecks([check], [target], "I will decide tomorrow."),
    /evidence/,
  );
  assert.throws(
    () =>
      validateExpressionChecks(
        [{ ...check, source: "revision" }],
        [target],
        draft,
      ),
    /evidence/,
  );
  assert.throws(
    () => validateExpressionChecks([check, check], [target], draft),
    /incomplete/,
  );
  assert.throws(
    () => validateExpressionChecks(undefined, [target], draft),
    /incomplete/,
  );
  assert.equal(containsPhrase("An artwork", "art"), false);
  assert.equal(containsPhrase("ON BALANCE, yes", "on balance"), true);
  const revised = validateExpressionChecks(
    [{ ...check, source: "revision" }],
    [target],
    "I will decide.",
    draft,
  );
  assert.equal(revised[0].source, "revision");
});

test("progress counts delayed self-rated recall and first-draft use, never hinted reuse or duplicate completions", () => {
  const recall = selectRecall([oldRecord()], "2026-09-21");
  const entry = oldRecord({
    id: "new",
    date: "2026-09-21",
    original: "I will make a decision.",
    recall: { ...recall, attempt: "made a decision", outcome: "remembered" },
    feedback: {
      expressionChecks: [
        {
          id: target.id,
          phrase: target.phrase,
          source: "draft",
          status: "used",
          evidence: "I will make a decision.",
        },
      ],
    },
  });
  assert.deepEqual(loopProgress([oldRecord(), entry, entry]), {
    recalled: 1,
    phrases: 1,
  });
  assert.deepEqual(
    loopProgress([
      {
        ...entry,
        recall: { ...entry.recall, outcome: "again" },
        feedback: {
          expressionChecks: [
            { ...entry.feedback.expressionChecks[0], source: "revision" },
          ],
        },
      },
    ]),
    { recalled: 0, phrases: 0 },
  );
  assert.deepEqual(loopProgress([oldRecord()]), { recalled: 0, phrases: 0 });
});

test("daily generation receives the previous correction and reuse targets; old sessions remain supported", async () => {
  configureStorage("google:loop-test");
  let submitted;
  globalThis.fetch = async (_url, options) => {
    submitted = JSON.parse(JSON.parse(options.body).messages[0].content);
    return Response.json({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "Another choice",
            passage: "A new scene",
            prompt: "Explain a decision",
            support: "Keep it clear",
            successCriteria: ["Explain why"],
          }),
        },
      ],
    });
  };
  const session = createSession(
    DEFAULT_PROFILE,
    3,
    [card],
    [oldRecord()],
    "balanced",
    "2026-09-21",
  );
  await generateDailyLesson(session);
  assert.equal(submitted.personalFocus.correction, "made a decision");
  assert.equal(submitted.reuseTargets[0].phrase, target.phrase);
  delete session.recall;
  delete session.reuseTargets;
  await generateDailyLesson(session);
  assert.equal(submitted.personalFocus, undefined);
  assert.deepEqual(submitted.reuseTargets, []);
});

test("feedback sends both attempts and rejects model credit sourced from its own rewrite", async () => {
  configureStorage("google:loop-test");
  let submitted;
  globalThis.fetch = async (_url, options) => {
    submitted = JSON.parse(JSON.parse(options.body).messages[0].content);
    return Response.json({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            verdict: "Clear",
            rewrite: "I will make a decision.",
            qualities: {
              clarity: "Clear",
              accuracy: "Accurate",
              precision: "Specific",
              appropriateness: "Suitable",
            },
            upgrades: [],
            expressionChecks: [
              {
                id: target.id,
                status: "used",
                source: "draft",
                evidence: "I will make a decision.",
                note: "Natural",
              },
            ],
          }),
        },
      ],
    });
  };
  await assert.rejects(
    getFeedback(
      "collocation",
      "Explain a choice",
      "I will decide tomorrow.",
      false,
      DEFAULT_PROFILE,
      "I will choose tomorrow.",
      [target],
    ),
    /evidence/,
  );
  assert.equal(submitted.original, "I will choose tomorrow.");
  assert.equal(submitted.response, "I will decide tomorrow.");
  assert.equal(submitted.reuseTargets[0].id, target.id);
});

test("a correction fixed with a hint can become tomorrow's recall without treating style changes as errors", () => {
  const fixed = oldRecord({
    revision: "I made a decision yesterday.",
    feedback: { upgrades: [], practiceCorrection: correction },
  });
  assert.equal(selectRecall([fixed], "2026-09-21").original, "did a decision");
  assert.equal(
    selectRecall(
      [
        {
          ...fixed,
          feedback: {
            practiceCorrection: { ...correction, category: "alternative" },
          },
        },
      ],
      "2026-09-21",
    ),
    null,
  );
  assert.equal(
    selectRecall(
      [{ ...fixed, revision: "An unrelated sentence" }],
      "2026-09-21",
    ),
    null,
  );
});

test("natural variants receive feedback without earning exact-phrase credit or blocking the session", () => {
  const draft = "I made a decision yesterday.";
  const checks = validateExpressionChecks(
    [
      {
        id: target.id,
        status: "used",
        source: "draft",
        evidence: draft,
        note: "The past tense fits yesterday.",
      },
    ],
    [target],
    draft,
  );
  assert.equal(checks[0].status, "variation");
  assert.deepEqual(
    loopProgress([
      oldRecord({ original: draft, feedback: { expressionChecks: checks } }),
    ]),
    { recalled: 0, phrases: 0 },
  );
});
