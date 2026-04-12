# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**Whale x Anthropic: Claude Code Hackathon — Amsterdam** (April 25–26). Build a product in 24 hours for underserved communities (minorities, non-profits, municipalities, emergency services).

## Architecture

Two independently deployed services:

- **`frontend/`** — Next.js 16 + React 19 (App Router) + Tailwind CSS 4, deployed to **Vercel** on push to `main`
- **`backend/`** — FastAPI (Python 3.14) + uvicorn, deployed to **Railway** via `backend/railway.json`

**Database/Auth:** Supabase (PostgreSQL). The backend uses the `supabase` Python client; the frontend will use `@supabase/supabase-js` via `NEXT_PUBLIC_SUPABASE_*` env vars.

Frontend calls the backend at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). CORS in `backend/main.py` currently allows only `http://localhost:3000` — add production origins when deploying.

**Current state:** Both services are scaffolds. The backend exposes only `GET /health`. The frontend is the default Next.js starter.

## Development

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
npm run build
npm run lint
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000
```

Health check: `GET http://localhost:8000/health` → `{"status": "ok"}`

## Environment Variables

**`frontend/.env.local`** (not committed):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**`backend/.env`** (not committed) — loaded automatically via `python-dotenv`:

```bash
SUPABASE_URL=
SUPABASE_KEY=
DATABASE_URL=
```

## CI/CD

- `.github/workflows/deploy-frontend.yml` — triggers on `frontend/**` changes pushed to `main`; uses `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` GitHub secrets
- Backend deploys via Railway connected to the repo; start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Important Notes

- **Next.js 16 + React 19 have breaking changes** — read `frontend/AGENTS.md` and `node_modules/next/dist/docs/` before writing frontend code. Do not rely on pre-2025 Next.js/React patterns.
- **Use `proxy.ts` instead of `middleware.ts`** in Next.js 16 for request interception, auth gates, and rewrites.
- **Tailwind CSS 4** — configuration is in `postcss.config.mjs`, not `tailwind.config.js`. The v4 API differs significantly from v3.
- **Backend Supabase access** — `python-dotenv` is configured; credentials come from `backend/.env` via `load_dotenv()`.

## Code Style

- TypeScript strict mode
- Python type hints preferred
- Keep API endpoints RESTful

## Preferred Patterns

- Always use TypeScript interfaces for API responses
- Use Supabase client from `frontend/lib/supabase.ts`
- All API calls go through `frontend/lib/api.ts`
- Backend routes follow REST conventions
- Always handle loading and error states in frontend components

## Do Not

- Never commit `.env` files
- Never use `any` type in TypeScript
- Never bypass Supabase Row Level Security
- Never hardcode URLs — use environment variables

## When Adding a New Feature

1. Add the endpoint to `backend/main.py`
2. Update `frontend/lib/api.ts`
3. Build the UI component
4. Test locally before pushing
