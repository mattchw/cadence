// Shared domain types for Cadence.

export type Kind = "upgrade" | "vocab";

export type UpgradeType =
  | "collocation"
  | "register"
  | "idiom"
  | "word-choice"
  | "grammar"
  | "rhythm"
  | "vocab";

export type Grade = "again" | "good" | "easy";

/** One card in the spaced-repetition bank (a native upgrade or a vocab item). */
export interface BankItem {
  id: string;
  kind: Kind;
  original: string;
  native: string;
  why: string;
  type: UpgradeType;
  focus: string;
  cefr?: string;
  createdAt: string;
  reps: number;
  interval: number;
  ease: number;
  due: string;
}

export interface Stats {
  sessions: number;
  lastDate: string;
  streak: number;
}

/** A single suggested upgrade returned by the feedback model. */
export interface UpgradeSuggestion {
  original: string;
  native: string;
  why: string;
  type: UpgradeType;
  category?: "correction" | "alternative";
}

export interface Feedback {
  rewrite?: string;
  naturalness?: number;
  verdict?: string;
  upgrades?: UpgradeSuggestion[];
  native_move?: string;
  qualities?: {
    clarity: string;
    accuracy: string;
    precision: string;
    appropriateness: string;
  };
  improvement?: string;
  next_step?: string;
}

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type Skill = "reading" | "writing" | "listening" | "speaking";
export type SessionMinutes = 3 | 10 | 20;
export type Support = "supported" | "balanced" | "stretch";
export type Difficulty = "easy" | "right" | "hard";

export interface LearnerProfile {
  levels: Record<Skill, CEFRLevel>;
  target: CEFRLevel;
  goal: "everyday" | "work" | "study";
  interests: string[];
  minutes: SessionMinutes;
  weeklyGoal: number;
  configured: boolean;
}

export interface CoachingHint {
  strength: string;
  focus: UpgradeType;
  category: "correction" | "alternative";
  excerpt: string;
  hint: string;
}

export interface WritingState {
  draft: string;
  revision: string;
  hint: CoachingHint | null;
  feedback: Feedback | null;
}

export interface DailyLesson {
  title: string;
  passage: string;
  prompt: string;
  support: string;
  successCriteria: string[];
}

export interface DailySession {
  id: string;
  date: string;
  profile: LearnerProfile;
  minutes: SessionMinutes;
  topic: string;
  focus: UpgradeType;
  support: Support;
  stage: "review" | "read" | "write" | "reflect" | "complete";
  lesson: DailyLesson | null;
  reviewIds: string[];
  reviewedIds: string[];
  reviewDraft: string;
  reviewRevealed: boolean;
  writing: WritingState;
  difficulty: Difficulty | null;
  completedAt: string | null;
}

export interface LearningRecord {
  id: string;
  date: string;
  title: string;
  prompt: string;
  original: string;
  revision: string;
  feedback: Feedback;
  minutes: SessionMinutes;
  reviewed: number;
  focus: UpgradeType;
  difficulty: Difficulty;
  writingLevel: CEFRLevel;
  readingLevel: CEFRLevel;
}

export interface VocabItem {
  term: string;
  cefr: string;
  meaning: string;
  example?: string;
}

export interface ComprehensionItem {
  q: string;
  a: string;
}

export interface ClozeItem {
  text: string;
  answer: string;
  hint?: string;
}

export interface Analysis {
  estimated_cefr?: string;
  note?: string;
  vocab?: VocabItem[];
  comprehension?: ComprehensionItem[];
  cloze?: ClozeItem[];
  paraphrase?: string;
}

export interface Passage {
  text: string;
  /** true = grounded via web search, false = model knowledge, null = pasted. */
  webVerified: boolean | null;
}

export interface Metrics {
  words: number;
  sentences: number;
  fk: number;
  ease: number;
  avgLen: number;
  diversity: number;
  cefr: string;
}
