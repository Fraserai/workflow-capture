from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, engine, get_db
from app.exporters import build_jsonl_export
from app.models import EventModel, ScreenshotModel, SessionModel, TaskTraceModel
from app.normalization import build_task_trace, nearest_screenshot_for_event
from app.schemas import (
    EventBatchIn,
    EventOut,
    IngestionAck,
    NormalizeRequest,
    ReplayEntryOut,
    ScreenshotOut,
    SessionCreate,
    SessionDetailOut,
    SessionReplayOut,
    SessionSummaryOut,
    StopSessionRequest,
    TaskStepOut,
    TaskTraceOut,
)
from app.storage import LocalStorage


settings = get_settings()
storage = LocalStorage()

app = FastAPI(title=settings.api_title)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _session_counts(db: Session, session_id: str) -> tuple[int, int]:
    event_count = db.scalar(select(func.count(EventModel.id)).where(EventModel.session_id == session_id)) or 0
    screenshot_count = (
        db.scalar(select(func.count(ScreenshotModel.id)).where(ScreenshotModel.session_id == session_id)) or 0
    )
    return int(event_count), int(screenshot_count)


def _task_trace_for_session(db: Session, session_id: str) -> TaskTraceModel | None:
    return db.scalar(select(TaskTraceModel).where(TaskTraceModel.session_id == session_id))


def _session_summary_payload(db: Session, session_model: SessionModel) -> SessionSummaryOut:
    event_count, screenshot_count = _session_counts(db, session_model.id)
    latest_trace = _task_trace_for_session(db, session_model.id)
    return SessionSummaryOut(
        id=session_model.id,
        employee_identifier=session_model.employee_identifier,
        machine_name=session_model.machine_name,
        os=session_model.os,
        status=session_model.status,
        started_at=session_model.started_at,
        ended_at=session_model.ended_at,
        metadata=session_model.session_metadata or {},
        created_at=session_model.created_at,
        updated_at=session_model.updated_at,
        event_count=event_count,
        screenshot_count=screenshot_count,
        latest_task_trace_id=latest_trace.id if latest_trace else None,
    )


def _event_payload(event_model: EventModel) -> EventOut:
    return EventOut(
        id=event_model.id,
        session_id=event_model.session_id,
        occurred_at=event_model.occurred_at,
        sequence_number=event_model.sequence_number,
        event_type=event_model.event_type,
        app_name=event_model.app_name,
        process_name=event_model.process_name,
        window_title=event_model.window_title,
        url=event_model.url,
        domain=event_model.domain,
        click_x=event_model.click_x,
        click_y=event_model.click_y,
        keyboard_class=event_model.keyboard_class,
        screenshot_ref=event_model.screenshot_ref,
        redaction_status=event_model.redaction_status,
        redaction_notes=event_model.redaction_notes,
        metadata=event_model.event_metadata or {},
        created_at=event_model.created_at,
    )


def _screenshot_payload(screenshot_model: ScreenshotModel) -> ScreenshotOut:
    return ScreenshotOut(
        id=screenshot_model.id,
        session_id=screenshot_model.session_id,
        occurred_at=screenshot_model.occurred_at,
        file_name=screenshot_model.file_name,
        relative_path=screenshot_model.relative_path,
        url=storage.asset_url(screenshot_model.relative_path),
        width=screenshot_model.width,
        height=screenshot_model.height,
        redaction_status=screenshot_model.redaction_status,
        created_at=screenshot_model.created_at,
    )


def _task_trace_payload(task_trace_model: TaskTraceModel | None) -> TaskTraceOut | None:
    if not task_trace_model:
        return None
    steps = [
        TaskStepOut(
            step_index=step["step_index"],
            action=step["action"],
            target=step["target"],
            app=step["app"],
            started_at=datetime.fromisoformat(step["started_at"]),
            ended_at=datetime.fromisoformat(step["ended_at"]),
            evidence=step.get("evidence", []),
            event_ids=step.get("event_ids", []),
        )
        for step in task_trace_model.trace_json.get("steps", [])
    ]
    return TaskTraceOut(
        id=task_trace_model.id,
        session_id=task_trace_model.session_id,
        task_id=task_trace_model.task_id,
        inferred_task_name=task_trace_model.inferred_task_name,
        duration_seconds=task_trace_model.duration_seconds,
        outcome=task_trace_model.outcome,
        steps=steps,
        created_at=task_trace_model.created_at,
        updated_at=task_trace_model.updated_at,
    )


def _require_session(db: Session, session_id: str) -> SessionModel:
    session_model = db.get(SessionModel, session_id)
    if not session_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session_model


def _load_session_events(db: Session, session_id: str) -> list[EventModel]:
    return list(
        db.scalars(
            select(EventModel)
            .where(EventModel.session_id == session_id)
            .order_by(EventModel.occurred_at.asc(), EventModel.sequence_number.asc())
        )
    )


def _load_session_screenshots(db: Session, session_id: str) -> list[ScreenshotModel]:
    return list(
        db.scalars(
            select(ScreenshotModel)
            .where(ScreenshotModel.session_id == session_id)
            .order_by(ScreenshotModel.occurred_at.asc())
        )
    )


def _upsert_task_trace(db: Session, session_model: SessionModel, force: bool = False) -> TaskTraceModel:
    existing = _task_trace_for_session(db, session_model.id)
    if existing and not force:
        return existing

    events = _load_session_events(db, session_model.id)
    screenshots = _load_session_screenshots(db, session_model.id)
    trace = build_task_trace(session_model, events, screenshots)

    task_trace_model = existing or TaskTraceModel(session_id=session_model.id)
    task_trace_model.task_id = trace["task_id"]
    task_trace_model.inferred_task_name = trace["inferred_task_name"]
    task_trace_model.duration_seconds = trace["duration_seconds"]
    task_trace_model.outcome = trace["outcome"]
    task_trace_model.trace_json = trace
    db.add(task_trace_model)
    session_model.status = "processed" if session_model.status != "recording" else session_model.status
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing_after_race = _task_trace_for_session(db, session_model.id)
        if existing_after_race:
            if force:
                existing_after_race.task_id = trace["task_id"]
                existing_after_race.inferred_task_name = trace["inferred_task_name"]
                existing_after_race.duration_seconds = trace["duration_seconds"]
                existing_after_race.outcome = trace["outcome"]
                existing_after_race.trace_json = trace
                db.add(existing_after_race)
                db.commit()
                db.refresh(existing_after_race)
                return existing_after_race
            return existing_after_race
        raise
    db.refresh(task_trace_model)
    return task_trace_model


@app.on_event("startup")
def on_startup() -> None:
    storage.ensure_directories()
    Base.metadata.create_all(bind=engine)


app.mount("/assets", StaticFiles(directory=str(settings.storage_root_path)), name="assets")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/sessions", response_model=SessionSummaryOut, status_code=status.HTTP_201_CREATED)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)) -> SessionSummaryOut:
    started_at = payload.started_at or datetime.now(timezone.utc)
    session_model = SessionModel(
        employee_identifier=payload.employee_identifier,
        machine_name=payload.machine_name,
        os=payload.os,
        status=payload.status,
        started_at=started_at,
        session_metadata=payload.metadata,
    )
    db.add(session_model)
    db.commit()
    db.refresh(session_model)
    return _session_summary_payload(db, session_model)


@app.post("/sessions/{session_id}/stop", response_model=SessionSummaryOut)
def stop_session(
    session_id: str,
    payload: StopSessionRequest,
    db: Session = Depends(get_db),
) -> SessionSummaryOut:
    session_model = _require_session(db, session_id)
    session_model.status = "stopped"
    session_model.ended_at = payload.ended_at or datetime.now(timezone.utc)
    db.add(session_model)
    db.commit()
    db.refresh(session_model)
    return _session_summary_payload(db, session_model)


@app.post("/sessions/{session_id}/events", response_model=IngestionAck)
def ingest_events(session_id: str, payload: EventBatchIn, db: Session = Depends(get_db)) -> IngestionAck:
    _require_session(db, session_id)

    event_models = [
        EventModel(
            session_id=session_id,
            occurred_at=event.occurred_at,
            sequence_number=event.sequence_number,
            event_type=event.event_type,
            app_name=event.app_name,
            process_name=event.process_name,
            window_title=event.window_title,
            url=event.url,
            domain=event.domain,
            click_x=event.click_x,
            click_y=event.click_y,
            keyboard_class=event.keyboard_class,
            screenshot_ref=event.screenshot_ref,
            redaction_status=event.redaction_status,
            redaction_notes=event.redaction_notes,
            event_metadata=event.metadata,
        )
        for event in payload.events
    ]
    db.add_all(event_models)
    db.commit()
    return IngestionAck(accepted_count=len(event_models), session_id=session_id)


@app.post("/sessions/{session_id}/screenshots", response_model=ScreenshotOut, status_code=status.HTTP_201_CREATED)
def upload_screenshot(
    session_id: str,
    file: UploadFile = File(...),
    occurred_at: datetime = Form(..., alias="occurredAt"),
    redaction_status: str = Form(default="pending", alias="redactionStatus"),
    db: Session = Depends(get_db),
) -> ScreenshotOut:
    _require_session(db, session_id)
    stored = storage.save_screenshot(session_id, occurred_at, file)
    screenshot_model = ScreenshotModel(
        session_id=session_id,
        occurred_at=occurred_at,
        file_name=stored["file_name"],
        relative_path=stored["relative_path"],
        width=stored["width"],
        height=stored["height"],
        redaction_status=redaction_status,
    )
    db.add(screenshot_model)
    db.commit()
    db.refresh(screenshot_model)
    return _screenshot_payload(screenshot_model)


@app.get("/sessions", response_model=list[SessionSummaryOut])
def list_sessions(db: Session = Depends(get_db)) -> list[SessionSummaryOut]:
    sessions = list(db.scalars(select(SessionModel).order_by(desc(SessionModel.started_at))))
    return [_session_summary_payload(db, session_model) for session_model in sessions]


@app.get("/sessions/{session_id}", response_model=SessionDetailOut)
def get_session(session_id: str, db: Session = Depends(get_db)) -> SessionDetailOut:
    session_model = _require_session(db, session_id)
    events = _load_session_events(db, session_id)
    screenshots = _load_session_screenshots(db, session_id)
    latest_trace = _task_trace_for_session(db, session_id)
    summary = _session_summary_payload(db, session_model)
    return SessionDetailOut(
        **summary.model_dump(),
        events=[_event_payload(event) for event in events],
        screenshots=[_screenshot_payload(screenshot) for screenshot in screenshots],
        latest_task_trace=_task_trace_payload(latest_trace),
    )


@app.get("/sessions/{session_id}/replay", response_model=SessionReplayOut)
def get_session_replay(session_id: str, db: Session = Depends(get_db)) -> SessionReplayOut:
    session_model = _require_session(db, session_id)
    events = _load_session_events(db, session_id)
    screenshots = _load_session_screenshots(db, session_id)
    summary = _session_summary_payload(db, session_model)
    timeline = [
        ReplayEntryOut(
            event=_event_payload(event),
            screenshot=_screenshot_payload(nearest) if (nearest := nearest_screenshot_for_event(event, screenshots)) else None,
        )
        for event in events
    ]
    return SessionReplayOut(session=summary, timeline=timeline)


@app.get("/tasks", response_model=list[TaskTraceOut])
def list_task_traces(db: Session = Depends(get_db)) -> list[TaskTraceOut]:
    traces = list(db.scalars(select(TaskTraceModel).order_by(desc(TaskTraceModel.updated_at))))
    payloads = [_task_trace_payload(trace) for trace in traces]
    return [payload for payload in payloads if payload is not None]


@app.post("/tasks/normalize", response_model=TaskTraceOut)
def normalize_task_trace(payload: NormalizeRequest, db: Session = Depends(get_db)) -> TaskTraceOut:
    session_model = _require_session(db, payload.session_id)
    task_trace_model = _upsert_task_trace(db, session_model, force=payload.force)
    return _task_trace_payload(task_trace_model)


@app.get("/exports/{session_id}.jsonl")
def export_session_jsonl(session_id: str, db: Session = Depends(get_db)) -> FileResponse:
    session_model = _require_session(db, session_id)
    task_trace_model = _upsert_task_trace(db, session_model, force=False)
    events = _load_session_events(db, session_id)
    screenshots = _load_session_screenshots(db, session_id)

    export_payload = build_jsonl_export(
        session_payload=_session_summary_payload(db, session_model).model_dump(mode="json", by_alias=True),
        events_payload=[_event_payload(event).model_dump(mode="json", by_alias=True) for event in events],
        screenshots_payload=[
            _screenshot_payload(screenshot).model_dump(mode="json", by_alias=True) for screenshot in screenshots
        ],
        task_trace_payload=_task_trace_payload(task_trace_model).model_dump(mode="json", by_alias=True)
        if task_trace_model
        else None,
    )

    export_path = storage.write_export(session_id, export_payload)
    return FileResponse(
        path=export_path,
        media_type="application/x-ndjson",
        filename=f"{session_id}.jsonl",
    )
