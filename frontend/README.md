# Frontend

React web application for the AI Resume Assistant. Responsible for the user
interface, form inputs, results display, and the resume editor.

## What to build (from the SRS)

Screens (SRS section 6):
1. Login / Registration: email and password fields, strength indicator,
   real-time validation, "Forgot Password" link
2. Resume Upload Dashboard: drag-and-drop upload, progress indicator, list of
   resumes with dates, delete button, PDF/DOCX-only warning
3. Job Posting Input: two tabs ("Paste URL" and "Paste Description"), loading
   state, error message with fallback prompt if URL extraction fails
4. Analysis Results Dashboard: match score (0-100) with red/yellow/green
   indicator, matched / missing (critical and secondary) / weak keyword lists,
   recommendations, selectable resume bullets
5. Bullet Improvement Interface: original bullet highlighted, 3 AI options,
   edit and select buttons, save button, loading state
6. Export / Download Page: PDF download (DOCX optional), optional preview

## Requirements that affect the frontend

- NFR-1.5: dashboard loads within 2 seconds
- NFR-2.4: sanitize input to prevent XSS
- NFR-3.1 to 3.4: intuitive UI, plain-English error messages, responsive on
  mobile and desktop, help tooltips for each feature
- NFR-4.2 / 4.3: show the copy-paste fallback if URL extraction fails; tell the
  user if the AI service is down and allow manual editing
- Supported browsers: latest Chrome, Firefox, Safari, Edge
- Session times out after 15 minutes of inactivity (FR-1.2); handle
  expired tokens gracefully

## Working with the backend

- API base URL comes from an environment variable (see `.env.example`)
- Agree on API endpoints and response shapes with the backend owner before
  building each screen
- Never put API keys in frontend code

## Setup

_To be filled in by the frontend owner: install steps, how to run locally, how
to run tests._

## Git workflow

Do not push to `main`. Create a branch (`frontend/<short-name>`), push it, and
open a pull request for review.
