"use client";
import { useState } from "react";

export default function Login() {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pass) return;
    setBusy(true);
    setErr(false);
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: pass }),
    });
    setBusy(false);
    if (r.ok) window.location.href = "/";
    else setErr(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans">
      <div className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Cadence</h1>
        <p className="mb-4 text-sm text-slate-500">Enter your passphrase.</p>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
          placeholder="Passphrase"
          autoFocus
        />
        {err && <p className="mt-2 text-xs text-rose-600">Incorrect passphrase.</p>}
        <button
          onClick={submit}
          disabled={busy || !pass}
          className="mt-4 w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </div>
    </div>
  );
}
