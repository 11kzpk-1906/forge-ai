# ForgeAI deployment guide

ForgeAI uses a Vite/React web app, a FastAPI service, and Supabase for authentication and persisted conversations. Configure each service separately; frontend environment variables are embedded into the browser bundle and must never contain server-side secrets.

## Web app (Vercel)

Set these environment variables for the Vercel project that builds `apps/web`:

| Variable | Required | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable/anon client key |
| `VITE_API_URL` | Recommended | Full HTTPS origin of the deployed API, e.g. `https://your-service.onrender.com` |

Redeploy after changing environment variables: Vite reads them at build time. If `VITE_API_URL` is unset in a production browser build, ForgeAI falls back to the same-origin `/api` route. That fallback works only if the web host has a functioning API rewrite/proxy configured; with a separately hosted Render API, set `VITE_API_URL` explicitly.

## API (Render)

Configure the service to run the FastAPI application from `apps/api` using the project's Python dependency setup and an ASGI command equivalent to `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Set these server-side environment variables:

| Variable | Required | Value |
| --- | --- | --- |
| `GROQ_API_KEY` | Yes for AI responses | Groq API key |
| `GROQ_MODEL` | Optional | Model supported by your Groq account; defaults to the value in `apps/api/.env.example` |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Yes | Server-side Supabase secret; keep private |
| `CORS_ORIGINS` | Yes for cross-origin browser requests | Comma-separated exact origins, including the deployed Vercel origin and any local development origins you need |

Do not add a trailing path to the API URL in `VITE_API_URL`; use the service origin. The frontend calls paths such as `/api/v1/chat`.

## Supabase authentication

In Supabase Authentication URL configuration:

1. Set the production Site URL to the deployed web origin.
2. Add the exact production web origin and any required local development callback URLs to the redirect allow list.
3. Confirm the web app uses the project's matching URL and publishable key.

Do not expose `SUPABASE_SECRET_KEY` in the frontend or commit real environment files.

## Smoke-test checklist

After deployment, verify each step in a fresh browser session:

1. The web page loads without a missing-environment-variable error.
2. Sign-in and sign-out work.
3. The API health endpoint responds at `/api/v1/health` on the API origin.
4. Sending a chat message produces a streamed response.
5. A new conversation appears in history.
6. Reloading the page restores saved conversations and messages.
7. Browser developer tools show no CORS, authentication, or failed API requests.

If a request fails, check the API service logs, the browser Network tab, the deployed `VITE_API_URL`, the exact `CORS_ORIGINS` entries, and the Supabase redirect allow list before changing application code.
