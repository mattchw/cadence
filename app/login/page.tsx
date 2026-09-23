"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

const ERRORS: Record<string, string> = {
  Configuration:
    "Google sign-in isn’t configured yet. Check the Google client credentials and authentication secret in your deployment settings.",
  AccessDenied:
    "Google could not verify this account. Try another Google account.",
  OAuthSignin: "Could not connect to Google. Please try again.",
  OAuthCallback: "Could not finish signing in. Please try again.",
  OAuthAccountNotLinked:
    "Please sign in using the Google account you used before.",
};
export default function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code)
      setError(ERRORS[code] ?? "Sign-in didn’t complete. Please try again.");
  }, []);
  const login = async () => {
    setBusy(true);
    setError("");
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch {
      setError(
        "Could not connect to Google. Check your connection and try again.",
      );
      setBusy(false);
    }
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="panel w-full max-w-md space-y-6">
        <div>
          <p className="eyebrow">Your English, wherever you are</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold">
            Cadence<span className="text-teal-600">.</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Sign in to keep your expressions, daily practice, and progress
            together. Pick up on another browser with the same Google account.
          </p>
        </div>
        <button
          className="secondary-button w-full"
          disabled={busy}
          onClick={login}
        >
          {busy ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 13.93a6 6 0 0 1 0-3.86V7.48H3.05a10 10 0 0 0 0 9.04l3.35-2.59Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.95c1.47 0 2.79.51 3.83 1.51L18.7 4.6A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.48l3.35 2.59C7.19 7.71 9.4 5.95 12 5.95Z"
              />
            </svg>
          )}
          {busy ? "Connecting to Google…" : "Continue with Google"}
        </button>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
          >
            {error}
          </p>
        )}
        <p className="text-xs leading-relaxed text-slate-500">
          Use the same account each time to see your saved progress.
        </p>
      </div>
    </main>
  );
}
