// Optimistic checks only: reads the signed cookie without touching the database.
// Real authorization happens in the API, checked again on every request.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decrypt } from "@/lib/jwt";
import { ROLE_HOME } from "@/lib/roles";

const PROTECTED = ["/dashboard", "/admin", "/landlord", "/tenant"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // The API turned this session down (see SESSION_ENDED in lib/api.ts): drop the cookie and show
  // the sign-in page instead of sending the visitor back to a dashboard that will refuse them.
  if (pathname === "/login" && searchParams.has("expired")) {
    const response = NextResponse.next();
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/dashboard" || AUTH_PAGES.includes(pathname))) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/landlord/:path*", "/tenant/:path*", "/login", "/signup"],
};
