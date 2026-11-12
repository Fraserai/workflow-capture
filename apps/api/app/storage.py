from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from PIL import Image

from app.config import get_settings


class LocalStorage:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def root(self) -> Path:
        return self.settings.storage_root_path

    def ensure_directories(self) -> None:
        self.settings.screenshots_dir.mkdir(parents=True, exist_ok=True)
        self.settings.exports_dir.mkdir(parents=True, exist_ok=True)

    def save_screenshot(self, session_id: str, occurred_at: datetime, upload_file: UploadFile) -> dict[str, object]:
        suffix = Path(upload_file.filename or "").suffix or ".png"
        file_name = f"{occurred_at.strftime('%Y%m%dT%H%M%S')}_{uuid4().hex[:10]}{suffix}"
        session_dir = self.settings.screenshots_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        destination = session_dir / file_name

        with destination.open("wb") as handle:
            shutil.copyfileobj(upload_file.file, handle)

        width = None
        height = None
        try:
            with Image.open(destination) as image:
                width, height = image.size
        except Exception:
            width = None
            height = None

        relative_path = destination.relative_to(self.root).as_posix()
        return {
            "file_name": file_name,
            "relative_path": relative_path,
            "width": width,
            "height": height,
        }

    def write_export(self, session_id: str, payload: str) -> Path:
        export_path = self.settings.exports_dir / f"{session_id}.jsonl"
        export_path.parent.mkdir(parents=True, exist_ok=True)
        export_path.write_text(payload, encoding="utf-8")
        return export_path

    def asset_url(self, relative_path: str) -> str:
        return f"/assets/{relative_path}"
