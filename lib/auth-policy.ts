// Identity comes exclusively from Google's verified OAuth response.
export interface AccountUser {
  id: string;
  name: string | null;
  email: string | null;
}

export function googleIdentity(
  account: { provider?: string; providerAccountId?: string } | null | undefined,
  profile: { email_verified?: boolean } | undefined,
): string | null {
  if (
    account?.provider !== "google" ||
    profile?.email_verified !== true ||
    !account.providerAccountId
  )
    return null;
  const id = `google:${account.providerAccountId}`;
  return validAccountId(id) ? id : null;
}

export function validAccountId(value: unknown): value is string {
  return (
    typeof value === "string" && /^google:[A-Za-z0-9_-]{1,255}$/.test(value)
  );
}

export function canImportSharedProgress(
  user: AccountUser,
  ownerEmail: string | undefined,
): boolean {
  const owner = ownerEmail?.trim().toLowerCase();
  return !!owner && user.email?.toLowerCase() === owner;
}
