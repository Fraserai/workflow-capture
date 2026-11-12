import { MetricCard } from "@/components/metric-card";
import { SessionTable } from "@/components/session-table";
import { getSessions } from "@/lib/api";
import { formatCompactNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const sessions = await getSessions();
  const totalEvents = sessions.reduce((sum, session) => sum + session.eventCount, 0);
  const totalScreenshots = sessions.reduce((sum, session) => sum + session.screenshotCount, 0);
  const processedSessions = sessions.filter((session) => session.latestTaskTraceId).length;

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Sessions</div>
          <h2>Review every captured workflow run from recorder ingest through replay.</h2>
          <p>
            This dashboard is optimized for internal enterprise operations teams who need to validate raw evidence before
            normalizing it into AI training traces.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricCard label="Captured sessions" value={formatCompactNumber(sessions.length)} detail="Recording runs uploaded to the platform" />
          <MetricCard label="Raw events" value={formatCompactNumber(totalEvents)} detail="Mouse, keyboard class, and window/navigation events" />
          <MetricCard label="Screenshots" value={formatCompactNumber(totalScreenshots)} detail="Replay evidence retained on local storage" />
          <MetricCard label="Normalized" value={formatCompactNumber(processedSessions)} detail="Sessions converted to task traces" />
        </div>
      </section>

      <section className="content-panel">
        <div className="section-header">
          <div>
            <div className="eyebrow">Recording ledger</div>
            <h3>Latest sessions</h3>
          </div>
        </div>
        <SessionTable sessions={sessions} />
      </section>
    </div>
  );
}
