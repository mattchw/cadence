import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import {
  googleIdentity,
  validAccountId,
  type AccountUser,
} from "@/lib/auth-policy";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: { scope: "openid email profile", prompt: "select_account" },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ account, profile }) {
      return !!googleIdentity(
        account,
        profile as { email_verified?: boolean } | undefined,
      );
    },
    async jwt({ token, account, profile }) {
      // Never accept an account ID from a client session update.
      if (account)
        token.accountId =
          googleIdentity(
            account,
            profile as { email_verified?: boolean } | undefined,
          ) ?? undefined;
      return token;
    },
    async session({ session, token }) {
      if (session.user && validAccountId(token.accountId))
        session.user.id = token.accountId;
      return session;
    },
  },
};

export async function currentUser(): Promise<AccountUser | null> {
  if (!process.env.NEXTAUTH_SECRET) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user || !validAccountId(session.user.id)) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
  };
}
