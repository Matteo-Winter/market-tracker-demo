import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "market_tracker_auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicPath =
    pathname === "/login" ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/import/helium10") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(.*)$/);

  if (isPublicPath) {
    return NextResponse.next();
  }

  const authCookie = req.cookies.get(COOKIE_NAME)?.value;
  const expectedToken = process.env.SITE_AUTH_TOKEN;

  if (expectedToken && authCookie === expectedToken) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};