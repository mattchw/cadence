import { currentUser } from "@/lib/auth";
import { accountRepository } from "@/lib/redis-store";
import { createStoreHandlers } from "@/lib/server-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = createStoreHandlers({
  user: currentUser,
  repository: accountRepository,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
