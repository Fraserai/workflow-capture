from __future__ import annotations

import json
from datetime import datetime
from typing import Any


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def build_jsonl_export(
    *,
    session_payload: dict[str, Any],
    events_payload: list[dict[str, Any]],
    screenshots_payload: list[dict[str, Any]],
    task_trace_payload: dict[str, Any] | None,
) -> str:
    records = [
        {
            "recordType": "session",
            "sessionId": session_payload["id"],
            "payload": {
                "session": session_payload,
                "events": events_payload,
                "screenshots": screenshots_payload,
            },
        }
    ]

    if task_trace_payload:
        records.append(
            {
                "recordType": "task_trace",
                "sessionId": session_payload["id"],
                "payload": task_trace_payload,
            }
        )

    return "\n".join(json.dumps(record, default=_json_default) for record in records) + "\n"
