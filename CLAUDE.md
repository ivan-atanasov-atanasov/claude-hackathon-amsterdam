# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**Whale x Anthropic: Claude Code Hackathon — Amsterdam** (April 25–26). Build a product in 24 hours for underserved communities (minorities, non-profits, municipalities, emergency services).

## Architecture

Two independently deployed services:

- **`frontend/`** — Next.js 16 (App Router) + Tailwind CSS 4, deployed to **Vercel** automatically on push to `main`
- **`backend/`** — FastAPI + Python, deployed to **Railway** via `railway.json` using uvicorn

**Database/Auth:** Supabase (PostgreSQL). The backend uses the `supabase` Python client; the frontend uses `@supabase/supabase-js` via `NEXT_PUBLIC_SUPABASE_*` env vars.

Frontend calls the backend at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). CORS is configured in `backend/main.py` to allow `http://localhost:3000`.

## Development

### Frontend

```bash
cd frontend
npm install
npm run dev        # starts on http://localhost:3000
npm run build
npm run lint
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload   # starts on http://localhost:8000
```

Health check: `GET http://localhost:8000/health` → `{"status": "ok"}`

## Environment Variables

**`frontend/.env.local`** (not committed):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**`backend/.env`** (not committed):

```bash
SUPABASE_URL=
SUPABASE_KEY=
DATABASE_URL=
```

## CI/CD

- `.github/workflows/deploy-frontend.yml` — triggers on push to `main` when `frontend/**` changes; deploys to Vercel using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` GitHub secrets
- Backend deploys via Railway connected to the repo (uses `backend/railway.json`)

## Important Notes

- **Next.js 16 has breaking changes** — APIs, conventions, and file structure differ from older versions. Read `node_modules/next/dist/docs/` before writing frontend code; do not rely on pre-2025 Next.js patterns.
- **Backend env vars** — `python-dotenv` is installed; add `from dotenv import load_dotenv; load_dotenv()` at the top of `main.py` before accessing `os.environ` for Supabase credentials.

## Code Style

- TypeScript strict mode
- Python type hints preferred
- Keep API endpoints RESTful
