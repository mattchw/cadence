import { canImportSharedProgress } from "@/lib/auth-policy";
import { currentUser } from "@/lib/auth";
import { accountRepository, legacyCloudEntries } from "@/lib/redis-store";
import { privateJSON, requestProblem } from "@/lib/server-store";
import { STORE_KEYS, validStoredValue } from "@/lib/store-schema";

export const runtime = "nodejs";
// The old shared database has no ownership information. Only the explicitly
// designated, Google-verified owner may claim it; never the first random login.
export async function POST(req: Request): Promise<Response> {
  const user = await currentUser();
  const problem = requestProblem(req, user, true);
  if (problem || !user) return problem!;
  if (!canImportSharedProgress(user, process.env.LEGACY_OWNER_EMAIL))
    return privateJSON({ error: "forbidden" }, 403);
  try {
    const entries = await legacyCloudEntries();
    if (!Object.keys(entries).length)
      return privateJSON({ error: "no_legacy_progress" }, 404);
    if (
      !STORE_KEYS.every(
        (key) =>
          entries[key] === undefined || validStoredValue(key, entries[key]),
      )
    )
      return privateJSON({ error: "invalid_legacy_progress" }, 422);
    const imported = await accountRepository().importEmpty(user.id, entries);
    return imported
      ? privateJSON({ ok: true })
      : privateJSON({ error: "account_has_progress" }, 409);
  } catch {
    return privateJSON({ error: "database_unavailable" }, 503);
  }
}
