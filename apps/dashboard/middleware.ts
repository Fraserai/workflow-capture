import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isAuthenticatedRequest } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const authenticated = isAuthenticatedRequest(request);

  if (pathname === "/login") {
    if (authenticated) {
      return NextResponse.redirect(new URL("/app/captures", request.url));
    }
    return NextResponse.next();
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
