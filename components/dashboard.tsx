"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CalendarDays,
  Repeat,
  Target,
  BookOpen,
} from "lucide-react";
import { calendarRecords } from "@/lib/calendar";
import { FOCUS_LABELS, localDate, weeklyDays } from "@/lib/learning";
import { isDue } from "@/lib/sr";
import type {
  BankItem,
  DailySession,
  LearnerProfile,
  LearningRecord,
} from "@/lib/types";

type Destination = "today" | "calendar" | "review" | "bank" | "profile";
const labelDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
export function Dashboard({
  records,
  session,
  profile,
  bank,
  onNavigate,
}: {
  records: LearningRecord[];
  session: DailySession | null;
  profile: LearnerProfile;
  bank: BankItem[];
  onNavigate: (destination: Destination) => void;
}) {
  const [range, setRange] = useState<7 | 30>(30);
  const today = localDate();
  const days = calendarRecords(records, today);
  const all = [...days.values()]
    .flat()
    .sort((a, b) => b.date.localeCompare(a.date));
  const dates = Array.from({ length: range }, (_, index) => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - range + index + 1);
    return localDate(date);
  });
  const recent = all.filter((record) => record.date >= dates[0]);
  const activeDays = new Set(recent.map((record) => record.date)).size;
  const week = weeklyDays(all);
  const due = bank.filter(isDue).length;
  const unfinished = session && session.stage !== "complete";
  const doneToday = days.has(today);
  const focus = Object.entries(FOCUS_LABELS)
    .map(([key, label]) => ({
      label,
      count: recent.filter((record) => record.focus === key).length,
    }))
    .sort((a, b) => b.count - a.count);
  const latest = all[0];
  const action = !profile.configured
    ? "Set up my learning"
    : unfinished
      ? "Resume my session"
      : doneToday
        ? "Revisit today’s session"
        : "Start today’s session";
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-teal-950 text-white">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr] lg:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">
              Your learning dashboard
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">
              Small steps.
              <br />
              Visible progress.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-teal-100">
              {unfinished
                ? "Your session is waiting right where you left it."
                : doneToday
                  ? "You showed up today. Take a moment to see what you learned."
                  : "Make a little room for English today. Your next step is ready."}
            </p>
            <button
              className="mt-6 inline-flex items-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-teal-950 hover:bg-teal-50"
              onClick={() =>
                onNavigate(profile.configured ? "today" : "profile")
              }
            >
              {action}
              <ArrowRight size={17} />
            </button>
            <p className="mt-3 text-xs text-teal-200">
              {profile.minutes}-minute session · At your pace
            </p>
          </div>
          <div className="rounded-2xl border border-teal-700 bg-teal-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-teal-100">This week’s rhythm</span>
              <Target size={19} className="text-teal-200" />
            </div>
            <p className="mt-4">
              <strong className="text-4xl font-semibold">{week}</strong>
              <span className="ml-2 text-sm text-teal-100">
                / {profile.weeklyGoal} practice days
              </span>
            </p>
            <div
              className="mt-5 h-2 overflow-hidden rounded-full bg-teal-800"
              role="progressbar"
              aria-label="Weekly practice goal"
              aria-valuenow={Math.min(week, profile.weeklyGoal)}
              aria-valuemin={0}
              aria-valuemax={profile.weeklyGoal}
            >
              <div
                className="h-full rounded-full bg-teal-300"
                style={{
                  width: `${Math.min(100, (week / profile.weeklyGoal) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-4 text-sm text-teal-100">
              {week >= profile.weeklyGoal
                ? "Goal reached. Every extra day is a bonus."
                : `${profile.weeklyGoal - week} more ${profile.weeklyGoal - week === 1 ? "day" : "days"} to your weekly goal.`}
            </p>
            <button
              onClick={() => onNavigate("profile")}
              className="mt-4 text-xs text-teal-200 underline underline-offset-4"
            >
              Adjust my goal
            </button>
          </div>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl">Your progress, at a glance</h3>
          <p className="mt-1 text-xs text-slate-500">
            Completed Today sessions · Last {range} days
          </p>
        </div>
        <div
          className="flex rounded-xl border border-slate-200 bg-white p-1"
          aria-label="Progress period"
        >
          {([7, 30] as const).map((value) => (
            <button
              key={value}
              aria-pressed={range === value}
              onClick={() => setRange(value)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${range === value ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {value} days
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [activeDays, "Practice days", "Days you completed a session"],
          [recent.length, "Sessions completed", "Finished, saved, and yours"],
          [
            recent.filter(
              (record) =>
                record.revision.trim() &&
                record.revision.trim() !== record.original.trim(),
            ).length,
            "Responses revised",
            "Times you reworked your writing",
          ],
          [
            recent.filter((record) => record.mission?.mode === "independent")
              .length,
            "No-hints challenges",
            "Independent attempts completed",
          ],
        ].map(([value, label, caption]) => (
          <section
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
          >
            <p className="text-3xl font-semibold tracking-tight text-teal-900">
              {value}
            </p>
            <h4 className="mt-2 text-sm font-semibold">{label}</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">{caption}</p>
          </section>
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="panel">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif text-xl">Showing up adds up</h3>
              <CalendarDays size={19} className="text-teal-700" />
            </div>
            <div
              className="mt-5 grid grid-cols-7 gap-2 sm:grid-cols-10"
              aria-label={`Activity over the last ${range} days`}
            >
              {dates.map((date) => (
                <div
                  key={date}
                  title={`${labelDate(date)}: ${days.get(date)?.length ?? 0} completed sessions`}
                  aria-label={`${labelDate(date)}: ${days.get(date)?.length ?? 0} completed sessions`}
                  className={`flex aspect-square items-center justify-center rounded-lg text-xs ${days.has(date) ? "bg-teal-700 font-semibold text-white" : "bg-slate-100 text-slate-500"} ${date === today ? "ring-2 ring-teal-700 ring-offset-2" : ""}`}
                >
                  {days.has(date) ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    Number(date.slice(-2))
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-xs text-slate-500">
              <span>{labelDate(dates[0])}</span>
              <span>Today · {labelDate(today)}</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Check = completed · Outline = today. Rest days are part of the
              rhythm.
            </p>
            <button
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-800"
              onClick={() => onNavigate("calendar")}
            >
              Open calendar & session details
              <ArrowRight size={16} />
            </button>
          </section>
          <section className="panel">
            <p className="eyebrow">Evidence of your work</p>
            <h3 className="mt-2 font-serif text-xl">
              {latest
                ? "Your latest writing"
                : "Your first improvement starts here"}
            </h3>
            {latest ? (
              <>
                <p className="mt-2 text-xs text-slate-500">
                  {latest.title} · {labelDate(latest.date)}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">
                      First attempt
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                      {latest.original}
                    </p>
                  </div>
                  <div className="rounded-xl bg-teal-50 p-4">
                    <p className="text-xs font-semibold text-teal-800">
                      {latest.revision ? "Your revision" : "Coach’s next step"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-teal-950">
                      {latest.revision ||
                        latest.feedback.next_step ||
                        "Complete another session to keep building on this response."}
                    </p>
                  </div>
                </div>
                {latest.feedback.improvement && (
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {latest.feedback.improvement}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Finish a Today session to see your own writing and feedback
                here. Your dashboard will grow with your practice.
              </p>
            )}
          </section>
        </div>
        <div className="space-y-6">
          <section className="panel">
            <div className="flex items-center gap-2">
              <Repeat size={18} className="text-teal-700" />
              <h3 className="font-serif text-xl">Keep it fresh</h3>
            </div>
            <p className="mt-4 text-3xl font-semibold">
              {due}
              <span className="ml-2 text-sm font-normal text-slate-500">
                expressions due
              </span>
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {bank.length} expressions in your bank. Revisit them, then use
              them in your own words.
            </p>
            <button
              className="secondary-button mt-4 w-full"
              onClick={() => onNavigate(due ? "review" : "bank")}
            >
              {due ? "Review expressions" : "Explore my bank"}
              <ArrowRight size={16} />
            </button>
          </section>
          <section className="panel">
            <h3 className="font-serif text-xl">What you’re practising</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Session focus over {range} days. These counts show practice, not
              proficiency.
            </p>
            <div className="mt-5 space-y-4">
              {recent.length ? (
                focus
                  .filter((item) => item.count)
                  .map((item) => (
                    <div key={item.label}>
                      <div className="mb-2 flex justify-between text-xs">
                        <span>{item.label}</span>
                        <span className="font-semibold">
                          {item.count}{" "}
                          {item.count === 1 ? "session" : "sessions"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-teal-600"
                          style={{
                            width: `${(item.count / recent.length) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-slate-500">
                  Your focus areas will appear after your first completed
                  session.
                </p>
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
            <BookOpen size={20} className="text-indigo-700" />
            <h3 className="mt-3 font-serif text-xl">Your learning direction</h3>
            <p className="mt-3 text-sm text-indigo-950">
              Reading {profile.levels.reading} · Writing{" "}
              {profile.levels.writing}
            </p>
            <p className="mt-2 text-sm font-semibold text-indigo-900">
              Working towards {profile.target}
            </p>
            <p className="mt-2 text-xs leading-5 text-indigo-700">
              Levels from your profile, not a proficiency assessment.
            </p>
            <button
              onClick={() => onNavigate("profile")}
              className="mt-4 text-sm font-semibold text-indigo-800 underline underline-offset-4"
            >
              Update my profile
            </button>
          </section>
        </div>
      </div>
      <p className="text-xs leading-5 text-slate-500">
        Activity and writing totals count completed Today sessions. Standalone
        Practice, Exercises, and Review activities are not included. Your
        expression bank reflects all saved expressions.
      </p>
    </div>
  );
}
