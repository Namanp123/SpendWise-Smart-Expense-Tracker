# SpendWise – Smart Expense Tracker

React + Vite frontend, FastAPI + SQLAlchemy backend, Recharts for charts.
Runs on a local SQLite file out of the box; switch to Supabase PostgreSQL by setting one variable.

## Run it (Windows)

**1. Backend** – terminal 1
```
cd D:\NAMAN\SPENDWISE\SpendWise\backend
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
API: http://127.0.0.1:8000 · interactive docs: http://127.0.0.1:8000/docs

**2. Frontend** – terminal 2
```
cd D:\NAMAN\SPENDWISE\SpendWise\frontend
rmdir /s /q node_modules
del package-lock.json
npm install
npm run dev
```
Open http://127.0.0.1:5173. On the empty dashboard click **Load sample data** to explore.

### The Rolldown / Vite error
It comes from the newer Rolldown-based Vite, whose native binding npm sometimes fails to install.
`package.json` now pins **Vite 5** (Rollup-based), which has no Rolldown. Deleting
`node_modules` and `package-lock.json` before `npm install` (as above) clears the broken install.

## Use Supabase instead of SQLite
1. Supabase dashboard → Project Settings → Database → copy the **Connection string (URI)**.
2. Copy `backend/.env.example` to `backend/.env` and paste it as `DATABASE_URL=...`.
3. Restart uvicorn. Tables are created automatically on startup.

`CURRENCY` in the same file (INR, USD, EUR, GBP) controls how amounts are shown.

## API
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health + which database is in use |
| GET/POST | `/api/transactions` | List (filter by `month`, `type`, `category`) / create |
| PUT/DELETE | `/api/transactions/{id}` | Edit / delete |
| GET | `/api/analytics?month=YYYY-MM` | Totals, category split, daily and 6-month series |
| GET | `/api/insights?month=YYYY-MM` | Smart insights |
| GET/PUT | `/api/budgets` | Budget status for a month / create or update a limit |
| DELETE | `/api/budgets/{id}` | Remove a budget |
| POST | `/api/seed-demo` | Load sample data (empty database only) |

## Roadmap
Milestones 1–5 (setup, API, dashboard, Vite fix, database + CRUD + budgets + insights) are done.
Next: user accounts and authentication (Supabase Auth), so each person sees only their own data.
