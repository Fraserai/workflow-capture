import Link from "next/link";

import { NormalizeButton } from "@/components/normalize-button";
import { ReplayTimeline } from "@/components/replay-timeline";
import { StatusChip } from "@/components/status-chip";
import { TraceCard } from "@/components/trace-card";
import { API_BASE_URL, getReplay, getSession } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type SessionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  const [session, replay] = await Promise.all([getSession(id), getReplay(id)]);

  return (
    <div className="page-stack">
      <section className="content-panel">
        <div className="section-header">
          <div>
            <div className="eyebrow">Session detail</div>
            <h2>{session.id}</h2>
            <p>
              {session.employeeIdentifier} on {session.machineName} · started {formatDateTime(session.startedAt)}
            </p>
          </div>
          <div className="button-row">
            <StatusChip status={session.status} />
            <NormalizeButton sessionId={session.id} />
            <a className="button button-secondary" href={`${API_BASE_URL}/exports/${session.id}.jsonl`}>
              Download JSONL
            </a>
          </div>
        </div>

        <div className="meta-grid">
          <div className="meta-card">
            <div className="eyebrow">Evidence</div>
            <div className="meta-value">{session.eventCount} events</div>
            <div className="meta-detail">{session.screenshotCount} screenshots</div>
          </div>
          <div className="meta-card">
            <div className="eyebrow">Window capture</div>
            <div className="meta-value">{replay.timeline[0]?.event.appName || "Unknown"}</div>
            <div className="meta-detail">{replay.timeline[0]?.event.windowTitle || "No active window recorded yet"}</div>
          </div>
          <div className="meta-card">
            <div className="eyebrow">Lifecycle</div>
            <div className="meta-value">{formatDateTime(session.startedAt)}</div>
            <div className="meta-detail">{session.endedAt ? `Ended ${formatDateTime(session.endedAt)}` : "Session still open"}</div>
          </div>
        </div>
      </section>

      <section className="content-panel">
        <div className="section-header">
          <div>
            <div className="eyebrow">Replay</div>
            <h3>Timeline player</h3>
          </div>
          <Link href="/" className="inline-link">
            Back to sessions
          </Link>
        </div>
        <ReplayTimeline replay={replay} />
      </section>

      <section className="content-panel">
        <div className="section-header">
          <div>
            <div className="eyebrow">Normalization output</div>
            <h3>Structured task trace</h3>
          </div>
        </div>
        {session.latestTaskTrace ? (
          <TraceCard trace={session.latestTaskTrace} />
        ) : (
          <div className="empty-state">
            <h3>No task trace generated yet</h3>
            <p>Run normalization to collapse raw events into step-level workflow instructions for AI training and evaluation.</p>
          </div>
        )}
      </section>
    </div>
  );
}
