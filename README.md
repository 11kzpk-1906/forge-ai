# ForgeAI

⚙️ **ForgeAI — AI Software Engineer**

ForgeAI is an engineering-focused AI assistant designed to help developers understand code, investigate bugs, plan software architecture, and improve their development workflow.

> ForgeAI is actively being developed. Features and deployment readiness can change between releases.

## Current stack

- **Web:** React, TypeScript, Vite
- **API:** Python, FastAPI
- **AI provider:** Groq
- **Authentication and persistence:** Supabase
- **Hosting:** Vercel (web) and Render (API), when configured

## Local development

### Prerequisites

- Node.js 22+
- pnpm 12+
- Python 3.11+
- A Supabase project
- A Groq API key

### 1. Configure the API

Copy `apps/api/.env.example` to `apps/api/.env` and set the server-side values:

- `GROQ_API_KEY`
- `GROQ_MODEL` (optional; defaults to the model in the example)
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `CORS_ORIGINS` (comma-separated exact browser origins)

Install and run the API from `apps/api` using the commands documented in its `pyproject.toml`. The development API defaults to `http://127.0.0.1:8000`.

### 2. Configure the web app

Copy `apps/web/.env.example` to `apps/web/.env` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

For local development, leave `VITE_API_URL` unset; the web app defaults to the local API. Never put a Groq key or Supabase server-side secret in a `VITE_*` variable.

### 3. Install and run the web app

From the repository root:

```bash
pnpm install
pnpm --filter @forgeai/web dev
```

Build and type-check the frontend with:

```bash
pnpm --filter @forgeai/web build
```

For production deployment requirements, environment variables, and authentication redirect setup, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Engineering modes

The API prompt engine defines modes for explaining, debugging, architecture, code review, implementation, testing, security, DevOps, and optimization. The actual behavior also depends on the configured AI provider and the current implementation.

## Contributing

Bug reports, feature proposals, documentation improvements, and pull requests are welcome. Please keep changes focused and include tests or verification steps where practical.

## Roadmap

Browse [open issues](https://github.com/11kzpk-1906/forge-ai/issues) and [pull requests](https://github.com/11kzpk-1906/forge-ai/pulls).

## License

See the repository's `LICENSE` file for licensing terms.
