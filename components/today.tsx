"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  Sparkles,
} from "lucide-react";
import { generateDailyLesson } from "@/lib/ai";
import {
  createSession,
  FOCUS_LABELS,
  localDate,
  suggestedSupport,
  weeklyDays,
} from "@/lib/learning";
import { FeedbackView, WritingCoach } from "@/components/writing-coach";
import { selectRecall } from "@/lib/daily-loop";
import {
  RecallPanel,
  ReusePrompt,
  LearningWin,
  ProgressPulse,
  RecallResult,
} from "@/components/daily-loop";
import type {
  BankItem,
  DailySession,
  Difficulty,
  Grade,
  LearnerProfile,
  LearningRecord,
  SessionMinutes,
  Support,
  UpgradeSuggestion,
} from "@/lib/types";

interface Props {
  profile: LearnerProfile;
  session: DailySession | null;
  records: LearningRecord[];
  bank: BankItem[];
  onStart: (session: DailySession) => void;
  onPatch: (id: string, patch: Partial<DailySession>) => void;
  onGrade: (id: string, grade: Grade) => void;
  onSave: (items: UpgradeSuggestion[], focus: string) => void;
  onFinish: (session: DailySession) => void;
  onProfile: () => void;
  onPractice: () => void;
}

export function Today({
  profile,
  session,
  records,
  bank,
  onStart,
  onPatch,
  onGrade,
  onSave,
  onFinish,
  onProfile,
  onPractice,
}: Props) {
  const [minutes, setMinutes] = useState<SessionMinutes>(profile.minutes);
  const [support, setSupport] = useState<Support>(() =>
    suggestedSupport(records, profile),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const today = localDate();
  const active =
    session && (session.stage !== "complete" || session.date === today)
      ? session
      : null;
  const days = weeklyDays(records);
  const nextRecall = !active ? selectRecall(records, today) : null;
  const generate = async (current: DailySession) => {
    setBusy(true);
    setError("");
    try {
      const lesson = await generateDailyLesson(current);
      onPatch(current.id, { lesson });
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not prepare the challenge. Please try again.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const start = () => {
    const next = createSession(profile, minutes, bank, records, support);
    onStart(next);
    void generate(next);
  };
  const patch = (value: Partial<DailySession>) => {
    if (active) onPatch(active.id, value);
  };
  const currentCard = active?.reviewIds
    .filter((id) => !active.reviewedIds.includes(id))
    .map((id) => bank.find((item) => item.id === id))
    .find(Boolean);
  const grade = (value: Grade) => {
    if (!active || !currentCard) return;
    onGrade(currentCard.id, value);
    const reviewedIds = [...active.reviewedIds, currentCard.id];
    const remaining = active.reviewIds.some(
      (id) => !reviewedIds.includes(id) && bank.some((item) => item.id === id),
    );
    patch({
      reviewedIds,
      reviewDraft: "",
      reviewRevealed: false,
      stage: remaining ? "review" : "read",
    });
  };
  const stages = ["Recall", "Explore", "Try & revise", "Finish"];
  const stageIndex = active
    ? { recall: 0, review: 0, read: 1, write: 2, reflect: 3, complete: 4 }[
        active.stage
      ]
    : 0;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-teal-900 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
              A little practice. A lasting difference.
            </p>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl">
              {active?.stage === "complete"
                ? "A good place to stop."
                : "Find your cadence."}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-teal-100">
              {active?.stage === "complete"
                ? "You made time for your English today. Your next challenge will be here tomorrow."
                : "One thoughtful challenge, a chance to try again, and something useful to take with you."}
            </p>
          </div>
          <div className="rounded-xl border border-teal-700 bg-teal-800/60 px-4 py-3">
            <p className="text-2xl font-semibold">
              {days}
              <span className="text-base font-normal text-teal-200">
                {" "}
                / {profile.weeklyGoal}
              </span>
            </p>
            <p className="mt-1 text-xs text-teal-100">days this week</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-teal-100">
          <span>
            Reading {profile.levels.reading} · Writing {profile.levels.writing}
          </span>
          <span>Working towards {profile.target}</span>
          <button onClick={onProfile} className="underline underline-offset-4">
            Edit profile
          </button>
        </div>
      </section>

      <ProgressPulse records={records} />

      {!profile.configured && !active && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm text-teal-900">
            We’ve started you at C1 → C2. Make it yours with your goals and
            interests.
          </p>
          <button
            onClick={onProfile}
            className="text-sm font-semibold text-teal-800 underline underline-offset-4"
          >
            Personalise my practice
          </button>
        </div>
      )}

      {!active && (
        <section className="panel space-y-6">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-amber-50 p-3 text-amber-700">
              <Clock3 size={22} />
            </span>
            <div>
              <h3 className="font-serif text-2xl">A session for today</h3>
              <p className="mt-1 text-sm text-slate-500">
                Choose the time you have. Every option counts.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([3, 10, 20] as const).map((time) => (
              <button
                key={time}
                aria-pressed={minutes === time}
                onClick={() => setMinutes(time)}
                className={`rounded-xl border px-2 py-4 text-center transition ${minutes === time ? "border-teal-700 bg-teal-50 ring-1 ring-teal-700" : "border-slate-200 hover:border-slate-400"}`}
              >
                <span className="block text-xl font-semibold">
                  {time} <span className="text-sm font-normal">min</span>
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {time === 3
                    ? "Keep the habit"
                    : time === 10
                      ? "Find your flow"
                      : "Go a little deeper"}
                </span>
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium">
            Today’s challenge
            <select
              className="text-input mt-2"
              value={support}
              onChange={(e) => setSupport(e.target.value as Support)}
            >
              <option value="supported">
                More support · a gentler session
              </option>
              <option value="balanced">Balanced · a comfortable stretch</option>
              <option value="stretch">
                Stretch me · a little more challenge
              </option>
            </select>
          </label>
          <p className="text-xs leading-relaxed text-slate-500">
            {suggestedSupport(records, profile) === "balanced"
              ? "Your reflections will help us tune future sessions. Your level stays in your control."
              : "Suggested from your last three reflections at these reading and writing levels. You can change it above."}{" "}
            Time estimates are flexible.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Recall → a new challenge → reuse → notice a change
            </p>
            <button className="primary-button" onClick={start} disabled={busy}>
              Start my session <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}

      {!active && nextRecall && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          Today starts with {FOCUS_LABELS[nextRecall.focus].toLowerCase()} from
          your practice on {nextRecall.sourceDate}. Then you’ll try the same
          skill in a fresh situation.
        </p>
      )}

      {active && active.stage !== "complete" && (
        <>
          {active.date !== today && (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              Welcome back. Your session from {active.date} is ready to
              continue. Finishing it counts for today.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-600">
              {active.minutes} minute session · {active.topic}
            </p>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
              {FOCUS_LABELS[active.focus]}
            </span>
          </div>
          <ol className="grid grid-cols-4 gap-2" aria-label="Session progress">
            {stages.map((stage, index) => (
              <li
                key={stage}
                aria-current={stageIndex === index ? "step" : undefined}
                className={`border-t-2 pt-2 text-xs sm:text-sm ${stageIndex >= index ? "border-teal-700 text-teal-800" : "border-slate-200 text-slate-400"}`}
              >
                <span className="mr-1">
                  {stageIndex > index ? "✓" : `${index + 1}.`}
                </span>
                {stage}
              </li>
            ))}
          </ol>
          {active.stage === "recall" && active.recall && (
            <RecallPanel
              challenge={active.recall}
              onChange={(recall) => patch({ recall })}
              onContinue={(outcome) =>
                patch({
                  recall: { ...active.recall!, outcome },
                  stage: active.reviewIds.length ? "review" : "read",
                })
              }
            />
          )}
          {active.stage === "review" && (
            <section className="panel space-y-4">
              <div>
                <p className="eyebrow">A little retrieval</p>
                <h3 className="mt-2 font-serif text-2xl">
                  Bring something back.
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {active.reviewedIds.length} of {active.reviewIds.length}{" "}
                  reviewed. The rest of your bank can wait.
                </p>
              </div>
              {currentCard ? (
                <>
                  <p className="text-sm text-slate-600">
                    {currentCard.kind === "vocab"
                      ? "Recall the meaning and write a sentence using this expression."
                      : "Try expressing this more clearly or appropriately."}
                  </p>
                  <p className="font-serif text-xl">{currentCard.original}</p>
                  <label className="sr-only" htmlFor="review-recall">
                    Your recall attempt
                  </label>
                  <textarea
                    id="review-recall"
                    className="text-input min-h-24"
                    placeholder="Try to recall it before revealing…"
                    maxLength={2000}
                    readOnly={active.reviewRevealed}
                    value={active.reviewDraft}
                    onChange={(e) => patch({ reviewDraft: e.target.value })}
                  />
                  {!active.reviewRevealed ? (
                    <div className="flex flex-wrap gap-4">
                      <button
                        className="secondary-button"
                        disabled={!active.reviewDraft.trim()}
                        onClick={() => patch({ reviewRevealed: true })}
                      >
                        Compare with my card
                      </button>
                      <button
                        className="text-sm text-slate-500 underline underline-offset-4"
                        onClick={() => patch({ reviewRevealed: true })}
                      >
                        I can’t recall it yet
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="font-medium">{currentCard.native}</p>
                        <p className="mt-2 text-sm text-slate-600">
                          {currentCard.why}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">
                        How did recall feel? This is your own assessment.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          className="secondary-button"
                          onClick={() => grade("again")}
                        >
                          Again
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => grade("good")}
                        >
                          Good
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => grade("easy")}
                        >
                          Easy
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <button
                  className="primary-button"
                  onClick={() => patch({ stage: "read" })}
                >
                  Continue to the challenge <ArrowRight size={16} />
                </button>
              )}
            </section>
          )}

          {active.stage === "read" && (
            <section className="panel space-y-5">
              {active.lesson ? (
                <>
                  <div>
                    <p className="eyebrow">
                      Explore · original practice scenario
                    </p>
                    <h3 className="mt-2 font-serif text-2xl">
                      {active.lesson.title}
                    </h3>
                  </div>
                  <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-800">
                    {active.lesson.passage}
                  </p>
                  <div className="rounded-xl bg-teal-50 p-4">
                    <p className="text-xs font-semibold text-teal-800">
                      Your challenge
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-teal-900">
                      {active.lesson.prompt}
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => patch({ stage: "write" })}
                  >
                    I’m ready to try <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <div className="py-6 text-center">
                  <BookOpen className="mx-auto text-teal-700" size={28} />
                  <h3 className="mt-3 font-serif text-2xl">
                    A challenge just for you.
                  </h3>
                  <p className="my-3 text-sm text-slate-500">
                    {busy
                      ? "Preparing a short scenario around your interests…"
                      : "Your reading and writing levels will shape this challenge."}
                  </p>
                  <button
                    className="primary-button mx-auto"
                    disabled={busy}
                    onClick={() => void generate(active)}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />{" "}
                        Preparing…
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> Create my challenge
                      </>
                    )}
                  </button>
                </div>
              )}
            </section>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800"
            >
              {error}
            </p>
          )}

          {active.stage === "write" && active.lesson && (
            <section className="panel space-y-5">
              <div>
                <p className="eyebrow">Try · notice · try again</p>
                <h3 className="mt-2 font-serif text-2xl">
                  {active.lesson.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  {active.lesson.prompt}
                </p>
              </div>
              <details className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                <summary className="cursor-pointer font-medium">
                  Read the scenario again
                </summary>
                <p className="mt-3 whitespace-pre-wrap leading-relaxed">
                  {active.lesson.passage}
                </p>
              </details>
              <ul className="space-y-2">
                {active.lesson.successCriteria.map((criterion, index) => (
                  <li key={index} className="flex gap-2 text-sm text-slate-600">
                    <Check
                      size={15}
                      className="mt-0.5 shrink-0 text-teal-700"
                    />
                    {criterion}
                  </li>
                ))}
              </ul>
              <details
                className="text-sm text-slate-600"
                open={active.support === "supported" ? true : undefined}
              >
                <summary className="cursor-pointer text-teal-700">
                  Need a starting point?
                </summary>
                <p className="mt-2 leading-relaxed">{active.lesson.support}</p>
              </details>
              <ReusePrompt targets={active.reuseTargets ?? []} />
              <WritingCoach
                key={active.id}
                task={active.lesson.prompt}
                context={active.lesson.passage}
                focus={active.focus}
                profile={active.profile}
                value={active.writing}
                onChange={(writing) => patch({ writing })}
                bank={bank}
                onSave={(items) => onSave(items, active.focus)}
                reuseTargets={active.reuseTargets}
              />
              {active.writing.feedback && (
                <div className="border-t border-slate-100 pt-5">
                  <button
                    className="primary-button"
                    onClick={() => patch({ stage: "reflect" })}
                  >
                    Wrap up my session <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          )}
          {active.stage === "reflect" && (
            <section className="panel space-y-5">
              <div>
                <p className="eyebrow">One last check-in</p>
                <h3 className="mt-2 font-serif text-2xl">How did that feel?</h3>
                <p className="mt-2 text-sm text-slate-600">
                  This helps shape your next challenge. Every answer counts as a
                  completed session.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["easy", "A little easy"],
                    ["right", "About right"],
                    ["hard", "Quite challenging"],
                  ] as [Difficulty, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={active.difficulty === value}
                    onClick={() => patch({ difficulty: value })}
                    className={`rounded-xl border p-4 text-sm ${active.difficulty === value ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-200 text-slate-600"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className="primary-button"
                disabled={!active.difficulty}
                onClick={() => onFinish(active)}
              >
                Finish for today <CheckCircle2 size={17} />
              </button>
              <button
                className="block text-sm text-slate-500 underline underline-offset-4"
                onClick={() => patch({ stage: "write" })}
              >
                Back to my feedback
              </button>
            </section>
          )}
        </>
      )}

      {active?.stage === "complete" && (
        <section className="panel text-center">
          <CheckCircle2 className="mx-auto text-teal-700" size={36} />
          <h3 className="mt-4 font-serif text-2xl">Today, you showed up.</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            One challenge completed
            {active.writing.hint &&
            active.writing.revision !== active.writing.draft
              ? ", one response revised"
              : ""}
            {active.reviewedIds.length
              ? `, ${active.reviewedIds.length} ${active.reviewedIds.length === 1 ? "expression" : "expressions"} revisited`
              : ""}
            . Your attempts and feedback are saved below.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {days >= profile.weeklyGoal
              ? "You’ve met your weekly goal. Any extra practice is up to you."
              : "Small sessions count. Pick up again whenever you’re ready."}
          </p>
          <button
            className="secondary-button mx-auto mt-5"
            onClick={onPractice}
          >
            Explore more practice <ArrowRight size={16} />
          </button>
        </section>
      )}

      {active?.stage === "complete" && <LearningWin session={active} />}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl">Your progress, in your words</h3>
          <span className="text-xs text-slate-500">
            {records.length} {records.length === 1 ? "session" : "sessions"}{" "}
            completed
          </span>
        </div>
        {!records.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm leading-relaxed text-slate-500">
            Your first attempts, revisions, and feedback will live here. Finish
            a Today session to start your collection.
          </div>
        ) : (
          [...records]
            .reverse()
            .slice(0, 10)
            .map((record) => (
              <details key={record.id} className="panel">
                <summary className="cursor-pointer">
                  <span className="font-medium text-slate-800">
                    {record.title}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {record.date} · {record.minutes} minute session ·{" "}
                    {FOCUS_LABELS[record.focus]}
                  </span>
                </summary>
                <div className="mt-5 space-y-5">
                  <p className="text-sm text-slate-600">{record.prompt}</p>
                  <RecallResult recall={record.recall} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-500">
                        First attempt
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                        {record.original}
                      </p>
                    </div>
                    {record.revision && (
                      <div className="rounded-xl bg-teal-50 p-4">
                        <p className="text-xs font-semibold text-teal-800">
                          Your revision
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                          {record.revision}
                        </p>
                      </div>
                    )}
                  </div>
                  <FeedbackView
                    feedback={record.feedback}
                    bank={bank}
                    onSave={(items) => onSave(items, record.focus)}
                  />
                </div>
              </details>
            ))
        )}
      </section>
    </div>
  );
}
