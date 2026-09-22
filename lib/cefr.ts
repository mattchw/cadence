import type { Metrics } from "@/lib/types";

const RANK: Record<string, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
  C2: 5,
  "C2+": 6,
};

export const rankOf = (lvl: string | null): number =>
  lvl && lvl in RANK ? RANK[lvl] : -1;

export function parseLevel(s: string | null | undefined): string | null {
  if (!s) return null;
  const up = String(s).toUpperCase();
  for (const id of ["C2+", "C2", "C1", "B2", "B1", "A2", "A1"]) {
    if (up.includes(id)) return id;
  }
  return null;
}

// ---------- rough readability estimate, not a proficiency assessment ----------
function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

export function readability(text: string): Metrics {
  const words = text.match(/[A-Za-z][A-Za-z'-]*/g) || [];
  const nW = words.length || 1;
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const nS = sentences.length || 1;
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const uniq = new Set(words.map((w) => w.toLowerCase())).size;
  const fk = 0.39 * (nW / nS) + 11.8 * (syl / nW) - 15.59;
  const ease = 206.835 - 1.015 * (nW / nS) - 84.6 * (syl / nW);
  let cefr = "C2";
  if (ease >= 80) cefr = "A2";
  else if (ease >= 70) cefr = "B1";
  else if (ease >= 58) cefr = "B2";
  else if (ease >= 40) cefr = "C1";
  else cefr = "C2";
  return {
    words: nW,
    sentences: nS,
    fk: Math.max(0, fk),
    ease,
    avgLen: nW / nS,
    diversity: uniq / nW,
    cefr,
  };
}
