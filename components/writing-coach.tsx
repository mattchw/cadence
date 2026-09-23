"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { getCoachingHint, getFeedback } from "@/lib/ai";
import { upgradeKey } from "@/lib/learning";
import { typeClass } from "@/lib/constants";
import { ExpressionResults } from "@/components/daily-loop";
import type {
  BankItem,
  Feedback,
  LearnerProfile,
  UpgradeSuggestion,
  WritingState,
  ReuseTarget,
} from "@/lib/types";

export function FeedbackView({
  feedback,
  bank = [],
  onSave,
}: {
  feedback: Feedback;
  bank?: BankItem[];
  onSave?: (items: UpgradeSuggestion[]) => void;
}) {
  const saved = new Set(bank.map(upgradeKey));
  const suggestions = feedback.upgrades ?? [];
  const unsaved = suggestions.filter((item) => !saved.has(upgradeKey(item)));
  return (
    <div className="space-y-5" aria-live="polite">
      <div>
        <p className="eyebrow">Your feedback</p>
        <p className="mt-2 text-lg font-medium text-slate-900">
          {feedback.verdict}
        </p>
      </div>
      {feedback.improvement && (
        <p className="rounded-xl bg-teal-50 p-4 text-sm leading-relaxed text-teal-900">
          {feedback.improvement}
        </p>
      )}
      {feedback.qualities && (
        <dl className="grid gap-3 sm:grid-cols-2">
          {Object.entries(feedback.qualities).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-slate-200 p-3">
              <dt className="text-xs font-semibold capitalize text-slate-800">
                {key}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {feedback.rewrite && (
        <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">
            Explore one possible version
          </summary>
          <p className="mt-3 whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-800">
            {feedback.rewrite}
          </p>
        </details>
      )}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              Expressions to take with you
            </h3>
            {onSave && (
              <button
                className="text-xs font-semibold text-teal-700 disabled:text-slate-400"
                disabled={!unsaved.length}
                onClick={() => onSave(unsaved)}
              >
                {unsaved.length ? "Save all to bank" : "All saved"}
              </button>
            )}
          </div>
          {suggestions.map((item, index) => (
            <div
              key={`${upgradeKey(item)}-${index}`}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="mb-2 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${typeClass(item.type)}`}
                >
                  {item.type}
                </span>
                <span className="text-xs text-slate-500">
                  {item.category === "correction"
                    ? "Correction"
                    : "Optional alternative"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-600">{item.original}</span>
                <ArrowRight aria-hidden size={14} />
                <span className="font-semibold text-slate-900">
                  {item.native}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.why}
              </p>
              {onSave && (
                <button
                  className="mt-3 flex items-center gap-1 text-xs font-semibold text-teal-700 disabled:text-slate-500"
                  disabled={saved.has(upgradeKey(item))}
                  onClick={() => onSave([item])}
                >
                  {saved.has(upgradeKey(item)) ? (
                    <>
                      <Check size={14} /> Saved
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Save expression
                    </>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {(feedback.next_step || feedback.native_move) && (
        <div className="rounded-xl bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-900">
            Try this next time
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900">
            {feedback.next_step || feedback.native_move}
          </p>
        </div>
      )}
      <ExpressionResults checks={feedback.expressionChecks} />
    </div>
  );
}

interface Props {
  task: string;
  context?: string;
  focus: string;
  profile: LearnerProfile;
  value: WritingState;
  onChange: (next: WritingState) => void;
  bank: BankItem[];
  onSave: (items: UpgradeSuggestion[]) => void;
  onFeedback?: () => void;
  locked?: boolean;
  independent?: boolean;
  reuseTargets?: ReuseTarget[];
}
export function WritingCoach({
  task,
  context,
  focus,
  profile,
  value,
  onChange,
  bank,
  onSave,
  onFeedback,
  locked = false,
  independent = false,
  reuseTargets = [],
}: Props) {
  const hintValue = independent ? null : value.hint;
  const [busy, setBusy] = useState<"hint" | "feedback" | null>(null);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const taskContext = context
    ? `${task}\n\nReading material:\n${context}`
    : task;
  const hint = async () => {
    if (independent || locked) return;
    setBusy("hint");
    setError("");
    try {
      const result = await getCoachingHint(
        focus,
        taskContext,
        value.draft,
        profile,
      );
      if (mounted.current)
        onChange({
          ...value,
          hint: result,
          revision: value.draft,
          feedback: null,
        });
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Could not get a hint. Try again.",
        );
    } finally {
      if (mounted.current) setBusy(null);
    }
  };
  const feedback = async () => {
    if (locked) return;
    setBusy("feedback");
    setError("");
    try {
      const result = await getFeedback(
        focus,
        taskContext,
        hintValue ? value.revision : value.draft,
        focus === "listening",
        profile,
        hintValue ? value.draft : undefined,
        independent ? [] : reuseTargets,
        independent,
      );
      if (mounted.current) {
        onChange({
          ...value,
          hint: hintValue,
          revision: independent ? "" : value.revision,
          feedback: result,
        });
        onFeedback?.();
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Could not get feedback. Try again.",
        );
    } finally {
      if (mounted.current) setBusy(null);
    }
  };
  return (
    <div className="space-y-5">
      {independent && (
        <p className="rounded-xl bg-indigo-50 p-4 text-sm leading-relaxed text-indigo-950">
          No-hints challenge: write your first response on your own. Feedback
          and a possible rewrite appear only after you submit. This is practice,
          not a proficiency exam.
        </p>
      )}
      {!hintValue && !value.feedback && (
        <>
          <label
            className="block text-sm font-semibold text-slate-800"
            htmlFor="writing-draft"
          >
            Your response
          </label>
          <textarea
            id="writing-draft"
            className="text-input min-h-40"
            placeholder="Start with what you want to say…"
            maxLength={8000}
            value={value.draft}
            readOnly={locked || !!busy}
            onChange={(e) => onChange({ ...value, draft: e.target.value })}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {value.draft.trim() ? value.draft.trim().split(/\s+/).length : 0}{" "}
              words · your voice matters
            </span>
            <button
              className="primary-button"
              disabled={locked || !!busy || !value.draft.trim()}
              onClick={independent ? feedback : hint}
            >
              {busy ? (
                <Loader2 className="animate-spin" size={16} />
              ) : independent ? (
                <ArrowRight size={16} />
              ) : (
                <Lightbulb size={16} />
              )}{" "}
              {independent ? "Submit without hints" : "Help me improve it"}
            </button>
          </div>
          {!independent && (
            <button
              className="text-sm text-slate-500 underline underline-offset-4 disabled:opacity-40"
              disabled={locked || !!busy || !value.draft.trim()}
              onClick={feedback}
            >
              Get feedback directly
            </button>
          )}
        </>
      )}
      {hintValue && !value.feedback && (
        <>
          <div className="rounded-xl bg-teal-50 p-4">
            <p className="text-xs font-semibold text-teal-800">
              What already works
            </p>
            <p className="mt-1 text-sm leading-relaxed text-teal-900">
              {hintValue.strength}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-900">
              {hintValue.category === "correction"
                ? "One thing to adjust"
                : "An optional experiment"}
            </p>
            {hintValue.excerpt && (
              <blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-sm text-amber-900">
                “{hintValue.excerpt}”
              </blockquote>
            )}
            <p className="mt-3 text-sm leading-relaxed text-amber-900">
              {hintValue.hint}
            </p>
          </div>
          <details className="text-sm text-slate-600">
            <summary className="cursor-pointer">Your first attempt</summary>
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3">
              {value.draft}
            </p>
          </details>
          <label
            className="block text-sm font-semibold text-slate-800"
            htmlFor="writing-revision"
          >
            Try it your way
          </label>
          <textarea
            id="writing-revision"
            className="text-input min-h-40"
            maxLength={8000}
            value={value.revision}
            readOnly={!!busy}
            onChange={(e) => onChange({ ...value, revision: e.target.value })}
          />
          <p className="text-xs text-slate-500">
            You can keep your original wording if it already expresses your
            intention.
          </p>
          <button
            className="primary-button"
            disabled={!!busy || !value.revision.trim()}
            onClick={feedback}
          >
            {busy ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}{" "}
            Review my revision
          </button>
        </>
      )}
      {error && (
        <p
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
          role="alert"
        >
          {error}
        </p>
      )}
      {busy === "feedback" && !hintValue && (
        <p
          className="flex items-center gap-2 text-sm text-slate-500"
          role="status"
        >
          <Loader2 size={16} className="animate-spin" /> Reading your response…
        </p>
      )}
      {value.feedback && (
        <>
          <details className="text-sm text-slate-600">
            <summary className="cursor-pointer">
              Your {hintValue ? "two attempts" : "response"}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold">First attempt</p>
                <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3">
                  {value.draft}
                </p>
              </div>
              {hintValue && (
                <div>
                  <p className="mb-1 text-xs font-semibold">Revision</p>
                  <p className="whitespace-pre-wrap rounded-lg bg-teal-50 p-3">
                    {value.revision}
                  </p>
                </div>
              )}
            </div>
          </details>
          <FeedbackView feedback={value.feedback} bank={bank} onSave={onSave} />
        </>
      )}
    </div>
  );
}
