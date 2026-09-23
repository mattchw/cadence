import { withAuth } from "next-auth/middleware";
import { validAccountId } from "@/lib/auth-policy";

// This is a navigation guard. Each data/AI route also authenticates independently.
export default withAuth({
  pages: { signIn: "/login" },
  callbacks: { authorized: ({ token }) => validAccountId(token?.accountId) },
});
export const config = { matcher: ["/"] };
