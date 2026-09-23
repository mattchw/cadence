import test from "node:test";
import assert from "node:assert/strict";
import {
  missionWeek,
  weeklyMission,
  completedChapters,
} from "../lib/missions.ts";
import { createSession, DEFAULT_PROFILE, toRecord } from "../lib/learning.ts";
import { generateDailyLesson } from "../lib/ai.ts";
import { configureStorage } from "../lib/storage.ts";

const monday = "2026-09-21";
function record(date, response = "Let’s try a small pilot first.") {
  return {
    id: date,
    date,
    title: "A proposal",
    prompt: "Propose a plan",
    original: response,
    revision: "",
    feedback: {},
    minutes: 3,
    reviewed: 0,
    focus: "register",
    difficulty: "right",
    readingLevel: "C1",
    writingLevel: "C1",
    mission: weeklyMission(DEFAULT_PROFILE, [], date),
  };
}

test("missions follow local calendar weeks including year boundaries and weekend catch-up", () => {
  assert.equal(missionWeek("2026-01-01"), "2025-12-29");
  assert.equal(missionWeek("2026-09-27"), monday);
  assert.equal(missionWeek("2026-09-28"), "2026-09-28");
  for (const date of ["2026-09-25", "2026-09-26", "2026-09-27"]) {
    const mission = weeklyMission(DEFAULT_PROFILE, [], date);
    assert.equal(mission.mode, "independent");
    assert.equal(mission.episode, 4);
  }
  const joined = weeklyMission(DEFAULT_PROFILE, [], "2026-09-23");
  assert.equal(joined.episode, 2);
  assert.deepEqual(joined.previous, []);
});

test("later scenes retain the established story and actual previous decisions without inventing missed chapters", () => {
  const first = record(monday);
  const mission = weeklyMission(
    { ...DEFAULT_PROFILE, goal: "study" },
    [first],
    "2026-09-24",
  );
  assert.equal(mission.title, first.mission.title);
  assert.equal(mission.setting, first.mission.setting);
  assert.equal(mission.previous.length, 1);
  assert.equal(mission.previous[0].response, first.original);
  assert.equal(mission.previous[0].episode, 0);
  const fresh = weeklyMission(DEFAULT_PROFILE, [first], "2026-09-28");
  assert.deepEqual(fresh.previous, []);
});

test("Friday sessions skip warm-ups and prompted expressions and save their no-hints identity", () => {
  const card = {
    id: "bank",
    kind: "vocab",
    original: "on balance",
    native: "considering everything",
    why: "useful",
    type: "register",
    due: monday,
    createdAt: monday,
  };
  const session = createSession(
    DEFAULT_PROFILE,
    10,
    [card],
    [record(monday)],
    "supported",
    "2026-09-25",
    true,
  );
  assert.equal(session.stage, "read");
  assert.deepEqual(session.reviewIds, []);
  assert.deepEqual(session.reuseTargets, []);
  assert.equal(session.recall, null);
  session.lesson = {
    title: "A new objection",
    passage: "A new audience",
    prompt: "Respond",
    support: "",
    successCriteria: [],
  };
  session.writing.draft = "We can try a smaller pilot.";
  session.writing.feedback = { verdict: "Specific and clear" };
  session.difficulty = "right";
  const saved = toRecord(session);
  assert.equal(saved.mission.mode, "independent");
  assert.equal(saved.original, session.writing.draft);
  session.mission.title = "changed";
  assert.notEqual(saved.mission.title, "changed");
  session.writing.hint = { hint: "some help" };
  assert.equal(toRecord(session), null);
});

test("completed final challenges are not repeated automatically, and chapters count only real completions", () => {
  const first = record(monday);
  const final = record("2026-09-25");
  const completed = completedChapters([first, first, final], monday);
  assert.equal(completed.size, 2);
  assert.ok(completed.has(4));
  const saturday = createSession(
    DEFAULT_PROFILE,
    3,
    [],
    [first, final],
    "balanced",
    "2026-09-26",
    true,
  );
  assert.equal(saturday.mission, undefined);
  const newWeek = createSession(
    DEFAULT_PROFILE,
    3,
    [],
    [first, final],
    "balanced",
    "2026-09-28",
    true,
  );
  assert.equal(newWeek.mission.episode, 0);
});

test("mission generation carries earlier choices but removes generated hints from a final challenge", async () => {
  configureStorage("google:mission-test");
  let request;
  globalThis.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return Response.json({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "A new concern",
            passage: "Sam introduces a new deadline.",
            prompt: "Explain what you can offer.",
            support: "An unwanted starter",
            successCriteria: ["An unwanted hint"],
          }),
        },
      ],
    });
  };
  const session = createSession(
    DEFAULT_PROFILE,
    3,
    [],
    [record(monday)],
    "supported",
    "2026-09-25",
    true,
  );
  const lesson = await generateDailyLesson(session);
  assert.equal(lesson.support, "");
  assert.deepEqual(lesson.successCriteria, []);
  const input = JSON.parse(request.messages[0].content);
  assert.equal(input.support, "none");
  assert.equal(input.personalFocus, undefined);
  assert.deepEqual(input.reuseTargets, []);
  assert.equal(input.mission.previous[0].response, record(monday).original);
  assert.match(request.system, /NO-HINTS TRANSFER CHALLENGE/);
});
