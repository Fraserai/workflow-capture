from __future__ import annotations

from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

from app.database import Base, SessionLocal, engine
from app.models import EventModel, ScreenshotModel, SessionModel
from app.storage import LocalStorage


def generate_demo_image(label: str, color: tuple[int, int, int]) -> bytes:
    image = Image.new("RGB", (1280, 800), color)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((80, 80, 1200, 720), radius=24, fill=(245, 247, 250))
    draw.text((120, 120), "workflow-capture-ai demo", fill=(15, 23, 42))
    draw.text((120, 180), label, fill=(51, 65, 85))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    storage = LocalStorage()
    storage.ensure_directories()

    started_at = datetime.now(timezone.utc) - timedelta(minutes=8)
    session = SessionModel(
        employee_identifier="demo.operator",
        machine_name="sales-laptop-01",
        os="macOS",
        status="stopped",
        started_at=started_at,
        ended_at=started_at + timedelta(minutes=4),
        session_metadata={
            "deployment": "demo-seed",
            "team": "operations",
            "notes": "Synthetic CRM customer creation workflow",
        },
    )
    db.add(session)
    db.flush()

    screenshots = []
    for index, label in enumerate(
        ["Open CRM dashboard", "Create customer form", "Submit customer record"], start=1
    ):
        occurred_at = started_at + timedelta(seconds=index * 45)
        content = generate_demo_image(label, (222 - index * 20, 232 - index * 15, 245 - index * 10))
        file_name = f"demo_{index}.png"
        session_dir = storage.settings.screenshots_dir / session.id
        session_dir.mkdir(parents=True, exist_ok=True)
        destination = session_dir / file_name
        destination.write_bytes(content)
        relative_path = destination.relative_to(storage.root).as_posix()
        screenshot = ScreenshotModel(
            session_id=session.id,
            occurred_at=occurred_at,
            file_name=file_name,
            relative_path=relative_path,
            width=1280,
            height=800,
            redaction_status="none",
        )
        screenshots.append(screenshot)
        db.add(screenshot)

    events = [
        EventModel(
            session_id=session.id,
            occurred_at=started_at + timedelta(seconds=8),
            sequence_number=1,
            event_type="navigation",
            app_name="Google Chrome",
            process_name="Google Chrome",
            window_title="CRM Dashboard - Google Chrome",
            url="https://crm.internal.example/dashboard",
            domain="crm.internal.example",
            redaction_status="none",
            event_metadata={"source": "seed"},
        ),
        EventModel(
            session_id=session.id,
            occurred_at=started_at + timedelta(seconds=34),
            sequence_number=2,
            event_type="mouse_click",
            app_name="Google Chrome",
            process_name="Google Chrome",
            window_title="Customers - Google Chrome",
            url="https://crm.internal.example/customers",
            domain="crm.internal.example",
            click_x=812,
            click_y=244,
            screenshot_ref=screenshots[0].id,
            redaction_status="none",
            event_metadata={"source": "seed"},
        ),
        EventModel(
            session_id=session.id,
            occurred_at=started_at + timedelta(seconds=52),
            sequence_number=3,
            event_type="keyboard",
            app_name="Google Chrome",
            process_name="Google Chrome",
            window_title="New Customer - Google Chrome",
            url="https://crm.internal.example/customers/new",
            domain="crm.internal.example",
            keyboard_class="editing",
            screenshot_ref=screenshots[1].id,
            redaction_status="masked",
            redaction_notes="Captured keyboard event class only",
            event_metadata={"source": "seed"},
        ),
        EventModel(
            session_id=session.id,
            occurred_at=started_at + timedelta(seconds=86),
            sequence_number=4,
            event_type="keyboard",
            app_name="Google Chrome",
            process_name="Google Chrome",
            window_title="New Customer - Google Chrome",
            url="https://crm.internal.example/customers/new",
            domain="crm.internal.example",
            keyboard_class="submit",
            screenshot_ref=screenshots[2].id,
            redaction_status="none",
            event_metadata={"source": "seed"},
        ),
    ]
    db.add_all(events)
    db.commit()
    db.close()

    print(f"Seeded demo session {session.id}")


if __name__ == "__main__":
    main()
