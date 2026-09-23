import { canImportSharedProgress } from "@/lib/auth-policy";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AccountShell } from "@/components/account-shell";

export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <AccountShell
      user={user}
      legacyCloudAvailable={canImportSharedProgress(
        user,
        process.env.LEGACY_OWNER_EMAIL,
      )}
    />
  );
}
