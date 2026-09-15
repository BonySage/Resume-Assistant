# Team Workflow

Keep it simple: one branch per person/feature, merge into `main` when it works.

## Branching

- `main` — the working version of the app. Don't push broken code directly to it.
- Everyone works on their own branch:
  ```
  feature/login
  feature/resume-upload
  feature/ats-scoring
  fix/upload-bug
  ```

## Daily flow

```bash
git checkout main
git pull
git checkout -b feature/your-task

# ...do the work...

git add .
git commit -m "add resume upload form"
git push -u origin feature/your-task
```

Then open a Pull Request into `main` on GitHub. Have at least one teammate glance at it before merging — mainly to catch conflicts, not a formal review process.

## Commit messages

Keep them short and say what changed:
```
add login form
fix upload crash on large files
connect ATS score to backend
```

## Avoiding conflicts

- Pull before you start working each session
- Keep your branch focused on one task so PRs stay small
- If two people need to touch the same file, say so in the group chat first

## Issues / Tasks

Use GitHub Issues or Discord or Notion, whichever the team prefers to track who's doing what. One issue per task from the breakdown, assigned to a person.