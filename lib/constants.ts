import type { UpgradeType } from "@/lib/types";

export interface Focus {
  id: string;
  label: string;
  blurb: string;
}

export type PromptItem = string | { text: string; seconds: number };

export interface Level {
  id: string;
  ielts: string;
  note?: string;
}

export const FOCI: Focus[] = [
  {
    id: "formal",
    label: "Formal & professional",
    blurb: "Emails, updates, pushback, feedback.",
  },
  {
    id: "banter",
    label: "Casual banter & humor",
    blurb: "The register drills don't teach.",
  },
  {
    id: "listening",
    label: "Everyday expressions",
    blurb: "Decode implied meaning in written dialogue.",
  },
  {
    id: "speaking",
    label: "Think on your feet",
    blurb: "Timed writing. Formulate a quick reply.",
  },
  {
    id: "byo",
    label: "Your own text",
    blurb: "Paste real writing you want to sharpen.",
  },
];

export const PROMPTS: Record<string, PromptItem[]> = {
  formal: [
    "Decline a meeting request politely and propose a specific alternative time. 3–4 sentences.",
    "Summarize a technical decision for a non-technical stakeholder. 3 sentences, no jargon.",
    "Push back on an unrealistic deadline — firm but collaborative, not defensive.",
    "Ask a senior colleague for feedback on your work without sounding insecure or needy.",
    "Tell a stakeholder a project has slipped, and why, without making excuses.",
  ],
  banter: [
    "A teammate messages “Monday again 😩”. Reply with something light and funny.",
    "A friend cancels dinner last-minute for the second time. Reply playfully, not passive-aggressively.",
    "Write a witty one-line caption for a photo of a dinner you badly burnt.",
    "Someone teases you for being addicted to coffee. Fire back with good-natured banter.",
    "React to a friend's terrible pun — groan, but make the groan itself funny.",
  ],
  listening: [
    "Make this sound conversational and relaxed: “I do not think I will be able to attend this evening.”",
    "Rewrite as actually spoken: “It is not entirely clear to me what you are trying to communicate.”",
    "Turn into relaxed, connected speech: “I am going to go to the shop. Do you want anything?”",
    "Decode the meaning: “Ngl that whole meeting kinda went over my head, I was proper lost.”",
    "What does this actually mean: “I'm not being funny, but that's a bit much, innit.”",
  ],
  speaking: [
    {
      text: "Tell a friend what you did at work today. Type it as you'd say it — don't edit.",
      seconds: 60,
    },
    {
      text: "Explain what your job is to someone who knows nothing about tech.",
      seconds: 60,
    },
    { text: "Recommend a place to eat in your city, and why.", seconds: 45 },
    {
      text: "Describe a problem you solved recently. Use conversational sentences.",
      seconds: 60,
    },
    { text: "Convince a friend to watch a show you love.", seconds: 45 },
  ],
  byo: [
    "Paste anything you wrote — an email, a message, a script, a post — and explore ways to make it more effective.",
  ],
};

// CEFR ladder, with the rough IELTS band each maps to (for a familiar label only).
export const LEVELS: Level[] = [
  { id: "A1", ielts: "—" },
  { id: "A2", ielts: "—" },
  { id: "B1", ielts: "4–5" },
  { id: "B2", ielts: "5.5–6.5" },
  { id: "C1", ielts: "7–8" },
  { id: "C2", ielts: "8.5–9" },
];

export const TYPE_STYLES: Record<string, string> = {
  collocation: "bg-amber-50 text-amber-800 border-amber-200",
  register: "bg-violet-50 text-violet-800 border-violet-200",
  idiom: "bg-teal-50 text-teal-800 border-teal-200",
  "word-choice": "bg-sky-50 text-sky-800 border-sky-200",
  grammar: "bg-rose-50 text-rose-800 border-rose-200",
  rhythm: "bg-emerald-50 text-emerald-800 border-emerald-200",
  vocab: "bg-indigo-50 text-indigo-800 border-indigo-200",
};

export function typeClass(t: UpgradeType | string): string {
  return TYPE_STYLES[t] || "bg-slate-100 text-slate-700 border-slate-200";
}
