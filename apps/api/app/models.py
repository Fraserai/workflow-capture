from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SessionModel(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"sess_{uuid4().hex[:16]}")
    employee_identifier: Mapped[str] = mapped_column(String(128))
    machine_name: Mapped[str] = mapped_column(String(128))
    os: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="recording")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    session_metadata: Mapped[dict[str, object]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    events: Mapped[list[EventModel]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="EventModel.occurred_at"
    )
    screenshots: Mapped[list[ScreenshotModel]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="ScreenshotModel.occurred_at"
    )
    task_traces: Mapped[list[TaskTraceModel]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="TaskTraceModel.updated_at"
    )


class EventModel(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_session_occurred_at", "session_id", "occurred_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"evt_{uuid4().hex[:16]}")
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    sequence_number: Mapped[int] = mapped_column(Integer)
    event_type: Mapped[str] = mapped_column(String(32))
    app_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    process_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    window_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    domain: Mapped[str | None] = mapped_column(String(256), nullable=True)
    click_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    click_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    keyboard_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    screenshot_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    redaction_status: Mapped[str] = mapped_column(String(64), default="none")
    redaction_notes: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    event_metadata: Mapped[dict[str, object]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped[SessionModel] = relationship(back_populates="events")


class ScreenshotModel(Base):
    __tablename__ = "screenshots"
    __table_args__ = (
        Index("ix_screenshots_session_occurred_at", "session_id", "occurred_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"shot_{uuid4().hex[:16]}")
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    file_name: Mapped[str] = mapped_column(String(256))
    relative_path: Mapped[str] = mapped_column(String(1024))
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    redaction_status: Mapped[str] = mapped_column(String(64), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped[SessionModel] = relationship(back_populates="screenshots")


class TaskTraceModel(Base):
    __tablename__ = "task_traces"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"task_{uuid4().hex[:16]}")
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True, unique=True
    )
    task_id: Mapped[str] = mapped_column(String(256))
    inferred_task_name: Mapped[str] = mapped_column(String(512))
    duration_seconds: Mapped[float] = mapped_column(Float)
    outcome: Mapped[str] = mapped_column(String(64), default="unknown")
    trace_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    session: Mapped[SessionModel] = relationship(back_populates="task_traces")
