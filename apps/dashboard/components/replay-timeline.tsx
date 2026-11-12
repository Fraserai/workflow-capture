"use client";

import { useEffect, useState } from "react";

import type { SessionReplay } from "@workflow-capture-ai/schema";

import { assetUrl } from "@/lib/api";
import { formatDateTime, formatElapsedSeconds } from "@/lib/format";

type ReplayTimelineProps = {
  replay: SessionReplay;
};

function summarizeEventType(value: string): string {
  if (value === "mouse_click") {
    return "Mouse click";
  }
  if (value === "navigation") {
    return "Navigate";
  }
  if (value === "keyboard") {
    return "Input";
  }
  return value.replace(/_/g, " ");
}

export function ReplayTimeline({ replay }: ReplayTimelineProps) {
  const timeline = replay.timeline;
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tab, setTab] = useState<"events" | "info">("events");

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
    }, 1300);

    return () => window.clearInterval(timer);
  }, [isPlaying, timeline.length]);

  const current = timeline[index] ?? null;

  if (!timeline.length || !current) {
    return (
      <div className="empty-panel">
        <h3>No replay events yet</h3>
        <p>This session has not uploaded replay-ready event data.</p>
      </div>
    );
  }

  const startedAt = new Date(timeline[0].event.occurredAt).getTime();
  const endedAt = new Date(timeline[timeline.length - 1].event.occurredAt).getTime();
  const currentAt = new Date(current.event.occurredAt).getTime();
  const currentSeconds = Math.max(0, Math.round((currentAt - startedAt) / 1000));
  const totalSeconds = Math.max(1, Math.round((endedAt - startedAt) / 1000));
  const progress = Math.min(100, Math.max(0, (currentSeconds / totalSeconds) * 100));

  return (
    <div className="capture-detail-stack">
      <div className="replay-stage">
        {current.screenshot ? (
          <img className="replay-image" src={assetUrl(current.screenshot.url)} alt={`Replay screenshot ${current.screenshot.id}`} />
        ) : (
          <div className="replay-placeholder">No screenshot</div>
        )}

        <div className="playback-bar">
          <button className="playback-button" onClick={() => setIsPlaying((currentValue) => !currentValue)}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <span className="playback-time">{formatElapsedSeconds(currentSeconds)}</span>
          <div className="playback-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className="playback-time">{formatElapsedSeconds(totalSeconds)}</span>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={tab === "events" ? "detail-tab active" : "detail-tab"} onClick={() => setTab("events")}>
          Events
        </button>
        <button className={tab === "info" ? "detail-tab active" : "detail-tab"} onClick={() => setTab("info")}>
          Info
        </button>
      </div>

      {tab === "events" ? (
        <div className="event-list">
          {timeline.map((entry, entryIndex) => {
            const eventSeconds = Math.max(0, Math.round((new Date(entry.event.occurredAt).getTime() - startedAt) / 1000));
            return (
              <button
                key={entry.event.id}
                className={entryIndex === index ? "event-row active" : "event-row"}
                onClick={() => {
                  setIsPlaying(false);
                  setIndex(entryIndex);
                }}
              >
                <span className="event-time">{formatElapsedSeconds(eventSeconds)}</span>
                <span className="event-icon">
                  {entry.event.eventType === "keyboard" ? "T" : entry.event.eventType === "navigation" ? "◎" : "↖"}
                </span>
                <div className="event-copy">
                  <strong>{summarizeEventType(entry.event.eventType)}</strong>
                  <span>{entry.event.windowTitle || entry.event.domain || entry.event.appName || "Untitled"}</span>
                </div>
                {entry.screenshot ? (
                  <img className="event-thumb" src={assetUrl(entry.screenshot.url)} alt={entry.screenshot.id} />
                ) : (
                  <span className="event-thumb placeholder" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="info-panel">
          <div className="info-stat">
            <span>App</span>
            <strong>{current.event.appName || "Unknown"}</strong>
          </div>
          <div className="info-stat">
            <span>Window</span>
            <strong>{current.event.windowTitle || "Untitled"}</strong>
          </div>
          <div className="info-stat">
            <span>Time</span>
            <strong>{formatDateTime(current.event.occurredAt)}</strong>
          </div>
          <div className="info-stat">
            <span>Event</span>
            <strong>{summarizeEventType(current.event.eventType)}</strong>
          </div>
          <div className="info-stat wide">
            <span>Target</span>
            <strong>{current.event.domain || current.event.windowTitle || current.event.appName || "Unavailable"}</strong>
          </div>
          <div className="detail-button-row">
            <button className="secondary-action small" onClick={() => setIndex((currentValue) => Math.max(currentValue - 1, 0))}>
              Previous
            </button>
            <button className="secondary-action small" onClick={() => setIndex((currentValue) => Math.min(currentValue + 1, timeline.length - 1))}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
