import type { SessionDetail, SessionReplay, SessionSummary, TaskTrace } from "@workflow-capture-ai/schema";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed for ${path}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function getSessions(): Promise<SessionSummary[]> {
  return request<SessionSummary[]>("/sessions");
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  return request<SessionDetail>(`/sessions/${sessionId}`);
}

export async function getReplay(sessionId: string): Promise<SessionReplay> {
  return request<SessionReplay>(`/sessions/${sessionId}/replay`);
}

export async function getTasks(): Promise<TaskTrace[]> {
  return request<TaskTrace[]>("/tasks");
}

export function assetUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
}
