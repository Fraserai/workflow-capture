import { TraceCard } from "@/components/trace-card";
import { getTasks } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const traces = await getTasks();

  return (
    <div className="page-stack">
      <section className="content-panel">
        <div className="section-header">
          <div>
            <div className="eyebrow">Task traces</div>
            <h2>Normalized workflows</h2>
            <p>Deterministic first-pass traces grouped into reusable steps for downstream agent training and evaluation.</p>
          </div>
        </div>

        {traces.length ? (
          <div className="trace-grid">
            {traces.map((trace) => (
              <TraceCard key={trace.id} trace={trace} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No normalized traces yet</h3>
            <p>Normalize a session from the detail page and it will appear here as an AI-ready task trace.</p>
          </div>
        )}
      </section>
    </div>
  );
}
