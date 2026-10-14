// Optimistic checks only: reads the signed cookie without touching the database.
// Real authorization happens in src/lib/dal.ts.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decrypt } from "@/lib/jwt";
import { ROLE_HOME } from "@/lib/roles";

const PROTECTED = ["/dashboard", "/admin", "/landlord", "/tenant"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
