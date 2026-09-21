# Backend

Node.js / Express API for the AI Resume Assistant. Handles authentication,
file upload and storage, resume and job parsing, ATS matching, AI
orchestration, and PDF export.

## What to build (from the SRS)

- FR-1.1 Registration: email format validation, password rules (min 8
  characters, mixed case, numbers)
- FR-1.2 Login: bcrypt or argon2 hashing, JWT issued on login, 15-minute
  inactivity timeout
- FR-2.1 Resume upload: PDF or DOCX only, max 10 MB, stored on local disk or
  cloud storage
- FR-2.2 Resume parsing: extract text and split into contact info, summary,
  experience, education, skills; store in the database
- FR-3.1 / 3.2 Job posting input: URL extraction with copy-paste fallback;
  parse into title, company, description, required skills, responsibilities
- FR-4.1 / 4.2 ATS matching: 0-100 score from exact matches, partial matches,
  and missing skills; categorize keywords as matched, missing (critical /
  secondary), or weak
- FR-5.1 to 5.3 Bullet enhancement: send the original bullet, relevant job
  requirements, and resume evidence to the AI API; return 3 options; validate
  the output so it does not claim skills the resume doesn't have; save the
  user's choice
- FR-6.1 PDF export of the resume with selected bullets inserted

## Non-functional requirements

- Performance: upload processing under 5s, URL extraction under 10s (timeout),
  ATS score under 3s, AI generation up to 15s
- Security: hashed passwords, HTTPS, parameterized queries only (no string-built
  SQL), input sanitization, users can only access their own resumes and analyses
- Reliability: handle parsing failures and notify the user; if the AI service is
  down, return a clear error so the frontend can allow manual editing

## Working with the database

- Schema lives in `/db`. Talk to the DB owner before changing table structure.
- Use one data-access library for the whole backend (agree on it with the DB
  owner) and always use parameterized queries
- Database URL and secrets come from environment variables; see `.env.example`

## Setup

_To be filled in by the backend owner: Node version, install steps, how to run
locally, how to run tests._

## Git workflow

Do not push to `main`. Create a branch (`backend/<short-name>`), push it, and
open a pull request for review.
