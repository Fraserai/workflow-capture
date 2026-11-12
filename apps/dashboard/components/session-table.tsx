import Link from "next/link";

import type { SessionSummary } from "@workflow-capture-ai/schema";

import { API_BASE_URL } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

type SessionTableProps = {
  sessions: SessionSummary[];
};

export function SessionTable({ sessions }: SessionTableProps) {
  if (!sessions.length) {
    return (
      <div className="empty-panel">
        <h3>No sessions captured yet</h3>
        <p>Once worker devices begin capturing approved workflows, they will appear here for replay, normalization, and export.</p>
      </div>
    );
  }

  return (
    <div className="table-surface">
      <table className="data-table">
        <thead>
          <tr>
            <th>Session</th>
            <th>Operator</th>
            <th>Status</th>
            <th>Evidence</th>
            <th>Started</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>
                <div className="table-title">{session.id}</div>
                <div className="table-subtle">{session.machineName}</div>
              </td>
              <td>
                <div className="table-title">{session.employeeIdentifier}</div>
                <div className="table-subtle">{session.os}</div>
              </td>
              <td>
                <StatusBadge status={session.status} />
              </td>
              <td>
                <div className="table-title">{session.eventCount} events</div>
                <div className="table-subtle">{session.screenshotCount} screenshots</div>
              </td>
              <td>
                <div className="table-title">{formatDateTime(session.startedAt)}</div>
                <div className="table-subtle">{session.endedAt ? `Ended ${formatDateTime(session.endedAt)}` : "Still active"}</div>
              </td>
              <td>
                <div className="inline-actions">
                  <Link href={`/app/sessions/${session.id}`} className="text-action">
                    Open
                  </Link>
                  <a href={`${API_BASE_URL}/exports/${session.id}.jsonl`} className="text-action">
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
