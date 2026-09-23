import { currentUser } from "@/lib/auth";
import { privateJSON, requestProblem } from "@/lib/server-store";

export const runtime = "nodejs";

// The browser posts the same body it used in the sandbox (model, messages,
// tools, etc). We add the API key here so it never reaches the client.
export async function POST(req: Request): Promise<Response> {
  const problem = requestProblem(req, await currentUser(), true);
  if (problem) return problem;
  if (!process.env.ANTHROPIC_API_KEY) {
    return privateJSON({ error: "AI is not configured" }, 503);
  }
  const body: unknown = await req.json();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}
