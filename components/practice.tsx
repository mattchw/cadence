"use client";
import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw, Timer } from "lucide-react";
import { FOCI, PROMPTS } from "@/lib/constants";
import { emptyWriting } from "@/lib/learning";
import { WritingCoach } from "@/components/writing-coach";
import type { BankItem, LearnerProfile, UpgradeSuggestion } from "@/lib/types";

function promptFor(focus: string, profile: LearnerProfile) {
  const topic =
    profile.interests[Math.floor(Math.random() * profile.interests.length)] ||
    "everyday life";
  const level = profile.levels.writing;
  if (focus === "byo")
    return {
      text: "Paste something you wrote. Explain who it is for if that helps set the context.",
      seconds: 0,
    };
  if (level === "A1" || level === "A2") {
    const prompts: Record<string, string[]> = {
      formal: [
        "Ask a colleague for help. Write 1–2 short sentences. You can start: ‘Can you help me with…?’",
        "Ask when a meeting starts. Write a short, polite message.",
      ],
      banter: [
        `Tell a friend one thing you like about ${topic}. Start with ‘I like… because…’`,
        "Invite a friend to have a coffee. Suggest a day.",
      ],
      listening: [
        "Your friend writes: ‘See you in a bit!’ What do they mean? Write one short sentence.",
        "Someone says ‘No worries’ after you say sorry. What do they mean?",
      ],
      speaking: [
        "Write two short sentences about your day.",
        `Tell a friend one thing you enjoy about ${topic}.`,
      ],
    };
    const pool = prompts[focus];
    return {
      text: pool[Math.floor(Math.random() * pool.length)],
      seconds: focus === "speaking" ? 90 : 0,
    };
  }
  if (level === "B1" || level === "B2") {
    const prompts: Record<string, string[]> = {
      formal: [
        "Ask to move a meeting to another day. Explain why and offer a new time. Write 3–4 sentences.",
        "Explain a small problem at work and suggest a practical solution.",
      ],
      banter: [
        `Recommend something related to ${topic} to a friend. Explain why they might enjoy it.`,
        "A friend has had a tiring week. Write a warm message and suggest something fun.",
      ],
      listening: [
        "A colleague says: ‘Let’s sleep on it.’ What do they want to do, and why might they say this?",
        "A friend says: ‘That’s easier said than done.’ Explain what they mean in your own words.",
      ],
      speaking: [
        `Explain why you enjoy ${topic}. Give a specific example.`,
        "Describe a small problem you solved recently, and what you learned.",
      ],
    };
    const pool = prompts[focus];
    return {
      text: pool[Math.floor(Math.random() * pool.length)],
      seconds: focus === "speaking" ? 75 : 0,
    };
  }
  const pool = PROMPTS[focus];
  const item = pool[Math.floor(Math.random() * pool.length)];
  return typeof item === "string" ? { text: item, seconds: 0 } : item;
}
export function Practice({
  profile,
  bank,
  onSave,
  onComplete,
}: {
  profile: LearnerProfile;
  bank: BankItem[];
  onSave: (items: UpgradeSuggestion[], focus: string) => void;
  onComplete: () => void;
}) {
  const [focus, setFocus] = useState("formal");
  const [prompt, setPrompt] = useState(() => promptFor("formal", profile));
  const [writing, setWriting] = useState(emptyWriting);
  const [round, setRound] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === null) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [deadline]);
  const next = (newFocus = focus) => {
    setFocus(newFocus);
    setPrompt(promptFor(newFocus, profile));
    setWriting(emptyWriting());
    setRound((value) => value + 1);
    setDeadline(null);
    setRemaining(null);
  };
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Room to experiment</p>
        <h2 className="mt-2 font-serif text-3xl">Find the words you need.</h2>
        <p className="mt-2 text-sm text-slate-500">
          Writing at {profile.levels.writing}, working towards {profile.target}.
          Choose a situation and give it a try.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FOCI.map((item) => (
          <button
            key={item.id}
            aria-pressed={focus === item.id}
            onClick={() => next(item.id)}
            className={`rounded-xl border p-3 text-left ${focus === item.id ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-700"}`}
          >
            <span className="block text-sm font-semibold">{item.label}</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
              {item.blurb}
            </span>
          </button>
        ))}
      </div>
      <section className="panel space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-xl leading-relaxed">{prompt.text}</h3>
          {focus !== "byo" && (
            <button
              aria-label="New prompt"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              onClick={() => next()}
            >
              <RotateCcw size={17} />
            </button>
          )}
        </div>
        {prompt.seconds > 0 && !writing.hint && !writing.feedback && (
          <div className="flex flex-wrap items-center gap-3">
            {remaining === null ? (
              <button
                className="secondary-button"
                onClick={() => setDeadline(Date.now() + prompt.seconds * 1000)}
              >
                <Timer size={16} /> Start {prompt.seconds}s timer
              </button>
            ) : (
              <span className="text-sm font-medium text-teal-800">
                {remaining > 0
                  ? `${remaining}s left`
                  : "Time’s up. See what you can learn from your first attempt."}
              </span>
            )}
            <span className="text-xs text-slate-500">
              An optional timer for a quick written reply.
            </span>
          </div>
        )}
        <WritingCoach
          key={round}
          task={prompt.text}
          focus={focus}
          profile={profile}
          value={writing}
          onChange={setWriting}
          bank={bank}
          onSave={(items) => onSave(items, focus)}
          onFeedback={onComplete}
          locked={remaining === 0}
        />
        {writing.feedback && (
          <button className="secondary-button" onClick={() => next()}>
            Try another prompt <ArrowRight size={16} />
          </button>
        )}
      </section>
    </div>
  );
}
