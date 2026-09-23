import type {
  BankItem,
  DailySession,
  LearnerProfile,
  LearningRecord,
  SessionMinutes,
  Support,
  UpgradeSuggestion,
  UpgradeType,
  WritingState,
} from "./types";
import { selectRecall, selectReuseTargets } from "./daily-loop";

export const DEFAULT_PROFILE: LearnerProfile = {
  levels: { reading: "C1", writing: "C1", listening: "C1", speaking: "C1" },
  target: "C2",
  goal: "everyday",
  interests: ["Culture", "Technology"],
  minutes: 10,
  weeklyGoal: 4,
  configured: false,
};

export const GOALS = {
  everyday: "Everyday conversations",
  work: "Work & professional life",
  study: "Study & ideas",
};
export const FOCUS_LABELS: Record<UpgradeType, string> = {
  collocation: "Natural combinations",
  register: "Tone & audience",
  idiom: "Implied meaning",
  "word-choice": "Precise word choice",
  grammar: "Sentence control",
  rhythm: "Flow & clarity",
  vocab: "Useful expressions",
};

export const emptyWriting = (): WritingState => ({
  draft: "",
  revision: "",
  hint: null,
  feedback: null,
});
export const makeId = (): string => globalThis.crypto.randomUUID();

// A local calendar date keeps daily practice aligned with the learner's day.
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function normaliseProfile(value: LearnerProfile | null): LearnerProfile {
  const validLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const profile = {
    ...DEFAULT_PROFILE,
    ...value,
    levels: { ...DEFAULT_PROFILE.levels, ...value?.levels },
  };
  for (const skill of [
    "reading",
    "writing",
    "listening",
    "speaking",
  ] as const) {
    if (!validLevels.includes(profile.levels[skill]))
      profile.levels[skill] = "C1";
  }
  if (!validLevels.includes(profile.target)) profile.target = "C2";
  if (!(profile.goal in GOALS)) profile.goal = "everyday";
  if (![3, 10, 20].includes(profile.minutes)) profile.minutes = 10;
  profile.weeklyGoal = Number.isInteger(profile.weeklyGoal)
    ? Math.max(1, Math.min(7, profile.weeklyGoal))
    : 4;
  profile.interests = Array.isArray(profile.interests)
    ? [
        ...new Set(
          profile.interests
            .filter((item) => typeof item === "string")
            .map((item) => item.trim().slice(0, 60))
            .filter(Boolean),
        ),
      ].slice(0, 6)
    : DEFAULT_PROFILE.interests;
  if (!profile.interests.length) profile.interests = DEFAULT_PROFILE.interests;
  profile.configured = profile.configured === true;
  return profile;
}

export function suggestedSupport(
  records: LearningRecord[],
  profile: LearnerProfile,
): Support {
  const recent = [...records]
    .filter(
      (record) =>
        record.writingLevel === profile.levels.writing &&
        record.readingLevel === profile.levels.reading,
    )
    .slice(-3);
  if (recent.length < 3) return "balanced";
  if (recent.every((record) => record.difficulty === "easy")) return "stretch";
  if (recent.every((record) => record.difficulty === "hard"))
    return "supported";
  return "balanced";
}

export function chooseFocus(
  records: LearningRecord[],
  date: string,
): UpgradeType {
  const counts = new Map<UpgradeType, number>();
  for (const record of records.slice(-5)) {
    for (const type of new Set(
      (record.feedback.upgrades ?? [])
        .filter((upgrade) => upgrade.category === "correction")
        .map((upgrade) => upgrade.type),
    )) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  const recurring = [...counts]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])[0];
  if (recurring) return recurring[0];
  const rotation: UpgradeType[] = [
    "register",
    "word-choice",
    "collocation",
    "rhythm",
    "idiom",
  ];
  return rotation[
    date.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) %
      rotation.length
  ];
}

export function createSession(
  profile: LearnerProfile,
  minutes: SessionMinutes,
  upgrades: BankItem[],
  records: LearningRecord[],
  support: Support,
  date = localDate(),
): DailySession {
  const recall = selectRecall(records, date);
  const focus = recall?.focus ?? chooseFocus(records, date);
  const reviewLimit =
    (minutes === 3 ? 1 : minutes === 10 ? 3 : 5) - (recall ? 1 : 0);
  const reviewIds = upgrades
    .filter((item) => item.due <= date)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, reviewLimit)
    .map((item) => item.id);
  const daySeed = Number(date.replaceAll("-", ""));
  return {
    id: makeId(),
    date,
    profile: structuredClone(profile),
    minutes,
    topic: profile.interests[daySeed % profile.interests.length],
    focus,
    support,
    stage: recall ? "recall" : reviewIds.length ? "review" : "read",
    recall,
    reuseTargets: selectReuseTargets(
      upgrades,
      records,
      date,
      minutes === 3 || ["A1", "A2"].includes(profile.levels.writing) ? 1 : 2,
      focus,
    ),
    lesson: null,
    reviewIds,
    reviewedIds: [],
    reviewDraft: "",
    reviewRevealed: false,
    writing: emptyWriting(),
    difficulty: null,
    completedAt: null,
  };
}

export function toRecord(session: DailySession): LearningRecord | null {
  if (!session.lesson || !session.writing.feedback || !session.difficulty)
    return null;
  return {
    id: session.id,
    date: session.date,
    title: session.lesson.title,
    prompt: session.lesson.prompt,
    original: session.writing.draft,
    revision: session.writing.hint ? session.writing.revision : "",
    feedback: session.writing.feedback,
    minutes: session.minutes,
    reviewed: session.reviewedIds.length,
    focus: session.focus,
    difficulty: session.difficulty,
    writingLevel: session.profile.levels.writing,
    readingLevel: session.profile.levels.reading,
    recall: session.recall ? structuredClone(session.recall) : null,
    reuseTargets: structuredClone(session.reuseTargets ?? []),
  };
}

export function weeklyDays(
  records: LearningRecord[],
  now = new Date(),
): number {
  const start = new Date(now);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const first = localDate(start);
  const last = localDate(now);
  return new Set(
    records
      .filter((record) => record.date >= first && record.date <= last)
      .map((record) => record.date),
  ).size;
}

export function upgradeKey(
  upgrade: Pick<UpgradeSuggestion, "original" | "native">,
): string {
  return `${upgrade.original.trim().toLowerCase()}|${upgrade.native.trim().toLowerCase()}`;
}

export function addUpgrades(
  bank: BankItem[],
  suggestions: UpgradeSuggestion[],
  focus: string,
  date = localDate(),
): BankItem[] {
  const keys = new Set(bank.map(upgradeKey));
  const additions: BankItem[] = [];
  for (const suggestion of suggestions) {
    const key = upgradeKey(suggestion);
    if (keys.has(key)) continue;
    keys.add(key);
    additions.push({
      ...suggestion,
      id: makeId(),
      kind: "upgrade",
      focus,
      createdAt: date,
      reps: 0,
      interval: 0,
      ease: 2.5,
      due: date,
    });
  }
  return [...bank, ...additions];
}
