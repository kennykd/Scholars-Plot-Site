import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Pages where a logged-in user should be bounced to /dashboard
const AUTH_PAGES = ["/login", "/register"];
// All paths that don't require authentication (includes API routes)
// const PUBLIC_PATHS = ["/login", "/register", "/api/auth"];
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/tasks",
  "/study",
  "/projects",
  "/calendar",
  "/analytics",
  "/settings",
];
const HIDDEN_PATHS = ["/docs", "/api/docs"];

// TODO: add production domain later for CORS.
const ALLOWED_ORIGINS = ["http://localhost:3000", "https://e2526-wads-b4bc-05.csbihub.id/"];
const BLOCKED_UA_PATTERNS = ["python-requests", "scrapy", "wget"];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  // // Hidden / blocked routes, comment them out if you want to use them
  const isHidden = HIDDEN_PATHS.some((p) => pathname.startsWith(p));
  if (isHidden) {
    return NextResponse.rewrite(new URL("/_not-found", request.url));
  }

  // CORS Options
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: getCorsHeaders(origin),
    });
  }

  // Bot control
  const ua = request.headers.get("user-agent") ?? "";
  const isBotBlocked = BLOCKED_UA_PATTERNS.some((p) =>
    ua.toLowerCase().includes(p),
  );
  if (isBotBlocked) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Auth Redirection
  const session = request.cookies.get("session")?.value;
  const isLoggedIn = Boolean(session);

  // const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isLoggedIn && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Security Headers
  const response = NextResponse.next();

  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
