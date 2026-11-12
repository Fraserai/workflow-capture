import type { TaskTrace } from "@workflow-capture-ai/schema";

import { formatDateTime, formatDuration } from "@/lib/format";

type TraceCardProps = {
  trace: TaskTrace;
};

export function TraceCard({ trace }: TraceCardProps) {
  return (
    <article className="trace-surface">
      <div className="trace-head">
        <div>
          <h3>{trace.inferredTaskName}</h3>
          <div className="trace-subtle">{trace.taskId}</div>
        </div>
        <div className="trace-chip">{formatDuration(trace.durationSeconds)}</div>
      </div>

      <div className="trace-meta">
        <span>{trace.outcome}</span>
        <span>{formatDateTime(trace.updatedAt)}</span>
      </div>

      <div className="trace-step-list">
        {trace.steps.slice(0, 4).map((step) => (
          <div key={`${trace.id}-${step.stepIndex}`} className="trace-step-row">
            <div className="step-marker">{step.stepIndex}</div>
            <div>
              <div className="step-title">
                {step.action} · {step.app}
              </div>
              <div className="step-subtle">{step.target}</div>
              <div className="step-subtle">
                Evidence: {step.evidence.length ? step.evidence.join(", ") : "No screenshots linked"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
