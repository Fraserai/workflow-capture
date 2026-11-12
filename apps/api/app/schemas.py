from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(item.capitalize() for item in tail)


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class SessionCreate(CamelModel):
    employee_identifier: str
    machine_name: str
    os: str
    status: str = "recording"
    started_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class StopSessionRequest(CamelModel):
    ended_at: datetime | None = None


class EventIn(CamelModel):
    occurred_at: datetime
    sequence_number: int
    event_type: str
    app_name: str | None = None
    process_name: str | None = None
    window_title: str | None = None
    url: str | None = None
    domain: str | None = None
    click_x: float | None = None
    click_y: float | None = None
    keyboard_class: str | None = None
    screenshot_ref: str | None = None
    redaction_status: str = "none"
    redaction_notes: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class EventBatchIn(CamelModel):
    events: list[EventIn]


class NormalizeRequest(CamelModel):
    session_id: str
    force: bool = False


class IngestionAck(CamelModel):
    accepted_count: int
    session_id: str


class SessionSummaryOut(CamelModel):
    id: str
    employee_identifier: str
    machine_name: str
    os: str
    status: str
    started_at: datetime
    ended_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    event_count: int
    screenshot_count: int
    latest_task_trace_id: str | None = None


class EventOut(CamelModel):
    id: str
    session_id: str
    occurred_at: datetime
    sequence_number: int
    event_type: str
    app_name: str | None = None
    process_name: str | None = None
    window_title: str | None = None
    url: str | None = None
    domain: str | None = None
    click_x: float | None = None
    click_y: float | None = None
    keyboard_class: str | None = None
    screenshot_ref: str | None = None
    redaction_status: str
    redaction_notes: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ScreenshotOut(CamelModel):
    id: str
    session_id: str
    occurred_at: datetime
    file_name: str
    relative_path: str
    url: str
    width: int | None = None
    height: int | None = None
    redaction_status: str
    created_at: datetime


class TaskStepOut(CamelModel):
    step_index: int
    action: str
    target: str
    app: str
    started_at: datetime
    ended_at: datetime
    evidence: list[str]
    event_ids: list[str]


class TaskTraceOut(CamelModel):
    id: str
    session_id: str
    task_id: str
    inferred_task_name: str
    duration_seconds: float
    outcome: str
    steps: list[TaskStepOut]
    created_at: datetime
    updated_at: datetime


class SessionDetailOut(SessionSummaryOut):
    events: list[EventOut]
    screenshots: list[ScreenshotOut]
    latest_task_trace: TaskTraceOut | None = None


class ReplayEntryOut(CamelModel):
    event: EventOut
    screenshot: ScreenshotOut | None = None


class SessionReplayOut(CamelModel):
    session: SessionSummaryOut
    timeline: list[ReplayEntryOut]
