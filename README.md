# workflow-capture-ai

Enterprise software for capturing software-based work on managed employee desktops and converting those recordings into structured training and evaluation data for AI agents.

## Monorepo layout

```text
.
├── apps
│   ├── api
│   │   ├── app
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── exporters.py
│   │   │   ├── main.py
│   │   │   ├── models.py
│   │   │   ├── normalization.py
│   │   │   ├── schemas.py
│   │   │   └── storage.py
│   │   ├── scripts/seed_demo.py
│   │   └── tests/test_normalization.py
│   ├── dashboard
│   │   ├── app
│   │   │   ├── exports/page.tsx
│   │   │   ├── sessions/[id]/page.tsx
│   │   │   ├── tasks/page.tsx
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components
│   │   └── lib
│   └── recorder
│       └── src
│           ├── capture-worker.ts
│           ├── index.html
│           ├── main.ts
│           ├── preload.ts
│           ├── renderer.js
│           └── styles.css
├── data
│   ├── exports
│   └── screenshots
├── packages
│   └── schema
└── docker-compose.yml
```

## V0 slice included

- Electron desktop recorder with start/stop, active window tracking, click capture, keyboard-class capture, screenshot cadence, buffering, and API upload.
- FastAPI ingestion/replay/export service with `Session`, `Event`, `Screenshot`, and `TaskTrace` persistence.
- Deterministic normalization pipeline for converting raw event streams into structured task traces.
- Next.js admin dashboard for sessions, replay, traces, and JSONL export.
- Local filesystem screenshot storage and JSONL export generation.

## Local setup

1. Start Docker Desktop or another local Docker daemon.
2. Install Python dependencies:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -e 'apps/api[dev]'
   ```

3. Install workspace dependencies:

   ```bash
   pnpm install
   pnpm build:schema
   pnpm setup:recorder-native
   ```

4. Start Postgres:

   ```bash
   docker compose up -d
   ```

## Run the product locally

Terminal 1, API:

```bash
source .venv/bin/activate
cd apps/api
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2, dashboard:

```bash
pnpm dev:dashboard
```

Terminal 3, recorder:

```bash
pnpm dev:recorder
```

Open:

- Dashboard: [http://localhost:3000](http://localhost:3000)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Seed demo data

```bash
source .venv/bin/activate
cd apps/api
python scripts/seed_demo.py
```

## Recorder permissions on macOS

The recorder needs macOS permission grants for:

- Accessibility
- Screen Recording

Without those permissions the app will still open, but live global capture and screenshots will be degraded or unavailable.

## Expected user flow

1. Launch the recorder and set the API base URL to `http://localhost:8000`.
2. Start recording on an approved workflow.
3. Stop recording.
4. Open the dashboard session list.
5. Inspect the session detail and replay timeline.
6. Run normalization from the session detail page.
7. Download JSONL from the session detail or exports page.

## Privacy defaults in v0

- Raw typed text is not stored.
- Keyboard events are stored as class labels only.
- Excluded apps and domains are skipped.
- Screenshot capture is configurable.
- Redaction placeholders are present in the event and screenshot model shape.

## Verification commands

```bash
source .venv/bin/activate
pytest apps/api/tests
python -m compileall apps/api/app apps/api/scripts
pnpm build:schema
pnpm --filter @workflow-capture-ai/dashboard typecheck
pnpm --filter @workflow-capture-ai/dashboard build
pnpm --filter @workflow-capture-ai/recorder typecheck
pnpm --filter @workflow-capture-ai/recorder build
```
