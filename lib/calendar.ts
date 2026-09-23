import { localDate } from "./learning";
import type { LearningRecord } from "./types";

export function monthDays(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0, 12).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= count; day++)
    cells.push(localDate(new Date(year, month, day, 12)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function calendarRecords(
  records: LearningRecord[],
  today: string,
): Map<string, LearningRecord[]> {
  const days = new Map<string, LearningRecord[]>();
  const seen = new Set<string>();
  for (const record of records) {
    if (
      seen.has(record.id) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
      record.date > today
    )
      continue;
    const [year, month, day] = record.date.split("-").map(Number);
    if (localDate(new Date(year, month - 1, day, 12)) !== record.date) continue;
    seen.add(record.id);
    days.set(record.date, [...(days.get(record.date) ?? []), record]);
  }
  return days;
}
