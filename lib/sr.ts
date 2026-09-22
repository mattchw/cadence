import type { BankItem, Grade } from "@/lib/types";

// ---------- date helpers ----------
export const todayStr = (): string => formatDate(new Date());

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const addDays = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return formatDate(d);
};

export const isDue = (i: BankItem): boolean => i.due <= todayStr();

// ---------- spaced repetition (SM-2-lite) ----------
export function schedule(item: BankItem, grade: Grade): BankItem {
  const it: BankItem = { ...item };
  if (grade === "again") {
    it.reps = 0;
    it.interval = 0;
    it.ease = Math.max(1.3, (it.ease || 2.5) - 0.2);
    it.due = todayStr();
  } else if (grade === "good") {
    it.reps = (it.reps || 0) + 1;
    it.interval =
      it.reps === 1
        ? 1
        : it.reps === 2
          ? 3
          : Math.round((it.interval || 1) * (it.ease || 2.5));
    it.due = addDays(it.interval);
  } else {
    it.reps = (it.reps || 0) + 1;
    it.ease = (it.ease || 2.5) + 0.15;
    it.interval =
      it.reps <= 1 ? 2 : Math.round((it.interval || 1) * it.ease * 1.3);
    it.due = addDays(it.interval);
  }
  return it;
}
