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

Requires PostgreSQL running locally (see `docker-compose.yml`, or point `DATABASE_URL` at your own instance) and an Anthropic API key.

```bash
git clone https://github.com/BonySage/Resume-Assistant.git
cd Resume-Assistant

# database (option A: Docker)
docker compose up -d

# backend
cd backend && npm install
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
npm run migrate         # applies db/migrations in order
npm run dev              # http://localhost:3000

# frontend (new terminal)
cd frontend && npm install
npm run dev               # http://localhost:5173, proxies /api to the backend
```

## Team

| Name | Role |
|---|---|
| | Project Lead |
| | Backend |
| | Frontend |
| | QA |

## Team Workflow

See [CONTRIBUTING.md](CONTRIBUTING.md) for how we branch, commit, and merge.
