"use client";

import { useEffect, useMemo, useState } from "react";

import type { SessionReplay } from "@workflow-capture-ai/schema";

import { assetUrl } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type ReplayTimelineProps = {
  replay: SessionReplay;
};

export function ReplayTimeline({ replay }: ReplayTimelineProps) {
  const timeline = replay.timeline;
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying || timeline.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= timeline.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1200);

    return () => window.clearInterval(timer);
  }, [isPlaying, timeline.length]);

  const current = useMemo(() => timeline[index] ?? null, [timeline, index]);

  if (!timeline.length || !current) {
    return (
      <div className="empty-state">
        <h3>No replay events yet</h3>
        <p>This session has not uploaded any event data.</p>
      </div>
    );
  }

  return (
    <div className="replay-shell">
      <div className="replay-stage">
        {current.screenshot ? (
          <img
            src={assetUrl(current.screenshot.url)}
            alt={`Replay screenshot ${current.screenshot.id}`}
            className="replay-image"
          />
        ) : (
          <div className="replay-placeholder">No screenshot attached to this moment in the timeline.</div>
        )}

        <div className="replay-meta">
          <div className="replay-meta-row">
            <span>Event</span>
            <strong>{current.event.eventType}</strong>
          </div>
          <div className="replay-meta-row">
            <span>Window</span>
            <strong>{current.event.windowTitle || "Unknown window"}</strong>
          </div>
          <div className="replay-meta-row">
            <span>Time</span>
            <strong>{formatDateTime(current.event.occurredAt)}</strong>
          </div>
        </div>
      </div>

      <div className="replay-sidebar">
        <div className="replay-controls">
          <button className="button button-secondary" onClick={() => setIndex((currentIndex) => Math.max(currentIndex - 1, 0))}>
            Previous
          </button>
          <button className="button button-primary" onClick={() => setIsPlaying((currentValue) => !currentValue)}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            className="button button-secondary"
            onClick={() => setIndex((currentIndex) => Math.min(currentIndex + 1, timeline.length - 1))}
          >
            Next
          </button>
        </div>

        <div className="timeline-list">
          {timeline.map((entry, entryIndex) => (
            <button
              key={entry.event.id}
              className={entryIndex === index ? "timeline-item active" : "timeline-item"}
              onClick={() => {
                setIsPlaying(false);
                setIndex(entryIndex);
              }}
            >
              <div className="timeline-item-title">
                {entry.event.eventType} · {entry.event.appName || "Unknown app"}
              </div>
              <div className="timeline-item-detail">{entry.event.windowTitle || entry.event.domain || "No title"}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
