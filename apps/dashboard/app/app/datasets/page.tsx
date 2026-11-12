import Link from "next/link";

import { NormalizeButton } from "@/components/normalize-button";
import { TraceCard } from "@/components/trace-card";
import { API_BASE_URL, getSessions, getTasks } from "@/lib/api";
import { formatCaptureDuration, formatCompactNumber, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DatasetsPage() {
  const [sessions, traces] = await Promise.all([getSessions(), getTasks()]);
  const normalizedCount = sessions.filter((session) => session.latestTaskTraceId).length;

  return (
    <div className="console-page">
      <header className="page-header">
        <div>
          <h1>Datasets</h1>
        </div>
      </header>

      <div className="dataset-summary">
        <article className="summary-card">
          <span>Captures</span>
          <strong>{formatCompactNumber(sessions.length)}</strong>
        </article>
        <article className="summary-card">
          <span>Datasets</span>
          <strong>{formatCompactNumber(normalizedCount)}</strong>
        </article>
        <article className="summary-card">
          <span>Exports</span>
          <strong>{formatCompactNumber(sessions.length)}</strong>
        </article>
      </div>

      <section className="dataset-layout">
        <div className="workspace-frame dataset-column">
          <div className="section-label">Ready to export</div>
          <div className="dataset-card-list">
            {sessions.length ? (
              sessions.map((session) => (
                <article key={session.id} className="dataset-row">
                  <div className="dataset-row-copy">
                    <h3>{session.employeeIdentifier}</h3>
                    <p>
                      {formatDateTime(session.startedAt)} · {formatCaptureDuration(session.startedAt, session.endedAt)}
                    </p>
                  </div>
                  <div className="dataset-row-actions">
                    {session.latestTaskTraceId ? (
                      <Link className="secondary-action small" href={`/app/captures?selected=${encodeURIComponent(session.id)}`}>
                        Review
                      </Link>
                    ) : (
                      <NormalizeButton sessionId={session.id} label="Create Dataset" />
                    )}
                    <a className="primary-action inline" href={`${API_BASE_URL}/exports/${session.id}.jsonl`}>
                      Export JSONL
                    </a>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-panel">
                <h3>No captures yet</h3>
                <p>Datasets appear here after worker captures land.</p>
              </div>
            )}
          </div>
        </div>

        <div className="workspace-frame dataset-column">
          <div className="section-label">Normalized</div>
          {traces.length ? (
            <div className="trace-grid compact">
              {traces.map((trace) => (
                <TraceCard key={trace.id} trace={trace} />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <h3>No datasets yet</h3>
              <p>Create a dataset from a capture and it will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
