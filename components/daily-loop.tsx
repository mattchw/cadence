"use client";
import { ArrowRight, CheckCircle2, RotateCcw, Sprout } from "lucide-react";
import { FOCUS_LABELS } from "@/lib/learning";
import { loopProgress } from "@/lib/daily-loop";
import type {
  DailySession,
  ExpressionCheck,
  LearningRecord,
  RecallChallenge,
  ReuseTarget,
} from "@/lib/types";

export function RecallPanel({
  challenge,
  onChange,
  onContinue,
}: {
  challenge: RecallChallenge;
  onChange: (challenge: RecallChallenge) => void;
  onContinue: (outcome: NonNullable<RecallChallenge["outcome"]>) => void;
}) {
  return (
    <section className="panel space-y-5">
      <div>
        <p className="eyebrow">From your own English</p>
        <h3 className="mt-2 font-serif text-2xl">Can you bring it back?</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          A correction from {challenge.sourceDate}. Try it from memory before
          comparing. Different wording can work too.
        </p>
      </div>
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-500">Earlier task</p>
        <p className="mt-1 text-sm text-slate-600">{challenge.context}</p>
        <p className="mt-4 text-xs font-semibold text-slate-500">
          Your earlier wording · {FOCUS_LABELS[challenge.focus]}
        </p>
        <blockquote className="mt-2 font-serif text-xl">
          {challenge.original}
        </blockquote>
      </div>
      <label className="block text-sm font-semibold" htmlFor="personal-recall">
        How would you change it now?
      </label>
      <textarea
        id="personal-recall"
        className="text-input min-h-24"
        maxLength={2000}
        value={challenge.attempt}
        readOnly={challenge.revealed}
        placeholder="Try a short rewrite…"
        onChange={(event) =>
          onChange({ ...challenge, attempt: event.target.value })
        }
      />
      {!challenge.revealed ? (
        <div className="flex flex-wrap items-center gap-4">
          <button
            className="secondary-button"
            disabled={!challenge.attempt.trim()}
            onClick={() => onChange({ ...challenge, revealed: true })}
          >
            Compare with the earlier feedback
          </button>
          <button
            className="text-sm text-slate-500 underline underline-offset-4"
            onClick={() => onChange({ ...challenge, revealed: true })}
          >
            I don’t remember yet
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-teal-50 p-4">
            <p className="text-xs font-semibold text-teal-800">
              The earlier suggestion
            </p>
            <p className="mt-2 font-serif text-xl text-teal-950">
              {challenge.suggestion}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-teal-900">
              {challenge.reason}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Did you recall the idea before revealing it? This is your own
            assessment, not an automatic grade.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className="primary-button"
              disabled={!challenge.attempt.trim()}
              onClick={() => onContinue("remembered")}
            >
              <CheckCircle2 size={16} /> Recalled it
            </button>
            <button
              className="secondary-button"
              onClick={() => onContinue("again")}
            >
              <RotateCcw size={16} /> Needs another try
            </button>
          </div>
        </>
      )}
      <button
        className="text-xs text-slate-500 underline underline-offset-4"
        onClick={() => onContinue("skipped")}
      >
        Skip this recall today
      </button>
    </section>
  );
}

export function ReusePrompt({ targets }: { targets: ReuseTarget[] }) {
  if (!targets.length) return null;
  return (
    <aside className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <p className="text-sm font-semibold text-indigo-950">
        Put your saved expressions to work
      </p>
      <p className="mt-1 text-sm leading-relaxed text-indigo-900">
        Try {targets.length === 1 ? "this expression" : "these expressions"} in
        your response. Keep your meaning first; leave one out if it does not
        fit.
      </p>
      <ul className="mt-3 space-y-3">
        {targets.map((target) => (
          <li key={target.id}>
            <p className="font-semibold text-indigo-950">{target.phrase}</p>
            <p className="text-xs leading-relaxed text-indigo-800">
              {target.meaning}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-indigo-800">
        The coach will check how you use them, not just whether they appear.
      </p>
    </aside>
  );
}

export function ExpressionResults({
  checks = [],
}: {
  checks?: ExpressionCheck[];
}) {
  if (!checks.length) return null;
  return (
    <section className="space-y-3" aria-label="Expression practice results">
      <h4 className="text-sm font-semibold">Your expressions in action</h4>
      {checks.map((check) => (
        <div
          key={check.id}
          className={`rounded-xl border p-4 ${check.status === "used" ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-slate-50"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{check.phrase}</p>
            <span className="text-xs text-slate-600">
              {check.status === "used"
                ? check.source === "draft"
                  ? "Used in your first draft"
                  : "Used after a hint"
                : check.status === "variation"
                  ? "Related phrasing"
                  : check.status === "retry"
                    ? "Try a different use"
                    : "Not used this time"}
            </span>
          </div>
          {check.evidence && (
            <blockquote className="mt-2 border-l-2 border-teal-300 pl-3 text-sm leading-relaxed">
              {check.evidence}
            </blockquote>
          )}
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {check.note}
          </p>
        </div>
      ))}
      <p className="text-xs text-slate-500">
        AI feedback on a prompted exercise. First-draft use is not a test of
        unaided recall.
      </p>
    </section>
  );
}

export function ProgressPulse({ records }: { records: LearningRecord[] }) {
  const progress = loopProgress(records);
  if (!progress.recalled && !progress.phrases) return null;
  return (
    <section
      className="grid gap-3 sm:grid-cols-2"
      aria-label="Skills you are putting into practice"
    >
      <div className="rounded-xl border border-teal-200 bg-white p-4">
        <p className="text-2xl font-semibold text-teal-800">
          {progress.recalled}
        </p>
        <p className="mt-1 text-sm font-medium">
          Weak-spot recalls after a break
        </p>
        <p className="mt-1 text-xs text-slate-500">
          You marked these as recalled before seeing the answer.
        </p>
      </div>
      <div className="rounded-xl border border-indigo-200 bg-white p-4">
        <p className="text-2xl font-semibold text-indigo-800">
          {progress.phrases}
        </p>
        <p className="mt-1 text-sm font-medium">
          Expressions used in a first draft
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Different saved expressions, prompted and checked by the coach.
        </p>
      </div>
    </section>
  );
}

export function RecallResult({ recall }: { recall?: RecallChallenge | null }) {
  if (!recall?.outcome) return null;
  return (
    <details className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <summary className="cursor-pointer text-sm font-medium text-amber-950">
        Earlier correction ·{" "}
        {recall.outcome === "remembered"
          ? "recalled, self-assessed"
          : recall.outcome === "again"
            ? "needs another try"
            : "skipped"}
      </summary>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-amber-950">
        <p>
          <span className="font-semibold">Earlier wording: </span>
          {recall.original}
        </p>
        {recall.attempt && (
          <p>
            <span className="font-semibold">Your recall attempt: </span>
            {recall.attempt}
          </p>
        )}
        <p>
          <span className="font-semibold">Earlier suggestion: </span>
          {recall.suggestion}
        </p>
        <p>{recall.reason}</p>
      </div>
    </details>
  );
}

export function LearningWin({ session }: { session: DailySession }) {
  const writing = session.writing;
  const revised =
    !!writing.hint &&
    !!writing.revision.trim() &&
    writing.revision.trim() !== writing.draft.trim();
  return (
    <section className="panel space-y-5" aria-label="What you practised today">
      <div className="flex items-center gap-3">
        <Sprout size={24} className="text-teal-700" />
        <div>
          <p className="eyebrow">Evidence you can revisit</p>
          <h3 className="mt-1 font-serif text-2xl">
            A small step you can see.
          </h3>
        </div>
      </div>
      {session.recall?.outcome && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          {session.recall.outcome === "remembered"
            ? "You recalled an earlier correction before comparing. We’ll space out its next review."
            : session.recall.outcome === "again"
              ? "You gave an earlier correction another try. It can return in a future session."
              : "You left the recall for another day. Your practice still counts."}
        </p>
      )}
      {revised ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">
                Your first attempt
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {writing.draft}
              </p>
            </div>
            <div className="rounded-xl bg-teal-50 p-4">
              <p className="text-xs font-semibold text-teal-800">
                Your revision · after a hint
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {writing.revision}
              </p>
            </div>
          </div>
          {writing.feedback?.improvement && (
            <div>
              <p className="text-xs font-semibold text-slate-500">
                What the coach noticed
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {writing.feedback.improvement}
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm leading-relaxed text-slate-600">
          {writing.feedback?.verdict} Your response is saved in your history.
        </p>
      )}
      <ExpressionResults checks={writing.feedback?.expressionChecks} />
      <RecallResult recall={session.recall} />
      {writing.feedback?.next_step && (
        <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
          <ArrowRight size={16} className="mt-1 shrink-0 text-teal-700" />
          <p>
            <span className="font-semibold">Take this into tomorrow: </span>
            {writing.feedback.next_step}
          </p>
        </div>
      )}
    </section>
  );
}
