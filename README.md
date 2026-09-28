# Resume-Assistant
# AI Resume Assistant

> "Scan. Match. Improve."

A web app that helps job seekers tailor their resume to a specific job posting — it scores how well a resume matches the job (ATS-style), shows missing/weak keywords, and uses AI to suggest improved resume bullets.

## What it does

- Upload a resume (PDF/DOCX)
- Paste a job posting (URL or text)
- Get a match score (0–100%) with matched/missing/weak keywords
- Get 3 AI-suggested rewrites for any resume bullet
- Download the updated resume as a PDF

## Tech Stack

- **Frontend:** React (Vite)
- **Backend:** Node.js / Express
- **Database:** PostgreSQL
- **AI:** LLM API for job parsing + bullet generation

## Project Structure

```
ai-resume-assistant/
├── frontend/   # React frontend (Vite)
├── backend/    # Express backend
├── db/         # Postgres migrations (db/migrations/*.sql)
├── docs/       # SRS + notes
└── README.md
```

## Getting Started

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) and Node.js 22+ (for the frontend). An Anthropic API key turns on the AI features.

```bash
git clone https://github.com/BonySage/Resume-Assistant.git
cd Resume-Assistant

# 1. secrets for the backend (optional — without a key the app runs, AI features are off)
cp backend/.env.example backend/.env   # set JWT_SECRET and ANTHROPIC_API_KEY

# 2. database + backend API in Docker (migrations run automatically on start)
docker compose up -d --build           # API on http://localhost:3000

# 3. frontend (new terminal)
cd frontend && npm install
npm run dev                            # http://localhost:5173, proxies /api to the backend
```

Useful Docker commands:

| Command | What it does |
|---|---|
| `docker compose logs -f backend` | Follow the API logs |
| `docker compose up -d --build backend` | Rebuild after backend code changes |
| `docker compose restart backend` | Reload after editing `backend/.env` |
| `docker compose down` | Stop everything (data is kept in volumes) |
| `docker compose down -v` | Stop and **delete** the database (all accounts, resumes and analyses) |

Inside Docker the backend always uses the `db` container, so `DATABASE_URL` in `backend/.env` only matters if you run the backend outside Docker (`cd backend && npm install && npm run migrate && npm run dev`).

## Team

| Name | Role |
|---|---|
| | Project Lead |
| | Backend |
| | Frontend |
| | QA |

## Team Workflow

See [CONTRIBUTING.md](CONTRIBUTING.md) for how we branch, commit, and merge.
