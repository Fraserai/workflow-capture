from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.exporters import build_jsonl_export
from app.normalization import build_task_trace


def test_build_task_trace_groups_events_into_steps() -> None:
    started_at = datetime.now(timezone.utc)
    session = SimpleNamespace(id="sess_test", started_at=started_at, ended_at=started_at + timedelta(minutes=2))
    screenshots = [
        SimpleNamespace(id="shot_1", occurred_at=started_at + timedelta(seconds=5)),
        SimpleNamespace(id="shot_2", occurred_at=started_at + timedelta(seconds=40)),
    ]
    events = [
        SimpleNamespace(
            id="evt_1",
            occurred_at=started_at + timedelta(seconds=3),
            sequence_number=1,
            event_type="navigation",
            app_name="Chrome",
            process_name="Chrome",
            window_title="CRM Dashboard - Google Chrome",
            domain="crm.internal.example",
            url="https://crm.internal.example/dashboard",
            click_x=None,
            click_y=None,
            keyboard_class=None,
        ),
        SimpleNamespace(
            id="evt_2",
            occurred_at=started_at + timedelta(seconds=25),
            sequence_number=2,
            event_type="keyboard",
            app_name="Chrome",
            process_name="Chrome",
            window_title="New Customer - Google Chrome",
            domain="crm.internal.example",
            url="https://crm.internal.example/customers/new",
            click_x=None,
            click_y=None,
            keyboard_class="editing",
        ),
        SimpleNamespace(
            id="evt_3",
            occurred_at=started_at + timedelta(seconds=27),
            sequence_number=3,
            event_type="keyboard",
            app_name="Chrome",
            process_name="Chrome",
            window_title="New Customer - Google Chrome",
            domain="crm.internal.example",
            url="https://crm.internal.example/customers/new",
            click_x=None,
            click_y=None,
            keyboard_class="submit",
        ),
    ]

    trace = build_task_trace(session, events, screenshots)

    assert trace["session_id"] == "sess_test"
    assert len(trace["steps"]) >= 2
    assert trace["steps"][0]["action"] == "navigate"
    assert trace["steps"][1]["action"] in {"enter_data", "submit", "keyboard"}
    assert trace["task_id"].endswith("_v0")


def test_build_jsonl_export_emits_session_and_trace_records() -> None:
    payload = build_jsonl_export(
        session_payload={"id": "sess_test"},
        events_payload=[{"id": "evt_1"}],
        screenshots_payload=[{"id": "shot_1"}],
        task_trace_payload={"id": "task_1"},
    )

    lines = [line for line in payload.splitlines() if line.strip()]

    assert len(lines) == 2
    assert '"recordType": "session"' in lines[0]
    assert '"recordType": "task_trace"' in lines[1]
