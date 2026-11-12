import type { Screenshot } from "@workflow-capture-ai/schema";

import { assetUrl } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type ScreenshotStripProps = {
  screenshots: Screenshot[];
};

export function ScreenshotStrip({ screenshots }: ScreenshotStripProps) {
  if (!screenshots.length) {
    return (
      <div className="empty-panel">
        <h3>No screenshots captured</h3>
        <p>Screenshot capture may be disabled for this session or evidence has not uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="screenshot-strip">
      {screenshots.map((screenshot) => (
        <article key={screenshot.id} className="screenshot-card">
          <img src={assetUrl(screenshot.url)} alt={screenshot.id} />
          <div className="screenshot-meta">
            <strong>{screenshot.id}</strong>
            <span>{formatDateTime(screenshot.occurredAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
