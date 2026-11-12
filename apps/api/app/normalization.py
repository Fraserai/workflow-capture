from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from re import sub
from types import SimpleNamespace
from typing import Any


PAUSE_BOUNDARY = timedelta(seconds=15)
KEYBOARD_MERGE_BOUNDARY = timedelta(seconds=2)


def _attr(item: Any, name: str, default: Any = None) -> Any:
    if isinstance(item, dict):
        return item.get(name, default)
    return getattr(item, name, default)


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    value = value.replace("|", " ").replace("_", " ").replace("/", " ").strip()
    value = sub(r"\s+", " ", value)
    return value


def _clean_window_title(title: str | None) -> str:
    text = _normalize_text(title)
    if not text:
        return ""
    for separator in [" - ", " | ", " — ", " · "]:
        if separator in text:
            text = text.split(separator)[0].strip()
            break
    return text


def _slugify(value: str) -> str:
    slug = sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug or "captured_workflow"


def _nearest_evidence(started_at: datetime, ended_at: datetime, screenshots: list[Any]) -> list[str]:
    evidence = [
        _attr(shot, "id")
        for shot in screenshots
        if started_at - timedelta(seconds=2) <= _attr(shot, "occurred_at") <= ended_at + timedelta(seconds=2)
    ]
    if evidence:
        return evidence[:3]

    before = [shot for shot in screenshots if _attr(shot, "occurred_at") <= ended_at]
    if before:
        return [_attr(before[-1], "id")]

    if screenshots:
        return [_attr(screenshots[0], "id")]
    return []


def _same_context(left: Any, right: Any) -> bool:
    return (
        _attr(left, "app_name") == _attr(right, "app_name")
        and _attr(left, "window_title") == _attr(right, "window_title")
        and _attr(left, "domain") == _attr(right, "domain")
    )


def _should_split(previous: Any, current: Any) -> bool:
    if previous is None:
        return False

    previous_at = _attr(previous, "occurred_at")
    current_at = _attr(current, "occurred_at")
    if current_at - previous_at > PAUSE_BOUNDARY:
        return True

    if not _same_context(previous, current):
        return True

    previous_type = _attr(previous, "event_type")
    current_type = _attr(current, "event_type")
    if previous_type == "keyboard" and current_type == "keyboard":
        return current_at - previous_at > KEYBOARD_MERGE_BOUNDARY

    if previous_type == "keyboard" and _attr(previous, "keyboard_class") == "submit":
        return True

    if previous_type != current_type and current_type in {"navigation", "window_change"}:
        return True

    return False


def _infer_action(events: list[Any]) -> str:
    event_types = {_attr(event, "event_type") for event in events}
    keyboard_classes = {_attr(event, "keyboard_class") for event in events if _attr(event, "keyboard_class")}

    if "navigation" in event_types:
        return "navigate"
    if "submit" in keyboard_classes:
        return "submit"
    if event_types == {"keyboard"}:
        if keyboard_classes & {"editing", "textual"}:
            return "enter_data"
        if "shortcut" in keyboard_classes:
            return "keyboard_shortcut"
        if "navigation" in keyboard_classes:
            return "navigate_with_keyboard"
        return "keyboard"
    if event_types == {"mouse_click"}:
        return "click" if len(events) == 1 else "multi_click"
    if "mouse_click" in event_types:
        return "click"
    if "window_change" in event_types:
        return "focus_window"
    return next(iter(event_types), "action")


def _infer_target(events: list[Any]) -> str:
    domains = [_attr(event, "domain") for event in events if _attr(event, "domain")]
    urls = [_attr(event, "url") for event in events if _attr(event, "url")]
    window_titles = [_clean_window_title(_attr(event, "window_title")) for event in events if _attr(event, "window_title")]
    window_titles = [title for title in window_titles if title]
    clicks = [event for event in events if _attr(event, "click_x") is not None and _attr(event, "click_y") is not None]

    if domains:
        return f"{domains[0]} context"
    if urls:
        return urls[0]
    if window_titles:
        return window_titles[0]
    if clicks:
        click = clicks[0]
        return f"screen({_attr(click, 'click_x'):.0f}, {_attr(click, 'click_y'):.0f})"

    app = next((_attr(event, "app_name") for event in events if _attr(event, "app_name")), None)
    return app or "current context"


def _dominant_label(events: list[Any], steps: list[dict[str, Any]]) -> str:
    domains = Counter(_attr(event, "domain") for event in events if _attr(event, "domain"))
    windows = Counter(_clean_window_title(_attr(event, "window_title")) for event in events if _attr(event, "window_title"))
    apps = Counter(_attr(event, "app_name") for event in events if _attr(event, "app_name"))

    if domains:
        return f"{domains.most_common(1)[0][0]} workflow"
    windows = Counter({key: count for key, count in windows.items() if key})
    if windows:
        return f"{windows.most_common(1)[0][0]} workflow"
    if apps:
        return f"{apps.most_common(1)[0][0]} workflow"
    if steps:
        return f"{steps[0]['app']} workflow"
    return "Captured workflow"


def _build_step(step_index: int, events: list[Any], screenshots: list[Any]) -> dict[str, Any]:
    started_at = _attr(events[0], "occurred_at")
    ended_at = _attr(events[-1], "occurred_at")
    return {
        "step_index": step_index,
        "action": _infer_action(events),
        "target": _infer_target(events),
        "app": next((_attr(event, "app_name") for event in events if _attr(event, "app_name")), "Unknown"),
        "started_at": started_at.isoformat(),
        "ended_at": ended_at.isoformat(),
        "evidence": _nearest_evidence(started_at, ended_at, screenshots),
        "event_ids": [_attr(event, "id") for event in events],
    }


def build_task_trace(session: Any, events: list[Any], screenshots: list[Any]) -> dict[str, Any]:
    ordered_events = sorted(
        events,
        key=lambda item: (_attr(item, "occurred_at"), _attr(item, "sequence_number", 0)),
    )
    ordered_screenshots = sorted(screenshots, key=lambda item: _attr(item, "occurred_at"))

    if not ordered_events:
        started_at = _attr(session, "started_at")
        ended_at = _attr(session, "ended_at") or started_at
        inferred_task_name = "Captured workflow"
        return {
            "session_id": _attr(session, "id"),
            "task_id": "captured_workflow_v0",
            "inferred_task_name": inferred_task_name,
            "duration_seconds": max((ended_at - started_at).total_seconds(), 0),
            "outcome": "unknown",
            "steps": [],
        }

    steps: list[dict[str, Any]] = []
    current_events: list[Any] = []
    previous = None

    for event in ordered_events:
        if current_events and _should_split(previous, event):
            steps.append(_build_step(len(steps) + 1, current_events, ordered_screenshots))
            current_events = []
        current_events.append(event)
        previous = event

    if current_events:
        steps.append(_build_step(len(steps) + 1, current_events, ordered_screenshots))

    started_at = _attr(ordered_events[0], "occurred_at")
    ended_at = _attr(ordered_events[-1], "occurred_at")
    inferred_task_name = _dominant_label(ordered_events, steps)
    task_id = f"{_slugify(inferred_task_name)}_v0"

    return {
        "session_id": _attr(session, "id"),
        "task_id": task_id,
        "inferred_task_name": inferred_task_name,
        "duration_seconds": max((ended_at - started_at).total_seconds(), 0),
        "outcome": "unknown",
        "steps": steps,
    }


def nearest_screenshot_for_event(event: Any, screenshots: list[Any]) -> Any | None:
    if not screenshots:
        return None

    event_at = _attr(event, "occurred_at")
    before = [shot for shot in screenshots if _attr(shot, "occurred_at") <= event_at]
    if before:
        return before[-1]
    return screenshots[0]


def make_session_namespace(payload: dict[str, Any]) -> SimpleNamespace:
    return SimpleNamespace(**payload)
