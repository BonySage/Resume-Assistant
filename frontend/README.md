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

## UI design prototype (current)

This folder holds the clickable UI design for the UI Design assignment: plain
HTML, CSS and JavaScript with made-up sample data, and no backend yet. The React
app can reuse its screens, colors and components later.

| Page | File |
| --- | --- |
| Welcome | `index.html` |
| Log in / Sign up (Google, Apple, GitHub) | `login.html` |
| Dashboard | `dashboard.html` |
| Job posting | `job.html` |
| Match results | `results.html` |
| Improve bullets | `improve.html` |
| Export | `export.html` |
| Confirmation | `done.html` |
| Settings | `settings.html` |
| Style guide | `styleguide.html` |

Code layout: `css/styles.css` holds the whole design system (colors are at the
top), `js/app.js` has shared parts (icons, top bar, step bar, toasts, dialogs),
`js/data.js` has the sample data, and `js/pages/*.js` holds each page's behavior.

The exported PDF for submission is in `docs/UI-Design.pdf`.

## Setup

1. Clone the repo and switch to this branch:
   ```bash
   git clone https://github.com/BonySage/Resume-Assistant.git
   cd Resume-Assistant
   git checkout claude/project-thread-414zpn
   ```
2. Open the `Resume-Assistant` folder in VS Code (File → Open Folder).
3. Install the **Live Server** extension when VS Code suggests it.
4. Open `frontend/index.html` and click **Go Live** (bottom right). The site opens
   at http://localhost:5500 and reloads every time you save.

No VS Code? Double-click `frontend/index.html`, or run `npm start` from the repo
root (needs Node.js).

To rebuild the PDF after changing a screen, run `npm run pdf` from the repo
root (needs Google Chrome). It saves `exports/Resume-Assistant-UI-Design.pdf`.

Demo tips: log in with any email and an 8+ character password. A LinkedIn job
link shows the "couldn't read that page" fallback. To reset the demo data, run
`localStorage.clear()` in the browser console.

## Git workflow

Do not push to `main`. Create a branch (`frontend/<short-name>`), push it, and
open a pull request for review.
