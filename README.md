# Cadence

Daily English practice that fits your level and your life. Built with Next.js 15, React 19, and TypeScript.

## Daily practice

- **Today:** choose a flexible 3-, 10-, or 20-minute session. Recall up to 1, 3, or 5 due expressions, read an original scenario, write a response, try a revision, and finish with a difficulty check-in.
- **My profile:** separate A1–C2 self-estimates for reading, writing, listening, and speaking; a target level; everyday/work/study goals; up to six interests; preferred session time; and a weekly goal.
- **Guided feedback:** receive one specific strength and a hint before a suggested rewrite. Try again, compare your attempts, and save useful expressions. Direct feedback is also available.
- **Calendar:** browse months, see completed Today practice days, check weekly and monthly totals, and select a date to revisit saved attempts and feedback. Existing history appears automatically. Drafts and standalone practice activities are not counted.
- **Progress:** daily-session history keeps the prompt, original response, revision, and feedback. The weekly goal counts unique completed days, starting on Monday. A missed day does not erase that progress.
- **Adaptation:** three consecutive easy or hard reflections at the same reading and writing levels adjust the suggested support. Repeated corrections across recent sessions influence the next focus. Learners can override the support setting; the app never automatically awards a CEFR level.
- **Resume:** the active daily session, review position, draft, hint, revision, and feedback are saved. An unfinished session can be completed on a later day and counts towards that day's weekly goal.

## A daily loop built from your own English

New Today sessions connect earlier practice to a fresh task:

1. **Recall a past correction.** If one is due, rewrite your earlier wording before revealing the feedback. Only actual corrections quoted from your writing are eligible; optional alternatives are not treated as mistakes. Mark recall yourself or skip it. Successful recalls become eligible after three, then seven days; a missed or skipped recall is eligible the next day. One correction replaces a bank review so short sessions stay short.
2. **Practise it in a different situation.** The scenario receives the specific correction and your level, interests, and time budget. At C1/C2, tasks can involve diplomatic disagreement, audience changes, concise rewriting, or balanced arguments.
3. **Put saved expressions to work.** Use one older expression in a short/beginner session, or up to two in a longer session. The coach checks fit and meaning. Credit requires an exact quote from your writing containing the expression; words appearing only in the model’s rewrite cannot earn credit. Natural variants receive feedback as related phrasing without earning the exact-expression count. Leaving out an unsuitable expression is allowed.
4. **Notice a concrete change.** Completion shows your own first attempt and revision, the coach’s observation, and phrase-use evidence. Progress separates self-assessed delayed recall from prompted phrase use in a first draft; neither is a proficiency or mastery score.

Recall drafts, choices, target expressions, and results use the existing account database and resume across browsers after syncing. History retains the evidence. Existing saved sessions still finish normally; the new loop starts with the next session. New accounts build a personal recall pool as they complete practice and save expressions. No new environment variables are required.

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

Open http://localhost:3000 and choose **Continue with Google**. Sign in with the same Google account in each browser to load the same progress.

```bash
npm test           # Domain, account isolation, persistence, and React interaction tests
npm run typecheck  # TypeScript
npm run build      # Production build
```

Tests use mocked identity, AI, and database services. They cover user isolation, unauthorized access, stale-account tabs, conflicting writes, loading in a browser with no local storage, draft recovery, migration, and sign-out saving. Live Google OAuth still requires your own configured Google client.

## Google sign-in on Vercel

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configure the OAuth consent screen, then create an **OAuth client ID** with application type **Web application**. While the consent screen is in Testing, add your Google account as a test user.
2. Add this exact **Authorized redirect URI**, replacing the domain with your actual deployment domain:

   ```text
   https://YOUR-DOMAIN/api/auth/callback/google
   ```

   For local development, also register `http://localhost:3000/api/auth/callback/google`. Use a stable domain for a preview deployment; every callback domain must be registered with Google. [Google provider setup](https://next-auth.js.org/providers/google)

3. In Vercel's project environment variables, configure the values below for Production (and separately for Preview if used). Set `NEXTAUTH_URL` to that environment's public origin, without a trailing path.
4. Deploy the updated code. Remove the old `APP_PASSPHRASE` and `AUTH_TOKEN` variables: this version no longer uses them.

| Variable               | Purpose                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth Web application client ID.                                                                 |
| `GOOGLE_CLIENT_SECRET` | Its client secret.                                                                                      |
| `NEXTAUTH_URL`         | Public origin, e.g. `https://your-app.vercel.app`. Locally use `http://localhost:3000`.                 |
| `NEXTAUTH_SECRET`      | A long random authentication secret. Generate with `openssl rand -hex 32`.                              |
| `KV_REST_API_URL`      | **Required:** the Upstash Redis REST endpoint.                                                          |
| `KV_REST_API_TOKEN`    | **Required:** its read/write REST token.                                                                |
| `ANTHROPIC_API_KEY`    | Powers lessons, hints, and feedback.                                                                    |
| `LEGACY_OWNER_EMAIL`   | Optional, temporary: permits only this verified Google email to import the old shared database records. |

Use these names exactly, without `NEXT_PUBLIC_`. Keep secrets in `.env.local` or Vercel's environment settings.

Authentication uses NextAuth's Google OAuth provider and encrypted session cookies. Only verified Google identities are accepted. Database ownership derives from Google's stable account ID in the verified session, never from a user ID supplied in a request. The learning data is persisted in Redis; the browser's authentication cookie is not the progress database. The app requests only Google's basic identity scopes (`openid email profile`).

## If progress will not load after signing in

Google sign-in and database access are separate. A successful login followed by “Let’s reconnect to your progress” means the account records could not be loaded; it does not mean your saved progress is empty.

The app reads `KV_REST_API_URL` and `KV_REST_API_TOKEN` directly from the Vercel database integration. Ensure both are enabled for the deployment environment. The old `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` variables are no longer used and can be removed. Use the HTTPS REST URL, not `KV_URL` or `REDIS_URL`, and the read/write token, not `KV_REST_API_READ_ONLY_TOKEN`. Redeploy after environment changes, then retry loading progress.

Missing and malformed settings now have specific messages. Other database failures remain a general connection error; check the database status and credentials. Initial-load retries fetch the records again; they do not create empty replacement records.

## How account saving works

Profile settings, phrase-bank cards, practice totals, daily drafts, feedback, and completed-session history are saved in Redis under separate keys for each Google account. Progress has no application expiry or TTL. Use a durable Redis database with an appropriate retention/eviction policy and backups for your deployment; deleting or resetting that database removes the saved account records.

On sign-in, the app reads the account's database records. If the database cannot be reached, it shows a retry screen instead of loading an empty workspace that could overwrite existing progress. A different Google account has its own independent progress.

While editing, changes are copied immediately into an **account-scoped device recovery buffer** and sent to the database after a short debounce. The account panel shows **Saving to your account**, **Saved to your account**, or an explicit error. Wait for **Saved to your account** before switching browsers. Failed saves retry on reconnect, window focus, and periodically while the app is open. Signing out first attempts to save; if saving fails, you can explicitly leave the changes on that device and sign out anyway.

Old browser data never automatically replaces a newer database record. Atomic version checks detect concurrent edits. If two browsers change the same category, the app asks whether to use the account version or keep this browser's version. The latter deliberately replaces that category in the account. Different categories save independently. A tab from a previously signed-in account cannot write into the new account after an account switch.

## Bring existing progress into Google sign-in

Import **before saving new progress in the new account**. Imports are atomic and only allowed into an empty account, so an existing account is never silently overwritten.

- **Progress in the old browser:** open the same site origin in the same browser, sign in, and choose **Import my browser progress** in the account panel. The old browser records are retained; a local marker prevents offering the same import again after success.
- **Progress in the old shared Redis database:** keep the existing Upstash database and temporarily set `LEGACY_OWNER_EMAIL` to the original owner's Google email. Sign in with that email and choose **Import my previous database progress**. Remove `LEGACY_OWNER_EMAIL` after importing. Other Google users cannot access or claim those shared records, and the old records are retained as a migration backup.

If both sources contain progress, choose the one you want before beginning new practice. Importing does not merge two existing accounts. Data from a different browser or origin can only be recovered by returning to the original browser/origin, or from the old Redis database if it had already synced.

## Code map

```text
app/page.tsx                 Server-side Google session check
components/cadence.tsx       App navigation, learning state, exercises, review, bank
components/account-shell.tsx Google sign-out integration
components/account-status.tsx Account identity, sync status, recovery/import actions
components/today.tsx         Daily session and progress history
components/daily-loop.tsx    Personal recall, phrase reuse, evidence, progress
components/profile.tsx       Learner preferences
components/practice.tsx      Level-aware practice prompts and timed writing
components/writing-coach.tsx Shared hint, revision, and feedback flow
lib/learning.ts              Session planning, adaptation, progress, batch saves
lib/daily-loop.ts            Recall scheduling, target selection, evidence checks
lib/ai.ts                    AI prompts, response validation, API client
lib/storage.ts               Account-scoped recovery, versioned database sync
lib/auth.ts                  Google provider and verified server session
lib/server-store.ts          Authenticated storage/import handlers
lib/redis-store.ts           Atomic Redis writes and empty-account import
lib/sr.ts                    Spaced repetition and local calendar dates
lib/cefr.ts                  Approximate readability metrics
lib/types.ts                 Shared domain types
app/api/ai/route.ts          Authenticated AI proxy
app/api/store/route.ts       Required account-scoped Redis storage
app/api/auth/[...nextauth]/route.ts Google OAuth endpoints
```

Existing shared records are retained for explicit migration. New database keys are `cadence:user:google:<Google account ID>:<category>` for `upgrades`, `stats`, `profile`, and `learning`. Device recovery copies use `cadence:account:<encoded account ID>:cadence:<category>`. The model is configured in `lib/ai.ts`.

## Deploy

Install dependencies and run a production build. Deploy the updated repository to Vercel with the Google, authentication, Redis, and AI environment variables above. Register the deployed domain's exact OAuth callback with Google. The existing PWA manifest supports adding the app to a phone's home screen; sign-in, account loading, and AI features need a network connection.
