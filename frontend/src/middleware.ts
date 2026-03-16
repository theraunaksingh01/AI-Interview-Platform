import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public routes that don't require authentication.
 * The middleware checks for the presence of an access_token cookie
 * or a custom header — but since tokens are in localStorage (not cookies),
 * this middleware primarily handles static route gating for SSR pages.
 *
 * The real auth check happens client-side in AuthProvider.
 * This middleware provides a fast redirect for obvious unauthenticated requests.
 */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password", "/candidate"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Allow /candidate/* routes
  if (pathname.startsWith("/candidate/")) return true;
  // Allow interview join pages (candidate-facing)
  if (/^\/interview\/[^/]+\/join$/.test(pathname)) return true;
  // Static assets and API routes
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Check for token in cookie (set by AuthProvider sync, or manually)
  const token = request.cookies.get("access_token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|videos|images).*)",
  ],
};
