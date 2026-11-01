# BM International School

Local website using React 19, TypeScript, Tailwind CSS 4, Framer Motion, TanStack Query, and Zod. The backend uses FastAPI/Pydantic, SQLAlchemy, PostgreSQL, and a Python Temporal worker.

## Run on this Windows computer

From the project folder:

```powershell
npm run dev:all
```

Open http://127.0.0.1:3000. Keep the terminal running; Ctrl+C stops the processes started by the launcher. API docs: http://127.0.0.1:8000/docs. Temporal dashboard: http://127.0.0.1:8233.

The project-local setup downloads PostgreSQL and Temporal into ignored `.tools/` and keeps database files and service logs in ignored `.local/`. It does not install Windows services, modify the system PATH, or publish anything. The launcher refuses to replace existing website, API, or Temporal processes on the same ports.

### Windows terminal startup and shutdown

You can run `python scripts/dev.py` directly from the project folder to avoid npm's Windows batch wrapper. Wait for the startup messages and the website URL, then keep that terminal open while using the site. Press Ctrl+C only to stop. If npm asks `Terminate batch job (Y/N)?` after stopping, enter `Y`. The launcher checks PostgreSQL's status before shutdown, so a database that has already stopped does not trigger a duplicate stop attempt. Startup failures identify the service and its local log file.

The API automatically reloads changes in `backend/app/`, so new routes do not require a manual restart. An API reload signs admins out. Database schema upgrades still run through the initializer when the complete stack starts.

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

The frontend supports English, Uzbek (Latin script), and Russian. The header language selector stores only the chosen language in `localStorage`; form drafts remain in React memory. Page metadata, navigation, learning content, FAQs, image descriptions, form labels, validation, status messages, and downloaded enquiry drafts follow that choice. Canonical English learning-stage values are preserved in API requests, so language changes require no database migration. Translations live in `frontend/src/translations.ts`.

1. A two-step React form validates with Zod and shows a review before submission. No draft details are stored in browser storage.
2. FastAPI validates again with Pydantic. Zod is a TypeScript library, so it runs on the frontend rather than inside Python.
3. PostgreSQL stores the enquiry and its pending-dispatch flag together. A stable idempotency key prevents duplicate rows on retries; changed data with a reused key returns HTTP 409.
4. The worker polls pending rows and starts a Temporal workflow using a deterministic workflow ID. Dispatch survives worker restarts, and completed workflow IDs cannot be reused.
5. A retryable, idempotent activity marks the enquiry `ready_for_review`. Only the enquiry ID enters workflow history, not personal details.
6. TanStack Query polls the receipt status. Receipt responses do not contain names, emails, or messages. There is no public enquiry list.

This local application sends no emails or school notifications. `ready_for_review` means prepared by the local workflow, not read by staff. Tables are created non-destructively by `app.init_db` for this initial version; future schema changes need migrations.

## Local admissions admin

Open http://127.0.0.1:3000/admin or use the footer's Admin panel link. Restart `python scripts/dev.py` once after this update to load the new backend routes. The initializer creates a local admin account on first startup and saves its sign-in details in `.local/admin-access.txt`. That file, the password-hash configuration, and all database files are ignored by Git. No fixed password is included in source code.

The panel supports English, Uzbek, and Russian; search by parent name, email, or enquiry reference; filters by grade and status; pagination; and a detail dialog with the complete message. Older enquiries without a grade show “Not recorded”. The detail dialog includes “Mark as received”, which saves a staff acknowledgement timestamp. Repeating the action keeps the original timestamp. This does not send emails or delete enquiries.

References are short, permanent codes such as `BM-000001`, generated by a unique PostgreSQL identity number. Existing enquiries receive codes during the initializer's repeatable upgrade; their internal UUIDs remain unchanged. Both the public confirmation and admin panel display the short code. UUIDs continue to identify API requests internally. The admin's “Received” status reflects staff acknowledgement, while “New” and “Ready for review” describe unacknowledged enquiries. Background Temporal updates cannot overwrite staff acknowledgement.

Authentication uses a password hash and an HttpOnly, SameSite=Strict session cookie. Sessions expire after eight hours and are invalidated when the API restarts or the password changes. Private responses have `Cache-Control: no-store`. Login attempts are limited and browser login/logout requests must come from an allowed local origin. Private enquiry records are not placed in browser localStorage.

To set your own password, run this from `backend/`:

```powershell
.venv/Scripts/python.exe -m app.admin_account
```

This prompts privately, invalidates previous sessions, and removes the initial generated-password note. In the Docker alternative, admin account files persist in the `admin_data` volume; view the initial note in your terminal with `docker compose exec api cat .local/admin-access.txt`. The native local setup is the verified path on this computer.

New admissions enquiries require a grade from 1 to 11. The selected grade is included in the review and downloaded draft and is validated by Zod, Pydantic, and a PostgreSQL check constraint. The initializer performs a repeatable additive upgrade for the grade column; existing enquiries are preserved with no grade recorded. Restart `python scripts/dev.py` after updating the backend so the initializer and new API contract take effect.

New enquiries also require a phone number. Common spaces, parentheses, and separators are accepted; 7–15 digits are required and formatting is normalized before saving. The number appears in the review, downloaded draft, and protected admin views and can be searched in the admin panel. The database upgrade preserves older enquiries without a phone number, which show “Not recorded”. Public receipt responses do not include contact information.

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
