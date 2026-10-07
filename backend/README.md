# Backend

Node.js / Express API for the AI Resume Assistant. Handles authentication,
file upload, resume and job parsing, ATS matching, AI
orchestration, and PDF export.

## What to build (from the SRS)

- FR-1.1 Registration: email format validation, password rules (min 8
  characters, mixed case, numbers)
- FR-1.2 Login: bcrypt or argon2 hashing, JWT issued on login, 15-minute
  inactivity timeout
- FR-2.1 Resume upload: PDF or DOCX only (checked by file signature), max 10 MB.
  The file is parsed in memory and not kept; its text and structure go in the database
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

The easiest way is Docker from the repo root: `docker compose up -d --build`
(runs Postgres and this API, and applies migrations on start).

To run the API directly instead, you need Node 22+ and a running Postgres:

```bash
npm install
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
npm run migrate         # applies ../db/migrations/*.sql
npm run dev              # http://localhost:3000, restarts on file changes
npm test                 # foundation tests (no database needed)
```

## Project structure

```text
src/
  index.js          Server entry: validates config, listens, shuts down cleanly
  app.js            createApp(): middleware → /api routes → 404 → error handler
  config.js         All settings from env vars, with defaults and checks
  errors.js         HttpError + helpers (badRequest, notFound, …)
  db.js             Postgres pool + query() (parameterized queries only)
  migrate.js        Applies ../db/migrations/*.sql in order
  routes/
    index.js        Mounts every API router under /api (+ GET /api/health)
    auth.js         FR-1  signup, login, logout, me, delete account
    resumes.js      FR-2  upload + parsing
    jobPostings.js  FR-3  job input (URL or text) + parsing
    analyses.js     FR-4 matching, FR-5 bullet rewrites, FR-6 PDF export
  middleware/
    auth.js         requireAuth: JWT cookie → req.user, sliding 15-min session
    errorHandler.js JSON 404 for unknown routes + central error handler
    requestLogger.js "POST /api/resumes 201 842ms"
  lib/              Business logic with no Express in it (parsing, ATS
                    scoring, AI calls, PDF generation, validation)
test/
  app.test.js       node:test suite (`npm test`)
```

Request flow: `requestLogger → cors → cookies → JSON body → /api router →
requireAuth (per router) → handler → errorHandler`.

## Adding a new API

1. Put the business logic in `src/lib/<thing>.js` (plain functions, easy to test).
2. Create `src/routes/<thing>.js`:

   ```js
   import { Router } from 'express';
   import { query } from '../db.js';
   import { requireAuth } from '../middleware/auth.js';
   import { badRequest, notFound } from '../errors.js';

   const router = Router();
   router.use(requireAuth); // every route below needs a logged-in user

   router.get('/:id', async (req, res) => {
     const { rows } = await query('SELECT * FROM things WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
     if (!rows[0]) throw notFound('Thing not found.');
     res.json({ thing: rows[0] });
   });

   export default router;
   ```

3. Mount it with one line in `src/routes/index.js`: `api.use('/things', thingRoutes);`
4. Add tests to `test/`.

Conventions:

- **Errors:** `throw` an `HttpError` (or `badRequest()`, `notFound()`, …) from
  sync or async code. Express 5 forwards it to the error handler, which
  responds `{ "error": "message", "code": "OPTIONAL_CODE" }`. Anything else
  that throws becomes a logged 500 with a generic message, so internals never
  leak. No try/catch is needed just to return errors.
- **Ownership:** always filter by `req.user.id` so users only see their own data.
- **Config:** read settings from `config` (`src/config.js`), never `process.env`
  directly. Add new variables there and to `.env.example`.
- **Responses:** JSON objects keyed by resource (`{ resume }`, `{ resumes: [] }`),
  camelCase fields.

## Git workflow

Do not push to `main`. Create a branch (`backend/<short-name>`), push it, and
open a pull request for review.
