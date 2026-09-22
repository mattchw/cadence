import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROFILE,
  normaliseProfile,
  createSession,
  suggestedSupport,
  chooseFocus,
  addUpgrades,
  toRecord,
  weeklyDays,
  localDate,
} from "../lib/learning.ts";
import { schedule } from "../lib/sr.ts";

const profile = () => structuredClone(DEFAULT_PROFILE);
const card = (id, due = "2026-09-22") => ({
  id,
  kind: "upgrade",
  original: `phrase ${id}`,
  native: `alternative ${id}`,
  why: "A useful change",
  type: "register",
  focus: "work",
  createdAt: due,
  due,
  reps: 0,
  interval: 0,
  ease: 2.5,
});
const record = (id, difficulty = "right", overrides = {}) => ({
  id,
  date: "2026-09-22",
  title: "A small challenge",
  prompt: "Write a reply",
  original: "Hello",
  revision: "",
  feedback: { verdict: "Clear", upgrades: [] },
  minutes: 10,
  reviewed: 0,
  focus: "register",
  difficulty,
  writingLevel: "C1",
  readingLevel: "C1",
  ...overrides,
});

test("profile keeps different skill levels and normalises invalid settings", () => {
  const value = normaliseProfile({
    ...profile(),
    levels: {
      reading: "B2",
      writing: "A2",
      listening: "invalid",
      speaking: "C2",
    },
    target: "C2+",
    minutes: 15,
    weeklyGoal: 99,
    interests: [" Food ", "", "Food", null],
  });
  assert.deepEqual(value.levels, {
    reading: "B2",
    writing: "A2",
    listening: "C1",
    speaking: "C2",
  });
  assert.equal(value.target, "C2");
  assert.equal(value.minutes, 10);
  assert.equal(value.weeklyGoal, 7);
  assert.deepEqual(value.interests, ["Food"]);
});

test("sessions cap reviews, prioritise overdue cards and exclude future cards", () => {
  const cards = [
    card("future", "2026-09-23"),
    ...Array.from({ length: 8 }, (_, i) =>
      card(String(i), `2026-09-${String(22 - i).padStart(2, "0")}`),
    ),
  ];
  for (const [minutes, expected] of [
    [3, 1],
    [10, 3],
    [20, 5],
  ]) {
    const session = createSession(
      profile(),
      minutes,
      cards,
      [],
      "balanced",
      "2026-09-22",
    );
    assert.equal(session.reviewIds.length, expected);
    assert.equal(session.reviewIds[0], "7");
    assert.equal(session.stage, "review");
    assert.ok(!session.reviewIds.includes("future"));
  }
});

test("empty-bank sessions start with reading and retain their own profile snapshot", () => {
  const learner = profile();
  const session = createSession(learner, 3, [], [], "supported", "2026-09-22");
  learner.levels.writing = "A1";
  learner.interests.push("A new topic");
  assert.equal(session.stage, "read");
  assert.equal(session.profile.levels.writing, "C1");
  assert.equal(session.profile.interests.length, 2);
  assert.equal(session.minutes, 3);
});

test("difficulty adapts only after three matching-level reflections", () => {
  assert.equal(
    suggestedSupport([record("1", "easy"), record("2", "easy")], profile()),
    "balanced",
  );
  assert.equal(
    suggestedSupport(
      [record("1", "easy"), record("2", "easy"), record("3", "easy")],
      profile(),
    ),
    "stretch",
  );
  assert.equal(
    suggestedSupport(
      [record("1", "hard"), record("2", "hard"), record("3", "hard")],
      profile(),
    ),
    "supported",
  );
  assert.equal(
    suggestedSupport(
      [record("1", "hard"), record("2", "hard"), record("3", "right")],
      profile(),
    ),
    "balanced",
  );
  assert.equal(
    suggestedSupport(
      [
        record("1", "hard"),
        record("2", "hard"),
        record("3", "hard", { readingLevel: "B1" }),
      ],
      profile(),
    ),
    "balanced",
  );
});

test("repeated corrections inform focus, optional alternatives do not", () => {
  const correction = {
    original: "a",
    native: "b",
    why: "reason",
    type: "grammar",
    category: "correction",
  };
  const records = [
    record("1", "right", { feedback: { upgrades: [correction, correction] } }),
    record("2", "right", { feedback: { upgrades: [correction] } }),
  ];
  assert.equal(chooseFocus(records, "2026-09-22"), "grammar");
  const optional = records.map((entry) => ({
    ...entry,
    feedback: { upgrades: [{ ...correction, category: "alternative" }] },
  }));
  assert.notEqual(chooseFocus(optional, "2026-09-22"), "grammar");
  assert.notEqual(chooseFocus(records.slice(0, 1), "2026-09-22"), "grammar");
});

test("saving all suggestions is atomic, deduplicated, and retains existing cards", () => {
  const bank = [card("old")];
  const suggestions = [
    {
      original: "quite good",
      native: "promising",
      why: "Precision",
      type: "word-choice",
    },
    {
      original: "I disagree",
      native: "I see it differently",
      why: "Tone",
      type: "register",
    },
  ];
  const saved = addUpgrades(
    bank,
    [...suggestions, suggestions[0]],
    "daily",
    "2026-09-22",
  );
  assert.equal(saved.length, 3);
  assert.equal(saved[0].id, "old");
  assert.equal(new Set(saved.map((item) => item.id)).size, 3);
  assert.equal(addUpgrades(saved, suggestions, "daily").length, 3);
  assert.equal(bank.length, 1);
  assert.equal(saved[1].due, "2026-09-22");
});

test("completion requires feedback and reflection, and preserves both attempts", () => {
  const session = createSession(
    profile(),
    10,
    [],
    [],
    "balanced",
    "2026-09-22",
  );
  assert.equal(toRecord(session), null);
  session.lesson = {
    title: "Tone switch",
    prompt: "Reply diplomatically",
    passage: "A scene",
    support: "A hint",
    successCriteria: ["Be clear"],
  };
  session.writing = {
    draft: "No.",
    revision: "Could we consider another option?",
    hint: { hint: "Soften the tone" },
    feedback: { verdict: "Clearer and more collaborative" },
  };
  assert.equal(toRecord(session), null);
  session.difficulty = "right";
  const saved = toRecord(session);
  assert.equal(saved.original, "No.");
  assert.equal(saved.revision, "Could we consider another option?");
  assert.equal(saved.writingLevel, "C1");
  assert.equal(saved.readingLevel, "C1");
});

test("weekly goals count unique days from Monday through today, including year boundaries", () => {
  const records = [
    "2025-12-28",
    "2025-12-29",
    "2025-12-29",
    "2026-01-01",
    "2026-01-02",
  ].map((date, i) => record(String(i), "right", { date }));
  assert.equal(weeklyDays(records, new Date(2026, 0, 1, 14)), 2);
});

test("local date formatting preserves calendar date at midnight", () => {
  assert.equal(localDate(new Date(2026, 8, 22, 0, 5)), "2026-09-22");
});

test("review grades schedule a return without mutating the card", () => {
  const item = card("review");
  const first = schedule(item, "good");
  const second = schedule(first, "good");
  assert.equal(first.interval, 1);
  assert.equal(second.interval, 3);
  assert.equal(item.reps, 0);
  assert.equal(schedule(second, "again").reps, 0);
  assert.equal(schedule(item, "easy").interval, 2);
});
