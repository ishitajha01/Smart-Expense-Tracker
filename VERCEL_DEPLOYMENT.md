# Deploying Sprout with Vercel Services

The repository defines two services in `vercel.json`:

- `backend` runs Django and receives public requests under `/api/*`.
- `frontend` builds the Vite app and receives all other public paths.

Both are reached through one Vercel project and domain. The React app calls
`/api/` on the current origin; Vercel routes those requests to Django. Local
Vite development proxies `/api/` to `http://127.0.0.1:8000`.

## Environment variables

Configure these in the Vercel project settings; do not commit secrets:

- `SECRET_KEY`: a new, long random Django secret.
- `DATABASE_URL`: a managed PostgreSQL connection string. The local SQLite
  database is for development and does not provide durable hosted storage.
- `GEMINI_API_KEY`: the server-side Gemini key.
- `GEMINI_MODEL`: optional; defaults to `gemini-3.5-flash-lite`.
- `DEBUG`: set to `False` for Production and Preview.
- `ALLOWED_HOSTS`: optional for standard `*.vercel.app` domains; set it to
  include any custom domain you attach.

Vercel's `VERCEL_URL` is also added to Django's allowed hosts automatically.

The current frontend origin `https://smart-expense-tracker-6xem.vercel.app` is
included in Django's default CORS allowlist. If you set `CORS_ALLOWED_ORIGINS`
in the backend deployment, include that origin in the comma-separated value.
Add any future preview or custom frontend origins explicitly as well.

## Connecting the deployed frontend

If frontend and backend are deployed as the two services in this repository's
`vercel.json`, leave `VITE_API_BASE_URL` unset: `/api/` is routed to Django on
the shared project domain. If the hosted frontend is a separate Vercel project
from the backend, set `VITE_API_BASE_URL` in the frontend project's environment
to the backend's full API URL, including `/api/` (for example,
`https://your-backend-domain/api/`), and redeploy the frontend. The backend
must allow the exact frontend origin through `CORS_ALLOWED_ORIGINS`.

## Database migrations

Apply Django migrations to the configured PostgreSQL database before using the
deployment. Do not point a production deployment at the repository's SQLite
file.
