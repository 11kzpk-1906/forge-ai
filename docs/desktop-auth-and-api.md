# Desktop authentication and API setup

## Google sign-in in the Windows app

The Electron app opens Google's authorization page in the system browser and returns to the app through the `forgeai://auth/callback` protocol.

In Supabase Dashboard:

1. Enable the Google provider under Authentication → Providers and configure the Google OAuth client.
2. Under Authentication → URL Configuration, add `forgeai://auth/callback` to the allowed redirect URLs.
3. In Google Cloud Console, set the Supabase callback URL (shown in the Supabase Google provider settings, normally `https://<project-ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI. Do not use `forgeai://auth/callback` as Google's provider callback; that is the final redirect from Supabase back to the desktop app.

Email/password sign-in does not require the custom protocol. Test Google sign-in in a packaged build after configuring both dashboards.

## API URL for a production build

The packaged desktop application does not bundle a Python runtime or the FastAPI service. Configure `VITE_API_URL` in `apps/web/.env` to the HTTPS base URL of a deployed ForgeAI API before building the frontend and installer. Do not use `127.0.0.1` for a public release unless the API is deliberately installed and launched locally.

For local development, leave `VITE_API_URL` unset to use `http://127.0.0.1:8000`, and start FastAPI separately.

Configure the deployed API's `CORS_ORIGINS` with the exact web origins it should trust, including `forgeai://app` for the packaged desktop renderer. Do not use wildcard origins with credentials.

## Server-only environment variables

Copy `apps/api/.env.example` to `apps/api/.env` and set the real server-side values. Keep `SUPABASE_SECRET_KEY` and `GROQ_API_KEY` on the backend only; never add either secret to `apps/web/.env` or the packaged frontend.
