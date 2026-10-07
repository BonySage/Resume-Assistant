# Frontend

React web application for the AI Resume Assistant. It owns the main frontend entry point and connects to the backend API through Vite.

## Screens and requirements

The SRS calls for:

- Login and registration with validation and session-expiration handling
- Resume upload, progress, resume list, and deletion
- Job posting input by URL or pasted description, with a fallback when URL extraction fails
- Analysis results with a match score, keyword groups, recommendations, and selectable bullets
- Three AI bullet rewrites with edit, select, and save states
- PDF export and preview

The interface should be responsive, sanitize user input, provide clear errors, and support current Chrome, Firefox, Safari, and Edge. See the SRS for the complete requirements.

## Backend integration

- The API base URL can be configured with `VITE_API_BASE_URL`.
- Local Vite development proxies `/api` to `http://localhost:3000`.
- Never put API keys in frontend code.

## UI design prototype

Standalone HTML, CSS, and JavaScript prototype screens with sample data are included alongside the React app. They have no backend integration and are not the app entry point; `index.html` loads the React application.

| Page | File |
| --- | --- |
| Log in / Sign up | `login.html` |
| Dashboard | `dashboard.html` |
| Job posting | `job.html` |
| Match results | `results.html` |
| Improve bullets | `improve.html` |
| Export | `export.html` |
| Confirmation | `done.html` |
| Settings | `settings.html` |
| Style guide | `styleguide.html` |

Prototype styles are in `css/styles.css`; shared behavior is in `js/app.js`; sample data is in `js/data.js`; page behavior is in `js/pages/`. The exported design PDF is in `docs/UI-Design.pdf`.

## Setup

From this directory:

```bash
npm install
npm run dev   # http://localhost:5173
```

The Vite development server proxies `/api` to the backend on port 3000. Run `npm run lint` for oxlint.

To preview a prototype screen, open its HTML file with a local static server such as VS Code Live Server. Prototype login accepts any email and a password of at least 8 characters. Reset its sample data with `localStorage.clear()` in the browser console.

To rebuild the design PDF, run `npm run pdf` from the repository root; Google Chrome is required.

## Git workflow

Do not push to `main`. Create a branch, push it, and open a pull request for review.
