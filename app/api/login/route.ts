import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const { passphrase } = (await req.json()) as { passphrase?: string };
  if (!passphrase || passphrase !== process.env.APP_PASSPHRASE) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("cadence_auth", process.env.AUTH_TOKEN ?? "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
