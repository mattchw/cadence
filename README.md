# Cadence

Daily English practice that fits your level and your life. Built with Next.js 15, React 19, and TypeScript.

## Daily practice

- **Today:** choose a flexible 3-, 10-, or 20-minute session. Recall up to 1, 3, or 5 due expressions, read an original scenario, write a response, try a revision, and finish with a difficulty check-in.
- **My profile:** separate A1–C2 self-estimates for reading, writing, listening, and speaking; a target level; everyday/work/study goals; up to six interests; preferred session time; and a weekly goal.
- **Guided feedback:** receive one specific strength and a hint before a suggested rewrite. Try again, compare your attempts, and save useful expressions. Direct feedback is also available.
- **Progress:** daily-session history keeps the prompt, original response, revision, and feedback. The weekly goal counts unique completed days, starting on Monday. A missed day does not erase that progress.
- **Adaptation:** three consecutive easy or hard reflections at the same reading and writing levels adjust the suggested support. Repeated corrections across recent sessions influence the next focus. Learners can override the support setting; the app never automatically awards a CEFR level.
- **Resume:** the active daily session, review position, draft, hint, revision, and feedback are saved. An unfinished session can be completed on a later day and counts towards that day's weekly goal.

## Explore at your own pace

**Practice** offers professional messages, casual replies, written dialogue interpretation, timed writing, and your own text. Prompts and feedback use your writing level. **Exercises** generates or analyses pasted reading passages, with approximate difficulty estimates, vocabulary, comprehension, gap fills, and guided paraphrasing. **Review** offers bounded rounds of up to ten due expressions. **Bank** holds your saved expressions and spaced-repetition schedules.

Corrections and optional alternatives are labelled separately. Feedback covers clarity, accuracy, precision, and appropriateness; it does not assign a “native” score. CEFR options end at C2. Readability is a rough text estimate, not a learner assessment.

Audio recording, speech analysis, and listening playback are not included in this version. The corresponding profile levels are saved for future audio activities. Daily scenarios are original practice material, not verified news. Reading-workshop search grounding is labelled only when the API returns actual search results.

## Run locally

Use Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env.local
# Fill in the environment variables described below.
npm run dev
```

Open http://localhost:3000 and enter your configured passphrase.

```bash
npm test           # Domain, persistence, and React interaction tests
npm run typecheck  # TypeScript
npm run build      # Production build
```

Tests use mocked AI and storage responses and never call paid APIs. They cover bounded review queues, multi-level profiles, support adaptation, batch saves, calendar-based progress, interrupted-session recovery, completion deduplication, and error/retry flows. The React interaction tests run in JSDOM; they do not replace a real-browser visual check.

## Configuration

| Variable                   | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `ANTHROPIC_API_KEY`        | Powers lesson generation, hints, and feedback.           |
| `APP_PASSPHRASE`           | Passphrase for the app's login page.                     |
| `AUTH_TOKEN`               | A long random string used for the authentication cookie. |
| `UPSTASH_REDIS_REST_URL`   | Optional Redis endpoint for cross-device sync.           |
| `UPSTASH_REDIS_REST_TOKEN` | Optional Redis credentials for cross-device sync.        |

Generate an authentication token with `openssl rand -hex 32`. Keep credentials in `.env.local` or your hosting environment.

Without an AI key, the app shows an explicit configuration error and retains the current draft. Without Redis, it works with device storage and displays a sync notice. Device storage is tied to the browser and origin; clearing browser data removes unsynced work. Changes are copied locally immediately and cloud writes are coalesced and ordered. Dirty local copies are retried on return and take precedence over older cloud values. Simultaneous editing on multiple devices is not conflict-merged.

This is still a **personal deployment** with one shared passphrase, profile, and bank. Serving independent learners requires account authentication and per-user storage namespaces.

## Code map

```text
app/page.tsx                 App navigation, shared state, exercises, review, bank
components/today.tsx         Daily session and progress history
components/profile.tsx       Learner preferences
components/practice.tsx      Level-aware practice prompts and timed writing
components/writing-coach.tsx Shared hint, revision, and feedback flow
lib/learning.ts              Session planning, adaptation, progress, batch saves
lib/ai.ts                    AI prompts, response validation, API client
lib/storage.ts               Device backup and ordered cloud sync
lib/sr.ts                    Spaced repetition and local calendar dates
lib/cefr.ts                  Approximate readability metrics
lib/types.ts                 Shared domain types
app/api/ai/route.ts          Authenticated AI proxy
app/api/store/route.ts       Optional Redis storage
```

Existing `cadence:upgrades` and `cadence:stats` records are retained. New preferences use `cadence:profile`; daily sessions and history use `cadence:learning`. Device copies use the `cadence:device:` prefix. The model is configured in `lib/ai.ts`.

## Deploy

Set the environment variables on Vercel or another compatible Next.js host, install dependencies, and run a production build. Redis is needed for cross-device sync. The existing PWA manifest supports adding the app to a phone's home screen; AI features require a network connection.
