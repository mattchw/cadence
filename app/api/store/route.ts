import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

// Values are wrapped as { s: <json-string> } so the exact string the client
// stored round-trips back untouched (no double-parsing by the Redis client).
export async function GET(req: Request): Promise<Response> {
  if (!redis)
    return NextResponse.json(
      { error: "Cloud sync is not configured" },
      { status: 503 },
    );
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return new NextResponse("missing key", { status: 400 });
  const doc = await redis.get<{ s: string }>(key);
  if (doc == null) return new NextResponse("not found", { status: 404 });
  return NextResponse.json({ key, value: doc.s });
}

export async function POST(req: Request): Promise<Response> {
  if (!redis)
    return NextResponse.json(
      { error: "Cloud sync is not configured" },
      { status: 503 },
    );
  const { key, value } = (await req.json()) as { key?: string; value?: string };
  if (!key) return new NextResponse("missing key", { status: 400 });
  await redis.set(key, { s: value ?? "" });
  return NextResponse.json({ key, value });
}
