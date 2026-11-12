import Link from "next/link";

import { NormalizeButton } from "@/components/normalize-button";
import { ReplayTimeline } from "@/components/replay-timeline";
import { StatusBadge } from "@/components/status-badge";
import { API_BASE_URL, getReplay, getSession, getSessions } from "@/lib/api";
import { formatCaptureDuration, formatClockTime, formatDateLabel, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type CapturesPageProps = {
  searchParams: Promise<{ q?: string; selected?: string }>;
};

type SessionGroup = {
  label: string;
  sessions: Awaited<ReturnType<typeof getSessions>>;
};

function normalizeQuery(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

function buildGroups(sessions: Awaited<ReturnType<typeof getSessions>>): SessionGroup[] {
  const now = new Date();
  const todayKey = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = yesterday.toDateString();
  const buckets = new Map<string, Awaited<ReturnType<typeof getSessions>>>();

  for (const session of sessions) {
    const started = new Date(session.startedAt);
    const key = started.toDateString();
    const label = key === todayKey ? "Today" : key === yesterdayKey ? "Yesterday" : formatDateLabel(session.startedAt);
    const existing = buckets.get(label) || [];
    existing.push(session);
    buckets.set(label, existing);
  }

  return Array.from(buckets.entries()).map(([label, groupedSessions]) => ({
    label,
    sessions: groupedSessions,
  }));
}

export default async function CapturesPage({ searchParams }: CapturesPageProps) {
  const params = await searchParams;
  const query = normalizeQuery(params.q);
  const sessions = await getSessions();
  const filteredSessions = sessions.filter((session) => {
    if (!query) {
      return true;
    }

    return [session.id, session.employeeIdentifier, session.machineName, session.os, session.status].some((value) =>
      value.toLowerCase().includes(query),
    );
  });

  const selectedId =
    (params.selected && filteredSessions.find((session) => session.id === params.selected)?.id) || filteredSessions[0]?.id || null;
  const selectedSession = selectedId ? await getSession(selectedId) : null;
  const replay = selectedId ? await getReplay(selectedId) : null;
  const groups = buildGroups(filteredSessions);

  return (
    <div className="console-page">
      <header className="page-header">
        <div>
          <h1>Captures</h1>
        </div>
        <form className="toolbar-search" action="/app/captures" method="GET">
          {selectedId ? <input type="hidden" name="selected" value={selectedId} /> : null}
          <input name="q" defaultValue={params.q || ""} placeholder="Search captures" aria-label="Search captures" />
        </form>
      </header>

      <section className="workspace-frame captures-layout">
        <aside className="captures-sidebar">
          <div className="captures-toolbar">
            <div className="toolbar-chip">All</div>
            <div className="toolbar-chip quiet">{filteredSessions.length} captures</div>
          </div>

          <div className="capture-group-stack">
            {groups.length ? (
              groups.map((group) => (
                <section key={group.label} className="capture-group">
                  <div className="capture-group-label">{group.label}</div>
                  <div className="capture-list">
                    {group.sessions.map((session) => {
                      const href = query
                        ? `/app/captures?selected=${encodeURIComponent(session.id)}&q=${encodeURIComponent(params.q || "")}`
                        : `/app/captures?selected=${encodeURIComponent(session.id)}`;
                      const active = session.id === selectedId;

                      return (
                        <Link key={session.id} href={href} className={active ? "capture-row active" : "capture-row"}>
                          <div className="capture-thumb">
                            <div className={active ? "play-indicator visible" : "play-indicator"} />
                            <div className="capture-thumb-panel" />
                          </div>
                          <div className="capture-row-copy">
                            <div className="capture-row-top">
                              <strong>{formatClockTime(session.startedAt)}</strong>
                              <span>{formatCaptureDuration(session.startedAt, session.endedAt)}</span>
                            </div>
                            <div className="capture-row-subtle">{session.employeeIdentifier}</div>
                          </div>
                          <div className="capture-row-meta">
                            <span className="capture-device-dot" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className="empty-panel">
                <h3>No captures</h3>
                <p>Try a different search.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="capture-preview-panel">
          {selectedSession && replay ? (
            <>
              <div className="preview-head">
                <div>
                  <h2>Capture from {formatDateTime(selectedSession.startedAt)}</h2>
                </div>
                <div className="preview-actions">
                  <a className="secondary-action small" href={`${API_BASE_URL}/exports/${selectedSession.id}.jsonl`}>
                    Export
                  </a>
                  <NormalizeButton sessionId={selectedSession.id} label="Create Dataset" />
                </div>
              </div>

              <ReplayTimeline replay={replay} />

              <div className="preview-footer">
                <div className="preview-meta">
                  <StatusBadge status={selectedSession.status} />
                  <span>{selectedSession.employeeIdentifier}</span>
                  <span>{selectedSession.machineName}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-preview">
              <h3>No capture selected</h3>
              <p>Choose a capture to review replay and create a dataset.</p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
