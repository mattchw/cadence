import type { LearnerProfile, LearningRecord, WeeklyMission } from "./types";

export const MISSION_CHAPTERS = [
  {
    day: "Mon",
    title: "Make your proposal",
    objective:
      "Propose a clear plan and explain why it matters to the other person.",
  },
  {
    day: "Tue",
    title: "Handle an objection",
    objective:
      "Respond to a concern raised by the other person while keeping the conversation constructive.",
  },
  {
    day: "Wed",
    title: "Read between the lines",
    objective:
      "Identify what a politely worded response implies and answer its underlying concern.",
  },
  {
    day: "Thu",
    title: "Find common ground",
    objective: "Negotiate a practical compromise and make the trade-off clear.",
  },
  {
    day: "Fri–Sun",
    title: "Handle the unexpected",
    objective:
      "Apply the week's communication skills to an unfamiliar objection with a different audience or constraint. Respond without hints.",
  },
] as const;
const STORIES: Record<
  LearnerProfile["goal"],
  { title: string; setting: string }[]
> = {
  work: [
    {
      title: "Get your proposal approved",
      setting:
        "You and your colleague Alex are proposing a small pilot project. Manager Sam supports the idea but has concerns about time and budget.",
    },
    {
      title: "Bring a team together",
      setting:
        "You and colleague Alex need to agree on a team event. Manager Sam wants it to be useful and inclusive without disrupting work.",
    },
  ],
  everyday: [
    {
      title: "Make a shared plan happen",
      setting:
        "You and your friend Alex are organising a weekend activity. Your friend Sam has different preferences and a limited budget.",
    },
    {
      title: "Make your neighbourhood better",
      setting:
        "You and neighbour Alex propose a small community event. Organiser Sam is concerned about noise, cost, and who will feel welcome.",
    },
  ],
  study: [
    {
      title: "Win support for your idea",
      setting:
        "You and classmate Alex propose a group research topic. Tutor Sam wants a clear question and a realistic plan.",
    },
    {
      title: "Make a case worth hearing",
      setting:
        "You and classmate Alex are planning a student discussion. Tutor Sam wants competing views represented fairly and a manageable scope.",
    },
  ],
};

export function missionWeek(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}

export function weeklyMission(
  profile: LearnerProfile,
  records: LearningRecord[],
  date: string,
): WeeklyMission {
  const weekStart = missionWeek(date);
  const episode = Math.min(
    4,
    (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7,
  );
  const prior = records
    .filter(
      (record) => record.date < date && record.mission?.weekStart === weekStart,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const existing = prior[0]?.mission;
  const options = STORIES[profile.goal];
  const seed = Math.floor(
    Date.parse(`${weekStart}T12:00:00Z`) / (7 * 86400000),
  );
  const story =
    existing ??
    options[((seed % options.length) + options.length) % options.length];
  const previous = new Map<number, WeeklyMission["previous"][number]>();
  for (const record of prior) {
    if (record.mission!.episode >= episode) continue;
    previous.set(record.mission!.episode, {
      episode: record.mission!.episode,
      title: record.title,
      response: (record.revision || record.original).slice(0, 1200),
      prompt: record.prompt.slice(0, 800),
      passage: record.passage?.slice(0, 1500),
      focus: record.focus,
    });
  }
  return {
    weekStart,
    title: story.title,
    setting: story.setting,
    episode,
    chapterTitle: MISSION_CHAPTERS[episode].title,
    objective: MISSION_CHAPTERS[episode].objective,
    mode: episode === 4 ? "independent" : "guided",
    previous: [...previous.values()],
  };
}

export function completedChapters(
  records: LearningRecord[],
  weekStart: string,
): Set<number> {
  return new Set(
    records
      .filter((record) => record.mission?.weekStart === weekStart)
      .map((record) => record.mission!.episode),
  );
}
