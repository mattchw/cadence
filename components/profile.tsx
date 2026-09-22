"use client";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { LEVELS } from "@/lib/constants";
import { GOALS, normaliseProfile } from "@/lib/learning";
import type { CEFRLevel, LearnerProfile, SessionMinutes } from "@/lib/types";

const INTERESTS = [
  "Culture",
  "Technology",
  "Travel",
  "Food",
  "Science",
  "Films & books",
  "Work",
  "Sport",
];
export function Profile({
  profile,
  onSave,
}: {
  profile: LearnerProfile;
  onSave: (value: LearnerProfile) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(profile));
  const [custom, setCustom] = useState("");
  const toggle = (interest: string) =>
    setDraft((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((item) => item !== interest)
        : [...prev.interests, interest].slice(0, 6),
    }));
  const add = () => {
    const interest = custom.trim();
    if (
      interest &&
      !draft.interests.includes(interest) &&
      draft.interests.length < 6
    ) {
      toggle(interest);
      setCustom("");
    }
  };
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(normaliseProfile({ ...draft, configured: true }));
      }}
    >
      <div>
        <p className="eyebrow">Make it yours</p>
        <h2 className="mt-2 font-serif text-3xl text-slate-900">
          English that fits your life.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Start with your own estimates. You can change these whenever you like.
        </p>
      </div>
      <section className="panel space-y-5">
        <div>
          <h3 className="font-semibold">Your starting point</h3>
          <p className="mt-1 text-sm text-slate-500">
            Different skills can be at different levels.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {(["reading", "writing", "listening", "speaking"] as const).map(
            (skill) => (
              <label key={skill} className="text-sm font-medium capitalize">
                {skill}
                <select
                  className="text-input mt-2"
                  value={draft.levels[skill]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      levels: {
                        ...draft.levels,
                        [skill]: e.target.value as CEFRLevel,
                      },
                    })
                  }
                >
                  {LEVELS.map((level) => (
                    <option key={level.id}>{level.id}</option>
                  ))}
                </select>
              </label>
            ),
          )}
        </div>
        <label className="block text-sm font-medium">
          Level you want to work towards
          <select
            className="text-input mt-2"
            value={draft.target}
            onChange={(e) =>
              setDraft({ ...draft, target: e.target.value as CEFRLevel })
            }
          >
            {LEVELS.map((level) => (
              <option key={level.id}>{level.id}</option>
            ))}
          </select>
        </label>
        <p className="text-xs leading-relaxed text-slate-500">
          Today uses your reading and writing levels. Speaking and listening
          estimates are saved for future audio practice. Changes apply to your
          next daily session; an open session keeps its original settings.
        </p>
      </section>
      <fieldset className="panel">
        <legend className="sr-only">Your goal</legend>
        <h3 className="mb-3 font-semibold">
          What would you like English to help you do?
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(GOALS).map(([goal, label]) => (
            <label
              key={goal}
              className={`cursor-pointer rounded-xl border p-3 text-sm ${draft.goal === goal ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200 text-slate-600"}`}
            >
              <input
                className="mr-2 accent-teal-700"
                type="radio"
                name="goal"
                value={goal}
                checked={draft.goal === goal}
                onChange={() =>
                  setDraft({ ...draft, goal: goal as LearnerProfile["goal"] })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <section className="panel">
        <h3 className="font-semibold">Follow your curiosity</h3>
        <p className="mt-1 text-sm text-slate-500">
          Choose up to six topics for your daily challenges.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...new Set([...INTERESTS, ...draft.interests])].map((interest) => (
            <button
              type="button"
              aria-pressed={draft.interests.includes(interest)}
              key={interest}
              disabled={
                !draft.interests.includes(interest) &&
                draft.interests.length >= 6
              }
              onClick={() => toggle(interest)}
              className={`rounded-full border px-3 py-2 text-sm disabled:opacity-40 ${draft.interests.includes(interest) ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200 text-slate-600"}`}
            >
              {interest}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            aria-label="Add your own interest"
            className="text-input min-w-0"
            placeholder="Or add your own topic"
            maxLength={60}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button
            type="button"
            aria-label="Add interest"
            className="secondary-button"
            disabled={!custom.trim() || draft.interests.length >= 6}
            onClick={add}
          >
            <Plus size={18} />
          </button>
        </div>
      </section>
      <section className="panel">
        <h3 className="font-semibold">Find your rhythm</h3>
        <p className="mt-1 text-sm text-slate-500">
          A starting plan. You can pick a shorter session on busy days.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Usual session
            <select
              className="text-input mt-2"
              value={draft.minutes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  minutes: Number(e.target.value) as SessionMinutes,
                })
              }
            >
              <option value={3}>3 minutes · a little every day</option>
              <option value={10}>10 minutes · room to practise</option>
              <option value={20}>20 minutes · a deeper dive</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Weekly goal
            <select
              className="text-input mt-2"
              value={draft.weeklyGoal}
              onChange={(e) =>
                setDraft({ ...draft, weeklyGoal: Number(e.target.value) })
              }
            >
              {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                <option key={days} value={days}>
                  {days} {days === 1 ? "day" : "days"} a week
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-slate-500">
          Your existing phrase bank stays with you.
        </span>
        <button
          className="primary-button"
          type="submit"
          disabled={!draft.interests.length}
        >
          <Check size={16} /> Save my profile
        </button>
      </div>
    </form>
  );
}
