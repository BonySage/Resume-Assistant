# 🧪 Manual Test Plan (Resume Assistant)

This document is a manual QA testing checklist. Before submitting the final project or merging major features, the team should run through this checklist to verify that all edge cases and core flows are working flawlessly.

## 1. Authentication (`/login`, `/signup`)
- [ ] **Valid Signup:** Sign up with a valid email and 8+ char password with a number and capital letter. Should succeed and redirect to `/dashboard`.
- [ ] **Invalid Email:** Try to sign up with `not-an-email`. Should show validation error.
- [ ] **Weak Password:** Try to sign up with `password`. Should show validation error requiring numbers/caps.
- [ ] **Duplicate Account:** Try to sign up with an email that already exists. Should show "Account exists" error.
- [ ] **Login Double-Submit:** Click the "Log in" button 5 times rapidly. Should disable the button and only send 1 request.
- [ ] **Logout:** Click "Log out" and try to navigate back to `/dashboard`. Should redirect to `/login`.

## 2. Resume Management (`/dashboard`)
- [ ] **Valid Upload:** Upload a standard PDF or DOCX under 10MB. Should parse successfully and show the number of bullets extracted.
- [ ] **File Size Limit:** Try to upload a file larger than 10MB. Should fail gracefully with a readable error message.
- [ ] **Wrong File Type:** Try to upload a `.jpg` or `.txt` file. Should show "Only PDF or DOCX" error.
- [ ] **Corrupt File:** Upload a fake PDF (e.g., a text file renamed to `.pdf`). Should catch the fake file signature and show an error.
- [ ] **Delete Resume:** Click the delete icon on a resume. Should immediately remove it from the list.

## 3. Job Posting Input (`/job`)
- [ ] **Valid URL Scraping:** Paste a valid job URL. Should scrape the text, show "Job Found", and display keyword counts.
- [ ] **Invalid URL:** Paste a fake URL (`http://not-a-real-site.com`). Should timeout (or fail) and suggest using the manual paste fallback.
- [ ] **Manual Text Paste:** Switch to the text tab and paste a job description. 
- [ ] **Spam Click Prevention:** Paste text and click "Analyze Match" multiple times rapidly. Should only create ONE job posting in the database.
- [ ] **Empty Text:** Try to analyze with < 50 characters of text. Should show an error that it's too short.

## 4. Analysis & ATS Scoring (`/results`)
- [ ] **Keyword Matching:** Ensure keywords ending in symbols (like `C++`, `C#`) are correctly highlighted in the text and recognized in the matched/missing lists.
- [ ] **Score Calculation:** Score should accurately reflect the percentage of critical (weight 2) vs secondary (weight 1) keywords found.
- [ ] **Missing Keywords:** Ensure the recommendations list mentions the top missing critical keywords.

## 5. AI Bullet Enhancement (`/improve`)
- [ ] **Generation:** Select a bullet and click "Generate". Should wait ~3-10s and return 3 distinct options.
- [ ] **Hallucination Check:** If an AI option includes a job keyword that is *not* found anywhere in the original resume evidence, it should be visually flagged to warn the user.
- [ ] **Manual Editing:** Select an option and manually type to edit it. Should save successfully.
- [ ] **Error Handling:** Disconnect internet or use an invalid API key. Should show a friendly "AI service unavailable" message and allow manual editing instead of crashing.

## 6. PDF Export (`/done`)
- [ ] **Rebuilt PDF:** Click "Export PDF". The downloaded file should be a clean, rebuilt PDF containing the *new* selected bullets instead of the old ones.
- [ ] **Formatting:** Ensure the name, contact info, and section headers (Experience, Skills, Education) are correctly formatted and aligned in the exported PDF.

---

# 🤖 Automated Tests

Run these before every commit. CI runs all of them on every pull request.

| Suite | Command | Needs a database? |
|---|---|---|
| Backend unit + HTTP tests | `cd backend && npm test` | No |
| Backend database integration tests (`backend/test/db.integration.test.js`) | `cd backend && npm test` with `TEST_DATABASE_ADMIN_URL` set | Yes |
| Frontend unit tests | `cd frontend && npm test` | No |
| Frontend lint / build | `cd frontend && npm run lint && npm run build` | No |

## Database integration tests

These run the real migrations against Postgres and check login plus the row-level security policies (migration 007): one user must never read, change, or delete another user's data, both at the SQL level and through the API.

Without `TEST_DATABASE_ADMIN_URL` they are **skipped** locally (and **fail** in CI, so they can't be skipped by accident). To run them, start a **throwaway** Postgres on a separate port:

```bash
docker run -d --rm --name resume-test-db -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:55432:5432 postgres:16

cd backend
TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres npm test

docker stop resume-test-db   # deletes it (--rm)
```

On Windows PowerShell, set the variable with `$env:TEST_DATABASE_ADMIN_URL = "postgres://postgres:postgres@127.0.0.1:55432/postgres"` and then run `npm test`.

> ⚠️ Don't point this at the `docker compose` database or production. Each run creates and drops its own `resume_test_*` database, but the migration also resets the password of the server-wide `resume_app` role.
