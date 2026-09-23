"use client";
import { useState } from "react";
import {
  CheckCircle2,
  CloudOff,
  Loader2,
  LogOut,
  RefreshCw,
} from "lucide-react";
import {
  accountIsEmpty,
  importProgress,
  legacyBrowserEntries,
  resolveConflict,
  retrySync,
  type syncState,
} from "@/lib/storage";
import type { AccountUser } from "@/lib/auth-policy";

const LABELS = {
  "cadence:upgrades": "Phrase bank",
  "cadence:stats": "Practice totals",
  "cadence:profile": "Learner profile",
  "cadence:learning": "Daily sessions and history",
};
export function AccountStatus({
  user,
  state,
  ready,
  legacyCloudAvailable,
  onSignOut,
  signingOut,
}: {
  user: AccountUser;
  state: ReturnType<typeof syncState>;
  ready: boolean;
  legacyCloudAvailable: boolean;
  onSignOut: (leaveUnsynced?: boolean) => Promise<void>;
  signingOut: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not complete that action. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  const legacyBrowser = ready && Object.keys(legacyBrowserEntries()).length > 0;
  const canImport =
    ready &&
    accountIsEmpty() &&
    !dismissed &&
    (legacyBrowser || legacyCloudAvailable);
  return (
    <section
      className="mb-5 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      aria-label="Account and saved progress"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all text-xs font-medium text-slate-700">
            {user.email || user.name || "Google account"}
          </p>
          <p
            role="status"
            className={`mt-1 flex items-center gap-1.5 text-xs ${state.status === "saved" ? "text-teal-700" : "text-slate-500"}`}
          >
            {state.status === "saved" ? (
              <CheckCircle2 size={13} />
            ) : state.status === "saving" || state.status === "loading" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <CloudOff size={13} />
            )}
            {state.message}
          </p>
        </div>
        <button
          className="text-xs font-medium text-slate-600 underline underline-offset-4 disabled:opacity-40"
          disabled={signingOut || busy}
          onClick={() => void onSignOut()}
        >
          <span className="flex items-center gap-1.5">
            <LogOut size={13} />
            {signingOut ? "Saving…" : "Sign out"}
          </span>
        </button>
      </div>
      {(state.status === "error" || state.status === "conflict") && (
        <div className="flex flex-wrap gap-4">
          <button
            className="text-xs font-semibold text-teal-700 disabled:opacity-40"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                if (!(await retrySync()))
                  throw new Error(
                    "Still unable to save. Check your connection and retry before changing browsers.",
                  );
              })
            }
          >
            <span className="flex items-center gap-1">
              <RefreshCw size={13} /> Retry saving
            </span>
          </button>
          <button
            className="text-xs text-slate-500 underline underline-offset-4"
            disabled={signingOut}
            onClick={() => void onSignOut(true)}
          >
            Sign out without syncing
          </button>
        </div>
      )}
      {state.status === "account-changed" && (
        <button
          className="secondary-button"
          onClick={() => window.location.reload()}
        >
          Reload and sign in
        </button>
      )}
      {state.conflicts.map((key) => (
        <div key={key} className="rounded-lg bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">{LABELS[key]}</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900">
            Another browser saved a different version. Using the account version
            discards this browser’s unsynced changes for this category. Keeping
            this browser replaces that category in your account.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              className="text-xs font-semibold text-teal-800 disabled:opacity-40"
              disabled={busy}
              onClick={() => void act(() => resolveConflict(key, "cloud"))}
            >
              Use account version
            </button>
            <button
              className="text-xs font-semibold text-amber-900 disabled:opacity-40"
              disabled={busy}
              onClick={() => void act(() => resolveConflict(key, "device"))}
            >
              Keep this browser’s version
            </button>
          </div>
        </div>
      ))}
      {canImport && (
        <div className="rounded-lg bg-teal-50 p-4">
          <p className="text-sm font-semibold text-teal-900">
            Bring your previous progress with you
          </p>
          <p className="mt-1 text-xs leading-relaxed text-teal-800">
            Import your progress from before Google sign-in into{" "}
            {user.email || "this account"}. Imports are available only before
            this account has saved new progress.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {legacyBrowser && (
              <button
                className="text-xs font-semibold text-teal-800 disabled:opacity-40"
                disabled={busy}
                onClick={() => void act(() => importProgress("browser"))}
              >
                Import my browser progress
              </button>
            )}
            {legacyCloudAvailable && (
              <button
                className="text-xs font-semibold text-teal-800 disabled:opacity-40"
                disabled={busy}
                onClick={() => void act(() => importProgress("cloud"))}
              >
                Import my previous database progress
              </button>
            )}
            <button
              className="text-xs text-slate-500"
              onClick={() => setDismissed(true)}
            >
              Not now
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs leading-relaxed text-rose-800">
          {error}
        </p>
      )}
    </section>
  );
}
