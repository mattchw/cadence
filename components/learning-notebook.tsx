"use client";
import { useState } from "react";
import { Search, ArrowRight, Check, Plus, BookOpen } from "lucide-react";
import { calendarRecords } from "@/lib/calendar";
import { localDate, FOCUS_LABELS, upgradeKey } from "@/lib/learning";
import type { BankItem, LearningRecord, UpgradeSuggestion } from "@/lib/types";

export function LearningNotebook({
  records,
  bank,
  onSave,
  onPractice,
}: {
  records: LearningRecord[];
  bank: BankItem[];
  onSave: (items: UpgradeSuggestion[], focus: string) => void;
  onPractice: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [visible, setVisible] = useState(10);
  const history = [...calendarRecords(records, localDate()).values()]
    .flat()
    .sort((a, b) => b.date.localeCompare(a.date));
  const saved = new Set(bank.map(upgradeKey));
  const matches = history.filter((record) => {
    if (filter === "independent" && record.mission?.mode !== "independent")
      return false;
    if (
      filter === "revised" &&
      (!record.revision.trim() ||
        record.revision.trim() === record.original.trim())
    )
      return false;
    return [
      record.title,
      record.prompt,
      record.original,
      record.revision,
      FOCUS_LABELS[record.focus],
      record.feedback.next_step,
      record.feedback.improvement,
      ...(record.feedback.upgrades ?? []).flatMap((item) => [
        item.original,
        item.native,
        item.why,
      ]),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });
  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-teal-100 bg-teal-50 p-6 sm:p-8">
        <p className="eyebrow">Your personal learning collection</p>
        <h2 className="mt-3 font-serif text-3xl sm:text-4xl">
          Learning Notebook
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Return to your words, notice what changed, and keep the language you
          want to use again. Every completed Today session is collected here.
        </p>
        <p className="mt-4 text-xs font-semibold text-teal-800">
          {history.length} saved {history.length === 1 ? "session" : "sessions"}{" "}
          · From your completed Today sessions
        </p>
      </header>
      <section className="panel space-y-4" aria-label="Find saved learning">
        <label
          htmlFor="notebook-search"
          className="block text-sm font-semibold"
        >
          Search your learning
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            size={18}
            className="absolute left-3 top-4 text-slate-400"
          />
          <input
            id="notebook-search"
            type="search"
            className="text-input pl-10"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(10);
            }}
            placeholder="A phrase, topic, correction, or skill…"
          />
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Session filters">
          {[
            ["all", "All sessions"],
            ["revised", "With revisions"],
            ["independent", "No-hints attempts"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setVisible(10);
              }}
              className={`rounded-full border px-4 py-2 text-xs font-semibold ${filter === value ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p role="status" className="text-xs text-slate-500">
          {matches.length} {matches.length === 1 ? "session" : "sessions"} found
        </p>
      </section>
      {!matches.length ? (
        <section className="panel py-10 text-center">
          <BookOpen size={28} className="mx-auto text-teal-600" />
          <h3 className="mt-4 font-serif text-2xl">
            {history.length
              ? "No matching sessions"
              : "A notebook that grows with you"}
          </h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            {history.length
              ? "Try another phrase or clear the filters to explore your saved work."
              : "Complete your first Today session to collect your response, revision, and feedback here."}
          </p>
          <button
            className="secondary-button mt-5"
            onClick={
              history.length
                ? () => {
                    setQuery("");
                    setFilter("all");
                  }
                : onPractice
            }
          >
            {history.length ? "Clear filters" : "Practise today"}
          </button>
        </section>
      ) : (
        <div className="space-y-4">
          {matches.slice(0, visible).map((record) => (
            <article key={record.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {new Date(`${record.date}T12:00:00`).toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "long", year: "numeric" },
                    )}{" "}
                    · {FOCUS_LABELS[record.focus]}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl">{record.title}</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  {record.mission?.mode === "independent"
                    ? "No-hints attempt"
                    : "Guided practice"}
                </span>
              </div>
              {record.feedback.next_step && (
                <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <strong>Try next:</strong> {record.feedback.next_step}
                </p>
              )}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-teal-800">
                  Open writing & feedback
                </summary>
                <div className="mt-5 space-y-5">
                  <p className="text-sm leading-6 text-slate-600">
                    {record.prompt}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <h4 className="text-xs font-semibold text-slate-500">
                        First attempt
                      </h4>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                        {record.original}
                      </p>
                    </div>
                    {record.revision && (
                      <div className="rounded-xl bg-teal-50 p-4">
                        <h4 className="text-xs font-semibold text-teal-800">
                          Your revision
                        </h4>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                          {record.revision}
                        </p>
                      </div>
                    )}
                  </div>
                  {record.feedback.improvement && (
                    <p className="text-sm leading-6 text-slate-600">
                      {record.feedback.improvement}
                    </p>
                  )}
                  {!!record.feedback.upgrades?.length && (
                    <div>
                      <h4 className="text-sm font-semibold">
                        Language to take with you
                      </h4>
                      <div className="mt-3 space-y-3">
                        {record.feedback.upgrades.map((item, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <span className="text-xs font-medium text-slate-500">
                              {item.category === "correction"
                                ? "Correction"
                                : "Alternative wording"}{" "}
                              · {FOCUS_LABELS[item.type]}
                            </span>
                            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                              <span>{item.original}</span>
                              <ArrowRight size={14} aria-hidden="true" />
                              <strong>{item.native}</strong>
                            </p>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              {item.why}
                            </p>
                            <button
                              className="secondary-button mt-3 text-xs"
                              disabled={saved.has(upgradeKey(item))}
                              onClick={() => onSave([item], record.focus)}
                            >
                              {saved.has(upgradeKey(item)) ? (
                                <>
                                  <Check size={14} />
                                  Saved to bank
                                </>
                              ) : (
                                <>
                                  <Plus size={14} />
                                  Save expression
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
      {matches.length > visible && (
        <button
          className="secondary-button"
          onClick={() => setVisible((count) => count + 10)}
        >
          Show more sessions ({matches.length - visible} remaining)
        </button>
      )}
    </div>
  );
}
