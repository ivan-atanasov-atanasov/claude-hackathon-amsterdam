# claude-hackathon-amsterdam

> **Whale x Anthropic: Claude Code Hackathon — Amsterdam** (April 25–26)
>
> Build Local: 24 hours to go from idea to product for people and sectors at risk of being left behind — minorities, non-profits, municipalities, emergency services.

---

## What We're Building

_[Add a short description of your product here]_

## Architecture

Two independently deployed services:

- **Frontend** — Next.js 16 + React 19 (App Router), Tailwind CSS 4 → deployed to **Vercel**
- **Backend** — FastAPI (Python 3.14) + uvicorn → deployed to **Railway**
- **Database/Auth** — Supabase (PostgreSQL)

---

## Local Setup Guide

This guide assumes no prior development experience. You'll need about 20–30 minutes.

### Step 1 — Open a terminal

You'll type all commands in this guide into a terminal (also called a command line).

**Mac — option A (built-in):** press `Cmd + Space`, type `Terminal`, press Enter.

**Mac — option B (recommended):** download [iTerm2](https://iterm2.com) for a nicer experience. Open the downloaded `.dmg`, drag iTerm to Applications, and launch it.

**Windows:** press `Win + R`, type `cmd`, press Enter. Or install [Windows Terminal](https://aka.ms/terminal) from the Microsoft Store for a better experience.

### Step 2 — Install Homebrew (Mac only)

Homebrew is a package manager that lets you install developer tools with a single command. Skip this step if you're on Windows.

Check if it's already installed:

```bash
brew --version
```

If you see a version number, you're good — skip to Step 3. If you get "command not found", install it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the prompts — it will ask for your Mac password. Once done, run `brew --version` to confirm it worked.

### Step 3 — Install prerequisites

**Mac** — install everything via Homebrew:

```bash
brew install node python git
```

**Windows** — download and run each installer:

- **Node.js:** [nodejs.org](https://nodejs.org) → download the **LTS** version
- **Python:** [python.org/downloads](https://python.org/downloads) → download **Python 3.14**, and check **"Add Python to PATH"** during installation
- **Git:** [git-scm.com/downloads](https://git-scm.com/downloads)

### Step 4 — Clone the repository

```bash
git clone https://github.com/ivan-atanasov-atanasov/claude-hackathon-amsterdam.git
cd claude-hackathon-amsterdam
```

### Step 5 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up for a free account
2. Click **New project** and fill in the details
3. Once created, go to **Project Settings → API**
4. Copy the **Project URL** and the **anon / public** key — you'll need them in the next steps

### Step 6 — Set up the frontend

```bash
cd frontend
npm install
```

Create a file called `.env.local` inside the `frontend/` folder.

**Mac/Linux:**

```bash
touch .env.local
```

**Windows:** create the file manually in File Explorer. Make sure it's named `.env.local` and not `.env.local.txt` (turn on "File name extensions" in View settings if unsure).

Open `.env.local` in any text editor (Notepad works) and paste:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Replace `your_project_url_here` and `your_anon_key_here` with the values from Step 5.

Start the frontend:

```bash
npm run dev
```

The app is now running — open <http://localhost:3000> in your browser.

### Step 7 — Set up the backend

Open a **second terminal window** (keep the first one running the frontend).

```bash
cd claude-hackathon-amsterdam/backend
```

Create a virtual environment (an isolated Python workspace):

**Mac/Linux:**

```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows:**

```bash
python -m venv venv
venv\Scripts\activate
```

Your terminal prompt should now show `(venv)` at the start.

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a file called `.env` inside the `backend/` folder and open it in a text editor:

```bash
SUPABASE_URL=your_project_url_here
SUPABASE_KEY=your_anon_key_here
DATABASE_URL=your_database_url_here
```

The `DATABASE_URL` can be found in Supabase under **Project Settings → Database → Connection string → URI**.

Start the backend:

```bash
uvicorn main:app --reload
```

Verify it's working by opening <http://localhost:8000/health> in your browser — you should see `{"status":"ok"}`.

### You're all set

Both services should now be running:

| Service  | URL                          |
| -------- | ---------------------------- |
| Frontend | <http://localhost:3000>      |
| Backend  | <http://localhost:8000>      |
| API docs | <http://localhost:8000/docs> |

---

## Quick start with Docker

If you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed, you can run both services with two commands instead of following the full guide above.

### Step 1 — Install Docker Desktop

Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for your OS. Once installed, open it and wait for the whale icon in your menu bar to stop animating — that means Docker is ready.

### Step 2 — Create your .env file

Copy the example env file at the root of the project:

```bash
cp .env.example .env
```

Open `.env` in a text editor and fill in your Supabase credentials (see Step 5 of the manual guide above for where to find these).

### Step 3 — Start everything

From the root of the project:

```bash
docker compose up --build
```

Both services will build and start. Once you see `Application startup complete` in the logs, open <http://localhost:3000> in your browser.

To stop everything, press `Ctrl + C` in the terminal, then run:

```bash
docker compose down
```

---

## Design

Figma file: [Claude Hackathon Amsterdam](https://www.figma.com/design/9QWLWfxaMseOVlmvOW4ADL/Claude-Hackathon-Amsterdam?node-id=0-1&t=gpHNh8wsSTj54arL-1)

### Design Workflow

1. PM creates/updates designs in Figma
2. PM copies link to specific frame (right click → Copy link to selection)
3. Developer pastes frame link into Claude Code to implement

---

## Deployment

- **Frontend** — auto-deploys to Vercel on push to `main` (when `frontend/**` changes)
- **Backend** — auto-deploys to Railway on push to `main`

## License

[MIT](LICENSE)
