# Omni One — Backend

Production REST API server for the Omni One AI orchestration platform.

**Stack:** Fastify 4 · TypeScript 5 (strict) · Pino · Zod · OpenAPI 3.0

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Set at least one AI provider key in .env
# OPENAI_API_KEY=sk-...

# 3. Install dependencies
npm install

# 4. Run in development mode
npm run dev

# 5. Open API docs
open http://localhost:3001/docs
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with hot-reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run typecheck` | TypeScript strict type check |
| `npm test` | Run test suite |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Full system health check |
| GET | `/version` | App version and build info |
| GET | `/status` | Lightweight operational status |
| POST | `/chat` | AI chat completion |
| POST | `/tools/execute` | Execute a registered tool |
| POST | `/agents/run` | Run an agent task |
| GET | `/docs` | Swagger UI |

## Environment Variables

See `.env.example` for all supported variables with descriptions.

## Architecture

See `../docs/BACKEND_ARCHITECTURE.md` for the full architecture document.
