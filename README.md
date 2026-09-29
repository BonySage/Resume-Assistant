# AI Resume Assistant

> **Scan. Match. Improve.**

A web app that helps job seekers tailor a resume to a specific job posting. It scores how well the resume matches the job (ATS-style), shows which keywords are matched, missing or weak, and uses AI to suggest stronger resume bullets that stay truthful to what the resume already says.

## Features

- **Accounts:** sign up and log in with email and password. Sessions time out after 15 minutes of inactivity.
- **Resume upload:** PDF or DOCX, up to 10 MB. The file is parsed in memory and not stored; only the extracted text and sections are saved.
- **Job posting input:** paste a URL, or paste the description if the URL can't be read.
- **Match score:** a 0–100 score, with keywords sorted into matched, missing (critical and secondary) and weak.
- **Bullet rewrites:** 3 AI-suggested rewrites for any resume bullet. Suggestions are checked so they don't claim skills the resume doesn't show.
- **PDF export:** download the resume with your chosen bullets filled in.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, React Router, Vite |
| Backend | Node.js 22, Express 5 |
| Database | PostgreSQL 16 |
| AI | Anthropic Claude API |
| Parsing / export | pdfjs-dist, mammoth (DOCX), cheerio (job URLs), pdfkit |
| Tooling | Docker Compose, `node:test`, oxlint, GitHub Actions (Pages deploy) |

## Getting started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Node.js 22.9 or newer
- An Anthropic API key (optional; without one the app runs with the AI features turned off)

### Run locally

```bash
git clone https://github.com/BonySage/Resume-Assistant.git
cd Resume-Assistant

# 1. Backend secrets
cp backend/.env.example backend/.env   # set JWT_SECRET and ANTHROPIC_API_KEY

# 2. Database + API (migrations run automatically on start)
docker compose up -d --build           # API on http://localhost:3000

# 3. Frontend, in a second terminal
cd frontend
npm install
npm run dev                            # http://localhost:5173, proxies /api to :3000
```

Open http://localhost:5173 and create an account.

### Environment variables

Set in `backend/.env` (see [backend/.env.example](backend/.env.example)):

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs login tokens. Use a long random string. |
| `ANTHROPIC_API_KEY` | Turns on job parsing and bullet rewrites. |
| `ANTHROPIC_MODEL` | Claude model to use (default `claude-sonnet-5`). |
| `DATABASE_URL` | Postgres connection. Only used when the backend runs outside Docker. |
| `CLIENT_ORIGIN` | Frontend URL allowed by CORS. |
| `PORT` | API port (default `3000`). |

The frontend reads `VITE_API_BASE_URL` (see [frontend/.env.example](frontend/.env.example)). You don't need it for local dev because Vite proxies `/api`.

Never commit a real `.env` file.

### Useful Docker commands

| Command | What it does |
|---|---|
| `docker compose logs -f backend` | Follow the API logs |
| `docker compose up -d --build backend` | Rebuild after backend code changes |
| `docker compose restart backend` | Reload after editing `backend/.env` |
| `docker compose down` | Stop everything (data is kept) |
| `docker compose down -v` | Stop and **delete** the database (all accounts, resumes and analyses) |

### Running the backend without Docker

You need a Postgres instance and `DATABASE_URL` set in `backend/.env`:

```bash
cd backend
npm install
npm run migrate   # applies db/migrations/*.sql in order
npm run dev       # http://localhost:3000, restarts on file changes
```

## Testing and linting

```bash
cd backend && npm test        # node:test suite, no database needed
cd frontend && npm run lint   # oxlint
```

## API overview

Every route is under `/api`. All routes except auth and health need a logged-in user, and users can only access their own data.

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `DELETE /auth/me` |
| Resumes | `GET /resumes`, `GET /resumes/:id`, `POST /resumes` (multipart `file`), `DELETE /resumes/:id` |
| Job postings | `GET /job-postings`, `GET /job-postings/:id`, `POST /job-postings`, `DELETE /job-postings/:id` |
| Analyses | `GET /analyses`, `GET /analyses/:id`, `POST /analyses` |
| Bullets | `GET /analyses/:id/bullets`, `POST /analyses/:id/bullets/:bulletId/generate`, `POST /analyses/:id/bullets/:bulletId/select` |
| Export | `GET /analyses/:id/export` (PDF) |

Errors come back as `{ "error": "message", "code": "OPTIONAL_CODE" }`.

## Project structure

```text
Resume-Assistant/
├── backend/            Express API
│   ├── src/routes/     auth, resumes, job postings, analyses
│   ├── src/lib/        parsing, ATS scoring, AI calls, PDF export
│   ├── src/middleware/ auth, logging, error handling
│   └── test/           node:test suite
├── frontend/           React app (Vite)
│   └── src/pages/      Home, Auth, Dashboard, JobPosting, Results,
│                       BulletImprove, Download, Settings
├── db/migrations/      numbered SQL migrations
├── docs/               Software Requirement Specification (PDF)
├── .github/workflows/  GitHub Pages deploy for the frontend
└── docker-compose.yml  Postgres + backend
```

Each part has its own README with more detail:

- [backend/README.md](backend/README.md): architecture, conventions, how to add an API
- [frontend/README.md](frontend/README.md): screens and UI requirements
- [db/README.md](db/README.md): tables and migration rules

The full requirements are in [docs/Software Requirement Specification.pdf](docs/Software%20Requirement%20Specification.pdf).

## Deployment

Pushing to `main` builds the frontend and publishes it to GitHub Pages ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)). Before that deploy can talk to a real API, the backend has to be hosted somewhere and `VITE_API_BASE_URL` in the workflow set to its URL.

## Team

| Name | Role |
|---|---|
| Gaurav Bhandari| DataBase |
| Serene Plummer| Backend |
| Ingeet Adhikari| Frontend |
| Anup Sharma| QA |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how we branch, commit and open pull requests.
