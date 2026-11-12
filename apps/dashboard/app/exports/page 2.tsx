import { getSessions, API_BASE_URL } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  const sessions = await getSessions();

  return (
    <div className="page-stack">
      <section className="content-panel">
        <div className="section-header">
          <div>
            <div className="eyebrow">Exports</div>
            <h2>Training and evaluation datasets</h2>
            <p>Session-level evidence and normalized task traces are emitted as JSONL for downstream AI agent pipelines.</p>
          </div>
        </div>

        <div className="export-grid">
          {sessions.map((session) => (
            <div key={session.id} className="export-card">
              <div>
                <div className="eyebrow">Session</div>
                <h3>{session.id}</h3>
                <p>
                  {session.employeeIdentifier} · {formatDateTime(session.startedAt)}
                </p>
              </div>
              <div className="export-details">
                <span>{session.eventCount} raw events</span>
                <span>{session.screenshotCount} screenshots</span>
                <span>{session.latestTaskTraceId ? "Includes normalized trace" : "Trace generated on demand"}</span>
              </div>
              <a className="button button-primary" href={`${API_BASE_URL}/exports/${session.id}.jsonl`}>
                Download JSONL
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
