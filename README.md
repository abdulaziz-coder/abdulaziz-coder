# BM International School

Local website using React 19, TypeScript, Tailwind CSS 4, Framer Motion, TanStack Query, and Zod. The backend uses FastAPI/Pydantic, SQLAlchemy, PostgreSQL, and a Python Temporal worker.

## Run on this Windows computer

From the project folder:

```powershell
npm run dev:all
```

Open http://127.0.0.1:3000. Keep the terminal running; Ctrl+C stops the processes started by the launcher. API docs: http://127.0.0.1:8000/docs. Temporal dashboard: http://127.0.0.1:8233.

The project-local setup downloads PostgreSQL and Temporal into ignored `.tools/` and keeps database files and service logs in ignored `.local/`. It does not install Windows services, modify the system PATH, or publish anything. The launcher refuses to replace existing website, API, or Temporal processes on the same ports.

### Setup on a fresh Windows checkout

Requires Node.js 18.16+ (Node 22 recommended) and Python 3.13.

```powershell
npm ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.lock
npm run setup:services
npm run dev:all
```

### Frontend only

Run `npm run dev`. The website shows clearly marked preview learning content when the API is stopped. Enquiries can be downloaded as drafts; saving requires the backend. `npm run build` typechecks and produces `build/`; it does not deploy. `npm run preview` serves that build for visual preview only; API forwarding is configured for the development server.

## Docker alternative

With Docker Desktop installed and running, run `docker compose up --build`, then `npm run dev` in another terminal. Compose starts PostgreSQL, the Temporal development server, FastAPI, and the worker, with published ports bound to loopback. Database and Temporal state survive container restarts in named volumes. Use either Docker or native services, not both on the same ports. The native setup is the path used on this computer; Docker is an alternative configuration.

## Admissions data flow

1. A two-step React form validates with Zod and shows a review before submission. No draft details are stored in browser storage.
2. FastAPI validates again with Pydantic. Zod is a TypeScript library, so it runs on the frontend rather than inside Python.
3. PostgreSQL stores the enquiry and its pending-dispatch flag together. A stable idempotency key prevents duplicate rows on retries; changed data with a reused key returns HTTP 409.
4. The worker polls pending rows and starts a Temporal workflow using a deterministic workflow ID. Dispatch survives worker restarts, and completed workflow IDs cannot be reused.
5. A retryable, idempotent activity marks the enquiry `ready_for_review`. Only the enquiry ID enters workflow history, not personal details.
6. TanStack Query polls the receipt status. Receipt responses do not contain names, emails, or messages. There is no public enquiry list.

This local application sends no emails or school notifications. `ready_for_review` means prepared by the local workflow, not read by staff. Tables are created non-destructively by `app.init_db` for this initial version; future schema changes need migrations. An authenticated staff interface is not included.

## Backend commands (manual startup)

From `backend/`, configure environment variables or copy `.env.example` to `.env`. Defaults match the native launcher. Run the initializer, then the API and worker in separate terminals:

```powershell
.venv/Scripts/python.exe -m app.init_db
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --loop app.runtime:loop_factory
.venv/Scripts/python.exe -m app.worker
```

## Validation

```powershell
npm run build
npm test
cd backend
.venv/Scripts/python.exe -m pytest tests -q
```

For PostgreSQL integration tests, start the local database and set the connection before pytest:

```powershell
$env:TEST_DATABASE_URL = 'postgresql+psycopg://bm:bm_local@127.0.0.1:5432/bm_school'
.venv/Scripts/python.exe -m pytest tests -q
```

The integration fixture creates and removes its own randomly named schema, leaving application data untouched.

## Source layout

- `frontend/src/`: React components, Zod contracts, queries, and styles.
- `frontend/public/`: supplied school logo and original campus illustration.
- `backend/app/`: API, database model, workflow, activity, and durable dispatcher.
- `backend/tests/`: request validation and PostgreSQL integration coverage.
- `scripts/`: native local setup and process launcher.
- `dist/`: retained original static prototype; React builds go to `build/`.

School curriculum, ages, addresses, and admissions policies remain draft until verified. Optional Google Fonts requests have system-font fallbacks. No GitHub push, hosting registration, deployment workflow, or publication is performed.

Photography: all current React sections use school photos supplied by the user, stored locally in frontend/public/photos/. Source records are in frontend/public/photos/SOURCES.md. Previously used stock files and the original static illustration are retained but are not displayed by the React site.
