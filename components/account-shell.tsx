"use client";
import { signOut } from "next-auth/react";
import Cadence from "@/components/cadence";
import type { AccountUser } from "@/lib/auth-policy";
export function AccountShell({
  user,
  legacyCloudAvailable,
}: {
  user: AccountUser;
  legacyCloudAvailable: boolean;
}) {
  return (
    <Cadence
      user={user}
      legacyCloudAvailable={legacyCloudAvailable}
      onSignOut={async () => {
        await signOut({ callbackUrl: "/login" });
      }}
    />
  );
}
