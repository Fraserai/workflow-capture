import type { TaskTrace } from "@workflow-capture-ai/schema";

import { formatDateTime, formatDuration } from "@/lib/format";

type TraceCardProps = {
  trace: TaskTrace;
};

export function TraceCard({ trace }: TraceCardProps) {
  return (
    <div className="trace-card">
      <div className="trace-header">
        <div>
          <div className="eyebrow">Normalized trace</div>
          <h3>{trace.inferredTaskName}</h3>
        </div>
        <div className="trace-badge">{formatDuration(trace.durationSeconds)}</div>
      </div>

      <div className="trace-meta">
        <span>{trace.taskId}</span>
        <span>{trace.outcome}</span>
        <span>{formatDateTime(trace.updatedAt)}</span>
      </div>

      <div className="step-list">
        {trace.steps.map((step) => (
          <div className="step-card" key={`${trace.id}-${step.stepIndex}`}>
            <div className="step-index">{step.stepIndex}</div>
            <div>
              <div className="step-title">
                {step.action} in {step.app}
              </div>
              <div className="step-target">{step.target}</div>
              <div className="step-evidence">Evidence: {step.evidence.length ? step.evidence.join(", ") : "No screenshots linked"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
