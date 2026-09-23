import type {
  BankItem,
  ExpressionCheck,
  LearningRecord,
  RecallChallenge,
  ReuseTarget,
  UpgradeType,
} from "./types";

// Normalise punctuation/case without matching a phrase inside another word.
const words = (text: string): string =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim();
export function containsPhrase(text: string, phrase: string): boolean {
  const term = words(phrase);
  return !!term && ` ${words(text)} `.includes(` ${term} `);
}
const elapsedDays = (earlier: string, later: string): number =>
  Math.floor(
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) /
      86400000,
  );

export function selectRecall(
  records: LearningRecord[],
  date: string,
): RecallChallenge | null {
  const candidates = new Map<
    string,
    { challenge: RecallChallenge; count: number; missed: boolean }
  >();
  const history = records
    .filter((record) => record.date < date)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const record of history.slice(-30)) {
    const seen = new Set<string>();
    const corrected = record.feedback.practiceCorrection;
    const suggestions = [
      ...(record.feedback.upgrades ?? []).map((item) => ({
        item,
        source: record.revision || record.original,
      })),
      ...(corrected && containsPhrase(record.revision, corrected.native)
        ? [{ item: corrected, source: record.original }]
        : []),
    ];
    for (const { item, source } of suggestions) {
      if (
        item.category !== "correction" ||
        !item.original.trim() ||
        !item.native.trim()
      )
        continue;
      // Only practise a correction attached to words the learner actually wrote.
      if (!containsPhrase(source, item.original)) continue;
      const key = `${words(item.original)}|${words(item.native)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.set(key, {
        count: (candidates.get(key)?.count ?? 0) + 1,
        missed: false,
        challenge: {
          key,
          sourceId: record.id,
          sourceDate: record.date,
          original: item.original,
          suggestion: item.native,
          reason: item.why,
          context: record.prompt,
          focus: item.type,
          attempt: "",
          revealed: false,
          outcome: null,
        },
      });
    }
  }
  const due = [...candidates.values()].filter((candidate) => {
    const attempts = history.filter(
      (record) =>
        record.recall?.key === candidate.challenge.key &&
        record.recall.outcome &&
        record.date > candidate.challenge.sourceDate,
    );
    const last = attempts.at(-1);
    if (!last) return true;
    candidate.missed = last.recall?.outcome === "again";
    let successes = 0;
    for (const record of [...attempts].reverse()) {
      if (record.recall?.outcome !== "remembered") break;
      successes++;
    }
    const wait = successes >= 2 ? 7 : successes === 1 ? 3 : 1;
    return elapsedDays(last.date, date) >= wait;
  });
  due.sort(
    (a, b) =>
      Number(b.missed) - Number(a.missed) ||
      b.count - a.count ||
      b.challenge.sourceDate.localeCompare(a.challenge.sourceDate),
  );
  return due[0]?.challenge ?? null;
}

export function selectReuseTargets(
  bank: BankItem[],
  records: LearningRecord[],
  date: string,
  limit: number,
  focus: UpgradeType,
): ReuseTarget[] {
  const uses = new Map<string, number>();
  for (const record of records.filter((record) => record.date < date)) {
    for (const check of record.feedback.expressionChecks ?? []) {
      if (check.status === "used" || check.status === "variation")
        uses.set(check.id, (uses.get(check.id) ?? 0) + 1);
    }
  }
  const seen = new Set<string>();
  return [...bank]
    .filter((item) => item.createdAt < date)
    .sort(
      (a, b) =>
        (uses.get(a.id) ?? 0) - (uses.get(b.id) ?? 0) ||
        Number(b.type === focus) - Number(a.type === focus) ||
        a.due.localeCompare(b.due),
    )
    .flatMap((item) => {
      // Vocab cards store the expression in original, its definition in native.
      const phrase = (
        item.kind === "vocab" ? item.original : item.native
      ).trim();
      const key = words(phrase);
      if (
        !key ||
        phrase.length > 100 ||
        key.split(" ").length > 12 ||
        seen.has(key)
      )
        return [];
      seen.add(key);
      return [
        {
          id: item.id,
          phrase,
          meaning: item.kind === "vocab" ? item.native : item.why,
          savedOn: item.createdAt,
        },
      ];
    })
    .slice(0, limit);
}

// AI judges appropriateness, but it cannot earn credit with invented quotes or
// with a phrase appearing only in the task, hint, or model's suggested rewrite.
export function validateExpressionChecks(
  value: unknown,
  targets: ReuseTarget[],
  draft: string,
  revision?: string,
): ExpressionCheck[] {
  if (!targets.length) return [];
  if (!Array.isArray(value) || value.length !== targets.length)
    throw new Error(
      "The expression check was incomplete. Please retry; your response is saved.",
    );
  return targets.map((target) => {
    const matches = value.filter((item) => item && item.id === target.id);
    const item = matches[0];
    if (
      matches.length !== 1 ||
      !["used", "retry", "not-used"].includes(item.status) ||
      typeof item.note !== "string" ||
      !item.note.trim()
    )
      throw new Error("The expression check was incomplete. Please retry.");
    if (item.status === "not-used")
      return {
        id: target.id,
        phrase: target.phrase,
        status: "not-used",
        source: null,
        evidence: "",
        note: item.note,
      };
    const text =
      item.source === "draft"
        ? draft
        : item.source === "revision"
          ? revision
          : undefined;
    if (
      typeof text !== "string" ||
      typeof item.evidence !== "string" ||
      !item.evidence.trim() ||
      !text.includes(item.evidence)
    )
      throw new Error(
        "The coach’s expression evidence did not match your response. Please retry.",
      );
    return {
      id: target.id,
      phrase: target.phrase,
      // Allow natural inflections/paraphrases without blocking all feedback.
      // Only the exact saved phrase earns the conservative phrase-use count.
      status:
        item.status === "used" && !containsPhrase(item.evidence, target.phrase)
          ? "variation"
          : item.status,
      source: item.source,
      evidence: item.evidence,
      note: item.note,
    };
  });
}

export function loopProgress(records: LearningRecord[]) {
  const seen = new Set<string>();
  let recalled = 0;
  const phrases = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    if (
      record.recall?.outcome === "remembered" &&
      record.recall.attempt.trim() &&
      record.recall.sourceDate < record.date
    )
      recalled++;
    for (const check of record.feedback.expressionChecks ?? []) {
      if (
        check.status === "used" &&
        check.source === "draft" &&
        record.original.includes(check.evidence) &&
        containsPhrase(check.evidence, check.phrase)
      )
        phrases.add(words(check.phrase));
    }
  }
  return { recalled, phrases: phrases.size };
}
