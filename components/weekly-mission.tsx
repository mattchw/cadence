"use client";
import { Check, Flag } from "lucide-react";
import { completedChapters, MISSION_CHAPTERS } from "@/lib/missions";
import type { LearningRecord, WeeklyMission } from "@/lib/types";

export function MissionBoard({
  mission,
  records,
}: {
  mission: WeeklyMission;
  records: LearningRecord[];
}) {
  const completed = completedChapters(records, mission.weekStart);
  const finalDone = completed.has(4);
  const next = MISSION_CHAPTERS[mission.episode + 1];
  return (
    <section
      className="overflow-hidden rounded-2xl border border-indigo-200 bg-white"
      aria-label="Weekly story mission"
    >
      <div className="bg-indigo-50 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-700">
            Weekly story · {mission.weekStart}
          </p>
          <span className="text-xs font-medium text-indigo-800">
            {completed.size} / 5 chapters completed
          </span>
        </div>
        <h3 className="mt-3 font-serif text-2xl text-indigo-950">
          {mission.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-indigo-900">
          {mission.setting}
        </p>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <ol className="grid gap-2 sm:grid-cols-5" aria-label="Mission chapters">
          {MISSION_CHAPTERS.map((chapter, index) => (
            <li
              key={chapter.day}
              aria-current={index === mission.episode ? "step" : undefined}
              className={`rounded-lg border p-3 ${completed.has(index) ? "border-teal-200 bg-teal-50" : index === mission.episode ? "border-indigo-400 bg-indigo-50" : "border-slate-200"}`}
            >
              <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                {completed.has(index) && (
                  <Check size={13} className="text-teal-700" />
                )}
                {chapter.day}
              </p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-800">
                {chapter.title}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {completed.has(index)
                  ? "Completed"
                  : index < mission.episode
                    ? "Not completed"
                    : index === mission.episode
                      ? "Current chapter"
                      : "Coming up"}
              </p>
            </li>
          ))}
        </ol>
        {finalDone ? (
          <div className="flex items-start gap-2 rounded-xl bg-teal-50 p-4 text-sm leading-relaxed text-teal-950">
            <Flag size={18} className="mt-0.5 shrink-0" />
            <p>
              {completed.size === 5
                ? "Mission complete. You practised every chapter and took on the final challenge."
                : "Final challenge complete. Every chapter you made time for counts."}{" "}
              Your response and feedback are saved in your history. More
              practice this weekend is optional.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              <span className="font-semibold">This chapter: </span>
              {mission.chapterTitle}
              {mission.mode === "independent" && " · no hints"}
            </p>
            {next && (
              <p className="text-sm text-indigo-800">
                <span className="font-semibold">Next chapter: </span>
                {next.title}
                {mission.episode === 3
                  ? ". Try a new situation without hints from Friday."
                  : ". The story continues with your earlier responses."}
              </p>
            )}
          </>
        )}
        <p className="text-xs leading-relaxed text-slate-500">
          Join on any day. Missed chapters are not marked complete, and there is
          no catch-up requirement. Friday’s challenge stays available through
          Sunday. Unfinished sessions keep their original chapter.
        </p>
      </div>
    </section>
  );
}
