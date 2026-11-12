import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "workflow_capture_ai_session";
export const SESSION_COOKIE_VALUE = "authenticated";

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value === SESSION_COOKIE_VALUE;
}

export function isAuthenticatedRequest(request: NextRequest): boolean {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value === SESSION_COOKIE_VALUE;
}
