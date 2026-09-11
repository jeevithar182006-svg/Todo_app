# Daymark

A responsive Markdown-backed todo app with task CRUD operations, due-date filtering, priorities, search, and progress reports using a Flask backend and Vite frontend.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## What is included

- Create, edit, complete, and delete tasks
- Status, priority, due-date, and tag fields
- Search plus status, priority, due-date, and sidebar filters
- Weekly report with completion, in-progress, overdue, due-soon, and priority metrics
- Flask API that reads and writes `tasks.md`

`tasks.md` is rewritten after each change, so it can be reviewed or edited outside the app. Install the Python dependency with `pip install -r requirements.txt`. The Flask API runs on port `3001`; Vite proxies `/api` requests in development.
