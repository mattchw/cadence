import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("cadence_auth")?.value;
  const authed = token && token === process.env.AUTH_TOKEN;
  if (authed) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

// Run on everything except the login page, the login API, and static assets.
export const config = {
  matcher: [
    "/((?!api/login|login|manifest.webmanifest|sw.js|icon-192.png|icon-512.png|apple-touch-icon.png|_next/static|_next/image|favicon.ico).*)",
  ],
};
