import test from "node:test";
import assert from "node:assert/strict";
import { monthDays, calendarRecords } from "../lib/calendar.ts";

test("calendar uses Monday columns, leap days, and complete weeks", () => {
  const feb = monthDays(2024, 1);
  assert.deepEqual(feb.slice(0, 4), [null, null, null, "2024-02-01"]);
  assert.equal(feb.filter(Boolean).length, 29);
  assert.ok(feb.includes("2024-02-29"));
  assert.equal(feb.length % 7, 0);
  const sunday = monthDays(2026, 1);
  assert.equal(sunday[6], "2026-02-01");
  assert.equal(sunday.filter(Boolean).length, 28);
  assert.equal(monthDays(2025, 12).find(Boolean), "2026-01-01");
});

test("calendar groups completed records by saved date and ignores duplicates, future dates, and invalid dates", () => {
  const a = { id: "a", date: "2026-09-23" };
  const days = calendarRecords(
    [
      a,
      a,
      { id: "b", date: a.date },
      { id: "old", date: "2025-12-31" },
      { id: "future", date: "2026-09-24" },
      { id: "invalid", date: "2026-02-30" },
    ],
    "2026-09-23",
  );
  assert.equal(days.size, 2);
  assert.equal(days.get(a.date).length, 2);
  assert.equal(days.get("2025-12-31")[0].id, "old");
});
