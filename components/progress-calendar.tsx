"use client";
import { useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { calendarRecords, monthDays } from "@/lib/calendar";
import { FOCUS_LABELS, localDate, weeklyDays } from "@/lib/learning";
import type { LearningRecord } from "@/lib/types";

const dateLabel = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
export function ProgressCalendar({
  records,
  weeklyGoal,
  onPractice,
}: {
  records: LearningRecord[];
  weeklyGoal: number;
  onPractice: () => void;
}) {
  const now = new Date();
  const today = localDate(now);
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1, 12),
  );
  const [selected, setSelected] = useState(today);
  const days = calendarRecords(records, today);
  const prefix = localDate(month).slice(0, 7);
  const monthly = [...days].filter(([date]) => date.startsWith(prefix));
  const sessions = monthly.flatMap(([, entries]) => entries);
  const selectedRecords = days.get(selected) ?? [];
  const week = weeklyDays([...days.values()].flat(), now);
  const label = month.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const changeMonth = (direction: number) => {
    const next = new Date(
      month.getFullYear(),
      month.getMonth() + direction,
      1,
      12,
    );
    setMonth(next);
    const nextPrefix = localDate(next).slice(0, 7);
    setSelected(
      nextPrefix === currentMonth
        ? today
        : ([...days.keys()]
            .filter((date) => date.startsWith(nextPrefix))
            .sort()
            .at(-1) ?? localDate(next)),
    );
  };
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-teal-900 p-6 text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-200">
          Your practice calendar
        </p>
        <h2 className="mt-3 font-serif text-3xl">See your consistency grow.</h2>
        <p className="mt-3 text-sm leading-relaxed text-teal-100">
          Every completed Today session leaves a mark. Pick a day to revisit
          what you practised.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-teal-800 px-3 py-2 text-sm font-medium">
            {week} / {weeklyGoal} days this week
          </span>
          <span className="text-xs text-teal-100">
            {week >= weeklyGoal
              ? "Weekly goal reached. Enjoy the progress you’ve made."
              : "A day off does not erase your progress."}
          </span>
        </div>
      </section>
      <section className="panel space-y-5" aria-label="Practice calendar">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-2xl" aria-live="polite">
            {label}
          </h3>
          <div className="flex items-center gap-2">
            <button
              className="secondary-button"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="secondary-button text-xs"
              onClick={() => {
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12));
                setSelected(today);
              }}
            >
              This month
            </button>
            <button
              className="secondary-button"
              aria-label="Next month"
              disabled={prefix >= currentMonth}
              onClick={() => changeMonth(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
          <div>
            <p className="text-xl font-semibold text-teal-800">
              {monthly.length}
            </p>
            <p className="text-xs text-slate-500">Practice days</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-teal-800">
              {sessions.length}
            </p>
            <p className="text-xs text-slate-500">Sessions</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-teal-800">
              {sessions.reduce((sum, record) => sum + record.reviewed, 0)}
            </p>
            <p className="text-xs text-slate-500">Cards reviewed</p>
          </div>
        </div>
        <div
          className="grid grid-cols-7 gap-1 sm:gap-2"
          role="group"
          aria-label={label}
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              key={day}
              className="pb-2 text-center text-xs font-medium text-slate-500"
              aria-hidden="true"
            >
              {day}
            </div>
          ))}
          {monthDays(month.getFullYear(), month.getMonth()).map(
            (date, index) => {
              if (!date)
                return <div key={`empty-${index}`} aria-hidden="true" />;
              const count = days.get(date)?.length ?? 0;
              const isToday = date === today;
              return (
                <button
                  key={date}
                  aria-label={`${dateLabel(date)}${isToday ? ", today" : ""}, ${count ? `${count} completed ${count === 1 ? "session" : "sessions"}` : date > today ? "future day" : "no completed sessions"}`}
                  aria-pressed={selected === date}
                  disabled={date > today}
                  onClick={() => setSelected(date)}
                  className={`relative flex min-h-14 flex-col items-center justify-center rounded-lg border text-sm transition sm:min-h-16 ${selected === date ? "ring-2 ring-teal-700 ring-offset-1" : ""} ${count ? "border-teal-700 bg-teal-700 font-semibold text-white hover:bg-teal-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300"} ${isToday && !count ? "border-teal-600 font-semibold text-teal-800" : ""}`}
                >
                  <span>{Number(date.slice(-2))}</span>
                  <span
                    className="mt-1 flex h-3 items-center text-[10px]"
                    aria-hidden="true"
                  >
                    {isToday ? "Today" : count ? <Check size={12} /> : null}
                  </span>
                </button>
              );
            },
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Check size={13} className="rounded bg-teal-700 text-white" />{" "}
            Completed practice
          </span>
          <span>Today label = current day · Ring = selected day</span>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          This calendar uses completed Today sessions and their saved practice
          dates. Drafts and standalone Practice, Exercises, and Review
          activities are not included.
        </p>
      </section>
      <section
        className="panel space-y-4"
        aria-label="Selected day’s progress"
        aria-live="polite"
      >
        <div>
          <p className="eyebrow">
            {selected === today ? "Today’s progress" : "Your saved progress"}
          </p>
          <h3 className="mt-2 font-serif text-2xl">{dateLabel(selected)}</h3>
        </div>
        {!selectedRecords.length ? (
          <div className="rounded-xl bg-slate-50 p-5">
            <CalendarDays size={24} className="text-slate-400" />
            <p className="mt-3 text-sm text-slate-600">
              No completed daily sessions on this day.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              A short session is a good next step whenever you have time.
            </p>
            <button className="secondary-button mt-4" onClick={onPractice}>
              Practise today
            </button>
          </div>
        ) : (
          selectedRecords.map((record) => (
            <article
              key={record.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <h4 className="font-semibold text-slate-900">{record.title}</h4>
              <p className="mt-1 text-xs text-slate-500">
                {FOCUS_LABELS[record.focus]} · {record.reviewed} cards reviewed
                · Writing {record.writingLevel}
              </p>
              {record.feedback.improvement && (
                <p className="mt-3 rounded-lg bg-teal-50 p-3 text-sm leading-relaxed text-teal-900">
                  {record.feedback.improvement}
                </p>
              )}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium text-teal-800">
                  Revisit this session
                </summary>
                <div className="mt-3 space-y-3">
                  <p className="text-slate-600">{record.prompt}</p>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      Your first attempt
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                      {record.original}
                    </p>
                  </div>
                  {record.revision && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        Your revision
                      </p>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                        {record.revision}
                      </p>
                    </div>
                  )}
                  {record.feedback.next_step && (
                    <p className="rounded-lg bg-amber-50 p-3 text-amber-950">
                      Next step: {record.feedback.next_step}
                    </p>
                  )}
                </div>
              </details>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
