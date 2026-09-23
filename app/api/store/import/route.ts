import { currentUser } from "@/lib/auth";
import { accountRepository } from "@/lib/redis-store";
import { createImportHandler } from "@/lib/server-store";
export const runtime = "nodejs";
export const POST = createImportHandler({
  user: currentUser,
  repository: accountRepository,
});
