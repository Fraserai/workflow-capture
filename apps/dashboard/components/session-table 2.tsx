import Link from "next/link";

import type { SessionSummary } from "@workflow-capture-ai/schema";

import { formatDateTime } from "@/lib/format";
import { StatusChip } from "@/components/status-chip";
import { API_BASE_URL } from "@/lib/api";

type SessionTableProps = {
  sessions: SessionSummary[];
};

export function SessionTable({ sessions }: SessionTableProps) {
  if (!sessions.length) {
    return (
      <div className="empty-state">
        <h3>No sessions captured yet</h3>
        <p>Start the recorder, perform a workflow, and the session stream will appear here for review and export.</p>
      </div>
    );
  }

  return (
    <div className="table-shell">
      <table className="session-table">
        <thead>
          <tr>
            <th>Session</th>
            <th>Operator</th>
            <th>Status</th>
            <th>Started</th>
            <th>Evidence</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>
                <div className="table-strong">{session.id}</div>
                <div className="table-muted">{session.machineName}</div>
              </td>
              <td>
                <div className="table-strong">{session.employeeIdentifier}</div>
                <div className="table-muted">{session.os}</div>
              </td>
              <td>
                <StatusChip status={session.status} />
              </td>
              <td>
                <div className="table-strong">{formatDateTime(session.startedAt)}</div>
                <div className="table-muted">{session.endedAt ? `Ended ${formatDateTime(session.endedAt)}` : "Still active"}</div>
              </td>
              <td>
                <div className="table-strong">{session.eventCount} events</div>
                <div className="table-muted">{session.screenshotCount} screenshots</div>
              </td>
              <td>
                <div className="row-actions">
                  <Link href={`/sessions/${session.id}`} className="inline-link">
                    Open
                  </Link>
                  <a href={`${API_BASE_URL}/exports/${session.id}.jsonl`} className="inline-link">
                    JSONL
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
