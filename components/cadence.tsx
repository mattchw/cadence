"use client";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Fragment,
  type ReactNode,
} from "react";
import {
  BookOpen,
  Repeat,
  Layers,
  Check,
  Plus,
  Loader2,
  ArrowRight,
  Sparkles,
  GraduationCap,
  Wand2,
  FileText,
  Globe,
  Sun,
  Settings2,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { LEVELS, typeClass } from "@/lib/constants";
import { parseLevel, readability } from "@/lib/cefr";
import { todayStr, addDays, isDue, schedule } from "@/lib/sr";
import { generatePassage, analyzePassage } from "@/lib/ai";
import {
  loadJSON,
  saveJSON,
  STORAGE_EVENT,
  configureStorage,
  syncState,
  retrySync,
  hasUnsyncedChanges,
  clearStorageSession,
  STORAGE_RELOAD_EVENT,
} from "@/lib/storage";
import { AccountStatus } from "@/components/account-status";
import type { AccountUser } from "@/lib/auth-policy";
import { Today } from "@/components/today";
import { ProgressCalendar } from "@/components/progress-calendar";
import { Profile } from "@/components/profile";
import { Practice } from "@/components/practice";
import { WritingCoach } from "@/components/writing-coach";
import {
  addUpgrades,
  DEFAULT_PROFILE,
  emptyWriting,
  localDate,
  normaliseProfile,
  toRecord,
} from "@/lib/learning";
import type {
  BankItem,
  Stats,
  UpgradeSuggestion,
  VocabItem,
  Analysis,
  Passage,
  Metrics,
  Grade,
  LearnerProfile,
  DailySession,
  LearningRecord,
} from "@/lib/types";

const K_UP = "cadence:upgrades";
const K_STATS = "cadence:stats";
const K_PROFILE = "cadence:profile";
const K_LEARNING = "cadence:learning";
const newId = (): string => crypto.randomUUID();
const errMsg = (e: unknown, fallback: string): string =>
  e instanceof Error ? e.message : fallback;
type PersistBank = (
  next: BankItem[] | ((previous: BankItem[]) => BankItem[]),
) => void;
interface PanelProps {
  upgrades: BankItem[];
  persistUpgrades: PersistBank;
  onComplete: () => void;
  profile: LearnerProfile;
}
interface BankProps {
  upgrades: BankItem[];
  persistUpgrades: PersistBank;
}
interface LearningData {
  session: DailySession | null;
  records: LearningRecord[];
}

interface TabProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  badge?: number;
}
function Tab({ active, onClick, icon: Icon, label, badge = 0 }: TabProps) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      <Icon size={16} />
      <span>{label}</span>
      {badge > 0 && (
        <span
          className={`ml-1 rounded-full px-1.5 text-xs ${active ? "bg-teal-600" : "bg-slate-200 text-slate-700"}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function highlightTerms(text: string, terms: string[]): ReactNode {
  const clean = (terms || [])
    .map((t) => (t || "").trim())
    .filter((t) => t.length > 1);
  if (!clean.length) return text;
  const esc = clean
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  let re: RegExp;
  try {
    re = new RegExp(`\\b(${esc.join("|")})\\b`, "gi");
  } catch {
    return text;
  }
  const set = new Set(clean.map((t) => t.toLowerCase()));
  return text.split(re).map((p, i) =>
    set.has((p || "").toLowerCase()) ? (
      <mark key={i} className="rounded bg-indigo-100 px-0.5 text-indigo-900">
        {p}
      </mark>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

export default function Cadence({
  user,
  legacyCloudAvailable = false,
  onSignOut,
}: {
  user: AccountUser;
  legacyCloudAvailable?: boolean;
  onSignOut: () => Promise<void>;
}) {
  const [tab, setTab] = useState<
    | "today"
    | "practice"
    | "exercises"
    | "review"
    | "bank"
    | "profile"
    | "calendar"
  >("today");
  const [upgrades, setUpgrades] = useState<BankItem[]>([]);
  const bankRef = useRef<BankItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    sessions: 0,
    lastDate: "",
    streak: 0,
  });
  const statsRef = useRef(stats);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [learning, setLearning] = useState<LearningData>({
    session: null,
    records: [],
  });
  const learningRef = useRef(learning);
  const [sync, setSync] = useState(syncState);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    configureStorage(user.id);
    setReady(false);
    setLoadError("");
    const updateNotice = () => setSync(syncState());
    const reload = () => setLoadAttempt((attempt) => attempt + 1);
    const retry = () => {
      void retrySync().catch(() => {});
    };
    window.addEventListener(STORAGE_RELOAD_EVENT, reload);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    const retryTimer = window.setInterval(retry, 15000);
    window.addEventListener(STORAGE_EVENT, updateNotice);
    void (async () => {
      try {
        const [bank, savedStats, savedProfile, savedLearning] =
          await Promise.all([
            loadJSON<BankItem[]>(K_UP, []),
            loadJSON<Stats>(K_STATS, { sessions: 0, lastDate: "", streak: 0 }),
            loadJSON<LearnerProfile>(K_PROFILE, DEFAULT_PROFILE),
            loadJSON<LearningData>(K_LEARNING, { session: null, records: [] }),
          ]);
        if (!active) return;
        bankRef.current = Array.isArray(bank) ? bank : [];
        setUpgrades(bankRef.current);
        statsRef.current = savedStats;
        setStats(savedStats);
        setProfile(normaliseProfile(savedProfile));
        learningRef.current =
          savedLearning && Array.isArray(savedLearning.records)
            ? savedLearning
            : { session: null, records: [] };
        setLearning(learningRef.current);
        updateNotice();
        setReady(true);
      } catch (error) {
        if (active)
          setLoadError(
            errMsg(
              error,
              "Your account progress could not be loaded. Please retry.",
            ),
          );
      }
    })();
    return () => {
      active = false;
      window.removeEventListener(STORAGE_EVENT, updateNotice);
      window.removeEventListener(STORAGE_RELOAD_EVENT, reload);
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
      window.clearInterval(retryTimer);
    };
  }, [user.id, loadAttempt]);

  const persistUpgrades = useCallback<PersistBank>((next) => {
    const result = typeof next === "function" ? next(bankRef.current) : next;
    bankRef.current = result;
    setUpgrades(result);
    saveJSON(K_UP, result);
  }, []);
  const saveSuggestions = (items: UpgradeSuggestion[], focus: string) =>
    persistUpgrades((previous) => addUpgrades(previous, items, focus));
  const markSession = useCallback(() => {
    const previous = statsRef.current;
    const today = todayStr();
    if (previous.lastDate === today) return;
    const next = {
      sessions: previous.sessions + 1,
      lastDate: today,
      streak: previous.lastDate === addDays(-1) ? previous.streak + 1 : 1,
    };
    statsRef.current = next;
    setStats(next);
    saveJSON(K_STATS, next);
  }, []);
  const persistLearning = (next: LearningData) => {
    learningRef.current = next;
    setLearning(next);
    saveJSON(K_LEARNING, next);
  };
  const patchSession = (id: string, patch: Partial<DailySession>) => {
    const current = learningRef.current;
    if (current.session?.id === id)
      persistLearning({
        ...current,
        session: { ...current.session, ...patch },
      });
  };
  const finishSession = (session: DailySession) => {
    const record = toRecord(session);
    const current = learningRef.current;
    if (
      !record ||
      current.session?.id !== session.id ||
      current.records.some((item) => item.id === session.id)
    )
      return;
    const date = localDate();
    persistLearning({
      session: {
        ...session,
        date,
        stage: "complete",
        completedAt: new Date().toISOString(),
      },
      records: [...current.records, { ...record, date }],
    });
    markSession();
    void retrySync();
  };
  const leave = async (leaveUnsynced = false) => {
    setSigningOut(true);
    setSignOutError("");
    try {
      if (!leaveUnsynced && hasUnsyncedChanges() && !(await retrySync())) {
        setSignOutError(
          "Your latest changes have not reached your account yet. Retry saving or choose to sign out without syncing. Only changes already backed up on this device can be recovered here.",
        );
        return;
      }
      clearStorageSession();
      await onSignOut();
    } catch {
      configureStorage(user.id);
      setLoadAttempt((attempt) => attempt + 1);
      setSignOutError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };
  const dueCount = upgrades.filter(isDue).length;
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-5 sm:py-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              Cadence<span className="text-teal-600">.</span>
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Make English part of your day.
            </p>
          </div>
          <button
            className={`secondary-button ${tab === "profile" ? "border-teal-600 bg-teal-50" : ""}`}
            onClick={() => setTab("profile")}
            aria-label="Learner profile"
          >
            <Settings2 size={17} />
            <span className="hidden sm:inline">My profile</span>
          </button>
        </header>
        <nav
          aria-label="Main navigation"
          className="mb-6 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5"
        >
          <Tab
            active={tab === "today"}
            onClick={() => setTab("today")}
            icon={Sun}
            label="Today"
          />
          <Tab
            active={tab === "practice"}
            onClick={() => setTab("practice")}
            icon={BookOpen}
            label="Practice"
          />
          <Tab
            active={tab === "exercises"}
            onClick={() => setTab("exercises")}
            icon={GraduationCap}
            label="Exercises"
          />
          <Tab
            active={tab === "review"}
            onClick={() => setTab("review")}
            icon={Repeat}
            label="Review"
            badge={dueCount}
          />
          <Tab
            active={tab === "bank"}
            onClick={() => setTab("bank")}
            icon={Layers}
            label="Bank"
          />
          <Tab
            active={tab === "calendar"}
            onClick={() => setTab("calendar")}
            icon={CalendarDays}
            label="Calendar"
          />
        </nav>
        <AccountStatus
          user={user}
          state={sync}
          ready={ready}
          legacyCloudAvailable={legacyCloudAvailable}
          onSignOut={leave}
          signingOut={signingOut}
          onRetryLoad={() => setLoadAttempt((attempt) => attempt + 1)}
        />
        {signOutError && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
          >
            {signOutError}
          </p>
        )}
        {sync.status === "account-changed" ? (
          <div className="panel text-sm text-slate-600">
            Reload this page to continue with the currently signed-in account.
          </div>
        ) : loadError ? (
          <div role="alert" className="panel space-y-4">
            <h2 className="font-serif text-xl">
              Let’s reconnect to your progress.
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              {loadError}
            </p>
            <p className="text-xs text-slate-500">
              Your account data has not been replaced. Check the connection or
              database settings and try again.
            </p>
            <button
              className="primary-button"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            >
              Retry loading my progress
            </button>
          </div>
        ) : !ready ? (
          <div
            className="flex items-center gap-2 py-16 text-slate-500"
            role="status"
          >
            <Loader2 className="animate-spin" size={18} /> Loading your studio…
          </div>
        ) : (
          <main>
            <fieldset disabled={signingOut}>
              {tab === "calendar" && (
                <ProgressCalendar
                  records={learning.records}
                  weeklyGoal={profile.weeklyGoal}
                  onPractice={() => setTab("today")}
                />
              )}
              {tab === "today" && (
                <Today
                  profile={profile}
                  session={learning.session}
                  records={learning.records}
                  bank={upgrades}
                  onStart={(session) =>
                    persistLearning({ ...learningRef.current, session })
                  }
                  onPatch={patchSession}
                  onGrade={(id, grade) =>
                    persistUpgrades((previous) =>
                      previous.map((item) =>
                        item.id === id ? schedule(item, grade) : item,
                      ),
                    )
                  }
                  onSave={saveSuggestions}
                  onFinish={finishSession}
                  onProfile={() => setTab("profile")}
                  onPractice={() => setTab("practice")}
                />
              )}
              {tab === "profile" && (
                <Profile
                  profile={profile}
                  onSave={(next) => {
                    setProfile(next);
                    saveJSON(K_PROFILE, next);
                    setTab("today");
                  }}
                />
              )}
              {tab === "practice" && (
                <Practice
                  profile={profile}
                  bank={upgrades}
                  onSave={saveSuggestions}
                  onComplete={markSession}
                />
              )}
              {tab === "exercises" && (
                <Exercises
                  upgrades={upgrades}
                  persistUpgrades={persistUpgrades}
                  onComplete={markSession}
                  profile={profile}
                />
              )}
              {tab === "review" && (
                <Review
                  upgrades={upgrades}
                  persistUpgrades={persistUpgrades}
                  onComplete={markSession}
                  profile={profile}
                />
              )}
              {tab === "bank" && (
                <Bank upgrades={upgrades} persistUpgrades={persistUpgrades} />
              )}
            </fieldset>
          </main>
        )}
        {ready && (
          <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
            Small steps, at your pace. · {stats.sessions} practice days ·{" "}
            {upgrades.length} expressions saved
          </footer>
        )}
      </div>
    </div>
  );
}

// ---------------------------- EXERCISES ----------------------------
function Exercises({
  upgrades,
  persistUpgrades,
  onComplete,
  profile,
}: PanelProps) {
  const [mode, setMode] = useState<"generate" | "paste">("generate");
  const [level, setLevel] = useState<string>(profile.levels.reading);
  const [topic, setTopic] = useState(profile.interests[0] || "");
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState<"" | "gen" | "analyze">("");
  const [error, setError] = useState("");
  const [passage, setPassage] = useState<Passage | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [savedVocab, setSavedVocab] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [cloze, setCloze] = useState<
    Record<number, { val: string; checked: boolean }>
  >({});
  const [para, setPara] = useState(emptyWriting);

  const resetOutput = () => {
    setAnalysis(null);
    setMetrics(null);
    setSavedVocab(new Set());
    setRevealed(new Set());
    setCloze({});
    setPara(emptyWriting());
  };

  const runAnalyze = async (text: string) => {
    setBusy("analyze");
    setError("");
    try {
      setMetrics(readability(text));
      const a = await analyzePassage(text, level);
      setAnalysis(a);
    } catch (e) {
      setError(errMsg(e, "Analysis failed."));
    } finally {
      setBusy("");
    }
  };
  const runGenerate = async (nudge?: string) => {
    setBusy("gen");
    setError("");
    setPassage(null);
    resetOutput();
    try {
      const p = await generatePassage(topic, level, nudge);
      setPassage(p);
      await runAnalyze(p.text);
    } catch (e) {
      setError(errMsg(e, "Generation failed."));
      setBusy("");
    }
  };
  const runPaste = async () => {
    if (!pasteText.trim()) return;
    setPassage({ text: pasteText.trim(), webVerified: null });
    resetOutput();
    await runAnalyze(pasteText.trim());
  };

  const saveVocabs = (items: VocabItem[]) => {
    const pending = items.filter((item) => !savedVocab.has(item.term));
    persistUpgrades((previous) => {
      const keys = new Set(
        previous
          .filter((item) => item.kind === "vocab")
          .map((item) => item.original.toLowerCase()),
      );
      const additions: BankItem[] = [];
      for (const item of pending) {
        if (keys.has(item.term.toLowerCase())) continue;
        keys.add(item.term.toLowerCase());
        additions.push({
          id: newId(),
          kind: "vocab",
          original: item.term,
          native: item.meaning,
          why: item.example ?? "",
          type: "vocab",
          cefr: item.cefr,
          focus: "reading",
          createdAt: todayStr(),
          reps: 0,
          interval: 0,
          ease: 2.5,
          due: todayStr(),
        });
      }
      return [...previous, ...additions];
    });
    setSavedVocab(
      (previous) => new Set([...previous, ...pending.map((item) => item.term)]),
    );
  };

  const claudeLvl = analysis ? parseLevel(analysis.estimated_cefr) : null;

  return (
    <div className="space-y-4">
      {/* controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 inline-flex rounded-lg border border-slate-200 p-1 text-sm">
          <button
            onClick={() => setMode("generate")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${mode === "generate" ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <Wand2 size={15} /> Generate
          </button>
          <button
            onClick={() => setMode("paste")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${mode === "paste" ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <FileText size={15} /> Paste text
          </button>
        </div>

        <div className="mb-1 text-xs font-medium text-slate-500">
          Target level
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLevel(l.id)}
              title={l.ielts !== "—" ? `≈ IELTS ${l.ielts}` : ""}
              className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium ${level === l.id ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
            >
              {l.id}
              {l.id === profile.target ? (
                <span className="ml-1 text-xs font-normal text-teal-600">
                  goal
                </span>
              ) : l.note ? (
                <span className="ml-1 text-xs font-normal text-slate-400">
                  {l.note}
                </span>
              ) : (
                ""
              )}
            </button>
          ))}
        </div>

        {mode === "generate" ? (
          <>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic (optional) — e.g. AI regulation, Cardiff, football tactics…"
              className="mb-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
            />
            <button
              onClick={() => runGenerate()}
              disabled={busy !== ""}
              className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40"
            >
              {busy === "gen" ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Writing…
                </>
              ) : busy === "analyze" ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Analysing…
                </>
              ) : (
                <>
                  <Wand2 size={16} /> Generate passage
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste an article or any text you want to work through…"
              className="mb-3 h-40 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed outline-none focus:border-teal-500 focus:bg-white"
            />
            <button
              onClick={runPaste}
              disabled={busy !== "" || !pasteText.trim()}
              className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40"
            >
              {busy === "analyze" ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Analysing…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Analyse text
                </>
              )}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* passage + level verdict */}
      {passage && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
            {passage.webVerified === true && (
              <span className="flex items-center gap-1 text-slate-500">
                <Globe size={12} /> grounded in a web search
              </span>
            )}
            {passage.webVerified === false && (
              <span>from model knowledge — may not be current</span>
            )}
            {passage.webVerified === null && <span>your pasted text</span>}
          </div>
          <div className="font-serif text-[15px] leading-relaxed text-slate-900 whitespace-pre-wrap">
            {analysis
              ? highlightTerms(
                  passage.text,
                  (analysis.vocab || []).map((v) => v.term),
                )
              : passage.text}
          </div>

          {metrics && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-500">Target</span>
                <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
                  {level}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">AI estimate</span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                  {claudeLvl || "?"}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Readability check</span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                  {metrics.cefr}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 sm:grid-cols-4">
                <div>
                  Grade{" "}
                  <span className="font-medium text-slate-700">
                    {metrics.fk.toFixed(1)}
                  </span>
                </div>
                <div>
                  Ease{" "}
                  <span className="font-medium text-slate-700">
                    {metrics.ease.toFixed(0)}
                  </span>
                </div>
                <div>
                  Avg sentence{" "}
                  <span className="font-medium text-slate-700">
                    {metrics.avgLen.toFixed(1)}w
                  </span>
                </div>
                <div>
                  Diversity{" "}
                  <span className="font-medium text-slate-700">
                    {(metrics.diversity * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="mt-3 text-xs leading-relaxed text-slate-500">
                Readability is a rough text estimate, not a measure of your
                proficiency. Short, clear language can still express complex
                ideas. {analysis?.note}
              </div>
              {mode === "generate" && (
                <div className="mt-2 flex gap-3 text-xs">
                  <button
                    onClick={() =>
                      runGenerate("Make it noticeably more advanced.")
                    }
                    className="font-medium text-slate-500 hover:text-slate-800"
                  >
                    Harder
                  </button>
                  <button
                    onClick={() =>
                      runGenerate("Make it a little simpler and more concrete.")
                    }
                    className="font-medium text-slate-500 hover:text-slate-800"
                  >
                    Easier
                  </button>
                  <button
                    onClick={() => runGenerate()}
                    className="font-medium text-slate-500 hover:text-slate-800"
                  >
                    New topic
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* above-level vocabulary */}
      {analysis &&
        Array.isArray(analysis.vocab) &&
        analysis.vocab.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg text-slate-900">
                  Expressions to explore
                </h3>
                <p className="text-xs text-slate-500">
                  Useful language for your chosen level. Save it for later
                  practice.
                </p>
              </div>
              <button
                onClick={() => saveVocabs(analysis.vocab ?? [])}
                className="text-xs font-medium text-teal-700 hover:text-teal-900"
              >
                Save all
              </button>
            </div>
            <div className="space-y-2">
              {analysis.vocab.map((v, i) => {
                const saved = savedVocab.has(v.term);
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {v.term}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${typeClass("vocab")}`}
                      >
                        {v.cefr}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {v.meaning}
                    </div>
                    {v.example && (
                      <div className="mt-1 text-sm italic text-slate-500">
                        “{v.example}”
                      </div>
                    )}
                    <button
                      onClick={() => saveVocabs([v])}
                      disabled={saved}
                      className={`mt-2 flex items-center gap-1 text-xs font-medium ${saved ? "text-emerald-600" : "text-teal-700 hover:text-teal-900"}`}
                    >
                      {saved ? (
                        <>
                          <Check size={13} /> Saved
                        </>
                      ) : (
                        <>
                          <Plus size={13} /> Save to bank
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* comprehension */}
      {analysis &&
        Array.isArray(analysis.comprehension) &&
        analysis.comprehension.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 font-serif text-lg text-slate-900">
              Comprehension
            </h3>
            <div className="space-y-3">
              {analysis.comprehension.map((c, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-slate-800">{c.q}</p>
                  {revealed.has(i) ? (
                    <p className="mt-1 text-sm text-slate-600">{c.a}</p>
                  ) : (
                    <button
                      onClick={() => setRevealed(new Set(revealed).add(i))}
                      className="mt-1 text-xs font-medium text-teal-700 hover:text-teal-900"
                    >
                      Show answer
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      {/* cloze */}
      {analysis &&
        Array.isArray(analysis.cloze) &&
        analysis.cloze.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-1 font-serif text-lg text-slate-900">
              Fill the gap
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Recall the exact word from the passage.
            </p>
            <div className="space-y-3">
              {analysis.cloze.map((c, i) => {
                const st = cloze[i] || { val: "", checked: false };
                const ok =
                  st.checked &&
                  st.val.trim().toLowerCase() ===
                    (c.answer || "").trim().toLowerCase();
                return (
                  <div key={i}>
                    <p className="text-sm text-slate-800">{c.text}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        value={st.val}
                        onChange={(e) =>
                          setCloze({
                            ...cloze,
                            [i]: { val: e.target.value, checked: false },
                          })
                        }
                        className="w-40 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm outline-none focus:border-teal-500 focus:bg-white"
                        placeholder="answer"
                      />
                      <button
                        onClick={() => (
                          setCloze({ ...cloze, [i]: { ...st, checked: true } }),
                          onComplete()
                        )}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Check
                      </button>
                      {st.checked &&
                        (ok ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <Check size={13} /> {c.answer}
                          </span>
                        ) : (
                          <span className="text-xs text-rose-600">
                            → {c.answer}
                          </span>
                        ))}
                      {!st.checked && c.hint && (
                        <span className="text-xs text-slate-400">{c.hint}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {analysis?.paraphrase && (
        <section className="panel space-y-4">
          <h3 className="font-serif text-xl">Say it in your own words</h3>
          <p className="text-sm italic text-slate-600">
            “{analysis.paraphrase}”
          </p>
          <WritingCoach
            key={analysis.paraphrase}
            task={`Paraphrase this while preserving its meaning: ${analysis.paraphrase}`}
            focus="Paraphrase"
            profile={profile}
            value={para}
            onChange={setPara}
            bank={upgrades}
            onSave={(items) =>
              persistUpgrades((previous) =>
                addUpgrades(previous, items, "reading"),
              )
            }
            onFeedback={onComplete}
          />
        </section>
      )}
    </div>
  );
}

// ---------------------------- REVIEW ----------------------------
function Review({ upgrades, persistUpgrades, onComplete }: PanelProps) {
  const [queue, setQueue] = useState(() =>
    upgrades
      .filter(isDue)
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 10),
  );
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState("");
  const [reviewed, setReviewed] = useState(0);
  const current = queue[0];
  const grade = (value: Grade) => {
    if (!current) return;
    persistUpgrades((previous) =>
      previous.map((item) =>
        item.id === current.id ? schedule(item, value) : item,
      ),
    );
    setQueue((previous) => previous.slice(1));
    setShow(false);
    setDraft("");
    setReviewed((count) => count + 1);
    onComplete();
  };
  if (!upgrades.length)
    return (
      <Empty
        title="Nothing to review yet"
        body="Save expressions from Today, Practice, or Exercises. They’ll return here for spaced review."
      />
    );
  if (!current)
    return (
      <Empty
        title={reviewed ? "A little review, done." : "All caught up"}
        body={
          reviewed
            ? `You revisited ${reviewed} expressions. Anything marked Again stays due for another round when you’re ready.`
            : "No expressions are due today. Your next reviews will appear here."
        }
      />
    );
  return (
    <section className="panel space-y-4">
      <div>
        <p className="eyebrow">Make it stick</p>
        <h2 className="mt-2 font-serif text-2xl">
          Bring it back in your own words.
        </h2>
        <p className="mt-2 text-xs text-slate-500">
          {queue.length} left in this round · up to 10 at a time
        </p>
      </div>
      <p className="text-sm text-slate-600">
        {current.kind === "vocab"
          ? "Recall the meaning, then use this expression in a sentence."
          : "Try expressing this more clearly or appropriately."}
      </p>
      <p className="font-serif text-xl">{current.original}</p>
      <label className="sr-only" htmlFor="bank-recall">
        Your recall attempt
      </label>
      <textarea
        id="bank-recall"
        className="text-input min-h-24"
        maxLength={2000}
        readOnly={show}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Try to recall it first…"
      />
      {!show ? (
        <div className="flex flex-wrap gap-4">
          <button
            className="primary-button"
            disabled={!draft.trim()}
            onClick={() => setShow(true)}
          >
            Compare with my card
          </button>
          <button
            className="text-sm text-slate-500 underline underline-offset-4"
            onClick={() => setShow(true)}
          >
            I can’t recall it yet
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="font-medium">{current.native}</p>
            <p className="mt-2 text-sm text-slate-600">{current.why}</p>
          </div>
          <p className="text-xs text-slate-500">Assess your own recall.</p>
          <div className="grid grid-cols-3 gap-2">
            <button className="secondary-button" onClick={() => grade("again")}>
              Again
            </button>
            <button className="secondary-button" onClick={() => grade("good")}>
              Good
            </button>
            <button className="secondary-button" onClick={() => grade("easy")}>
              Easy
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------- BANK ----------------------------
function Bank({ upgrades, persistUpgrades }: BankProps) {
  const [filter, setFilter] = useState<string>("all");
  const types: string[] = [
    "all",
    ...Array.from(new Set(upgrades.map((u) => u.type))),
  ];
  const list =
    filter === "all" ? upgrades : upgrades.filter((u) => u.type === filter);
  const remove = (id: string) =>
    persistUpgrades(upgrades.filter((u) => u.id !== id));

  if (upgrades.length === 0)
    return (
      <Empty
        title="Your bank is empty"
        body="Save useful expressions from Today, Practice, or Exercises. This is your personal collection of language to revisit and use."
      />
    );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${filter === t ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
          >
            {t}
            {t !== "all"
              ? ` (${upgrades.filter((u) => u.type === t).length})`
              : ` (${upgrades.length})`}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {list.map((u) => (
          <div
            key={u.id}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex items-center gap-2 text-sm">
              <span
                className={
                  u.kind === "vocab"
                    ? "font-medium text-slate-900"
                    : "text-slate-500"
                }
              >
                {u.original}
              </span>
              <ArrowRight size={14} className="shrink-0 text-slate-400" />
              <span
                className={
                  u.kind === "vocab"
                    ? "text-slate-600"
                    : "font-medium text-slate-900"
                }
              >
                {u.native}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${typeClass(u.type)}`}
                >
                  {u.type}
                </span>
                {u.cefr && (
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
                    {u.cefr}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  due {u.due === todayStr() ? "today" : u.due}
                </span>
              </div>
              <button
                onClick={() => remove(u.id)}
                className="text-xs text-slate-400 hover:text-rose-600"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h3 className="font-serif text-xl text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {body}
      </p>
    </div>
  );
}
