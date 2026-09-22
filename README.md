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
├── client/     # React frontend
├── server/     # Express backend
├── docs/       # SRS + notes
└── README.md
```

## Getting Started

```bash
git clone https://github.com/BonySage/Resume-Assistant.git
cd ai-resume-assistant

# backend
cd server && npm install
cp .env.example .env   # add your DB + AI API key
npm run dev

# frontend (new terminal)
cd client && npm install
npm run dev
```

## Team

| Name | Role |
|---|---|
| Gaurav Bhandari| DataBase |
| Serene Plummer| Backend |
| Ingeet Adhikari| Frontend |
| Anup Sharma| QA |

## Team Workflow

See [CONTRIBUTING.md](CONTRIBUTING.md) for how we branch, commit, and merge.
