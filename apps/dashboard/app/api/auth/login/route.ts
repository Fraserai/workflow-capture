import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE } from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const nextPath = String(formData.get("next") ?? "/app/captures");

  if (!email || !password) {
    return NextResponse.redirect(new URL("/login?error=missing", request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL(nextPath || "/app/captures", request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
  return response;
}
