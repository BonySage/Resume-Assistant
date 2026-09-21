# Database

PostgreSQL schema and migrations for the AI Resume Assistant.

## Tables (planned)

| Table | Purpose |
| --- | --- |
| users | Accounts: email (unique), password hash, created date |
| resumes | Uploaded files: owner, filename, storage path, type, size, parsed data (JSONB) |
| job_postings | Job info: owner, source URL, title, company, raw text, parsed data (JSONB) |
| analyses | Resume-to-job match results: score, matched / missing / weak keywords |
| bullet_suggestions | Original bullet, 3 AI options, selected option |

## Rules

- Every user-owned table links back to a user, so users can only ever see their
  own data (NFR-2.5)
- Passwords are stored only as bcrypt or argon2 hashes (NFR-2.1)
- Match scores are constrained to 0-100
- Parsed resume and job data use JSONB columns (SRS section 7.1)

## Migrations

- SQL migration files live in `migrations/` and run in numbered order
  (`001_create_users.sql`, `002_create_resumes.sql`, ...)
- Never edit a migration that has already been merged. Add a new one instead.

## Running locally

_To be added once the Docker Compose file is in place._

## Git workflow

Do not push to `main`. Create a branch (`db/<short-name>`), push it, and open a
pull request for review.
