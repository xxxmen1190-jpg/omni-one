# Omni One: Backend Architecture

**Phase:** 16.1 (Production Backend Foundation)
**Author:** Manus AI
**Date:** July 10, 2026

This document outlines the architecture, structure, and request lifecycle of the Omni One production backend. The backend is designed to be a highly scalable, modular REST API that acts as the execution layer for the OmniBrain AI orchestrator.

---

## 1. Core Architecture

The backend is built on **Fastify 4** and **TypeScript 5** with strict typing enabled. It uses a layered, modular architecture to ensure separation of concerns. The server is completely stateless, making it ready for horizontal scaling behind a load balancer.

### Technology Stack
- **Framework:** Fastify
- **Language:** TypeScript (NodeNext module resolution)
- **Validation:** JSON Schema (Fastify native) & Zod (Environment config)
- **Logging:** Pino (Structured JSON logging)
- **Security:** Helmet, CORS, Rate Limiting
- **API Docs:** Swagger (OpenAPI 3.0)

---

## 2. Folder Structure

The project is structured under the `backend/src` directory:

```text
backend/
├── src/
│   ├── api/
│   │   ├── routes/      # Fastify route definitions and endpoint logic
│   │   └── schemas/     # JSON Schemas for validation (future expansion)
│   ├── auth/            # Authentication logic (Phase 16.3)
│   ├── config/          # Environment variable loading and Zod validation
│   ├── database/        # Database connection and queries (Phase 16.2)
│   ├── middleware/      # Fastify hooks (ErrorHandler, RequestLogger, RequestId)
│   ├── server/          # Fastify app builder (app.ts) and entry point (index.ts)
│   ├── services/        # Core business logic (e.g., providerStatus)
│   ├── types/           # Global TypeScript interfaces and types
│   └── utils/           # Shared utilities (logger, response builders)
├── package.json
└── tsconfig.json
```

---

## 3. Request Lifecycle & Flow

Every incoming request follows a strict, predictable pipeline:

1. **Connection & Rate Limiting:** Request hits the Fastify server. The Rate Limit plugin checks the IP/Forwarded-For header. If exceeded, returns `429 Too Many Requests`.
2. **Security Headers & CORS:** Helmet injects security headers (CSP, X-Frame-Options). CORS plugin verifies origins.
3. **Request ID Generation:** The `onRequest` hook checks for an `x-request-id` header. If absent, a UUID is generated and attached to the request.
4. **Request Logging:** A child Pino logger is created containing the `requestId`. The incoming request is logged.
5. **Schema Validation:** Fastify validates the request body, params, and querystring against the route's JSON Schema. If invalid, returns `400 Bad Request`.
6. **Route Handler:** The specific route logic executes (calling `services` as needed).
7. **Response Builder:** The handler wraps the payload using the `successResponse` utility.
8. **Response Logging:** The `onResponse` hook logs the completion time and status code.

### Error Flow

If an error occurs at any point during the lifecycle:
1. The error is caught by the centralized `errorHandler` middleware.
2. If it is a known `AppError`, it is logged as a warning and returns the specified status code (e.g., `404`, `503`).
3. If it is a Fastify validation error, it returns `400`.
4. If it is an unhandled exception, it is logged as an error with the full stack trace (in the server logs), and returns a generic `500 Internal Server Error` to the client.
5. **Stack traces are never exposed to the client.**

---

## 4. API Overview

All endpoints are fully documented via Swagger UI at `/docs`.

| Endpoint | Method | Description | Security |
|---|---|---|---|
| `/health` | GET | Comprehensive system health, memory, uptime, and AI provider status. | None |
| `/version` | GET | App version, build number, and environment info. | None |
| `/status` | GET | Lightweight operational status for load balancers. | None |
| `/chat` | POST | Submits a conversation history for AI completion. | API Key |
| `/tools/execute` | POST | Executes a registered tool (e.g., web_search). | API Key |
| `/agents/run` | POST | Submits a task to the agent orchestration system. | API Key |

---

## 5. Security Posture

- **Validation:** No request reaches business logic without passing strict JSON Schema validation.
- **Logging Redaction:** Pino automatically redacts sensitive headers (e.g., `authorization`, `x-api-key`) and payload keys (e.g., `password`, `secret`).
- **Body Limits:** Global request body limit set to 10MB to prevent payload exhaustion attacks.
- **Rate Limiting:** Global rate limit configured via `.env` (default: 100 requests per minute).

---

## 6. Future Expansion Preparedness

The backend is intentionally scaffolded to support the next phases seamlessly:
- **Phase 16.2 (Database):** The `src/database` folder is ready for PostgreSQL/Prisma/Drizzle.
- **Phase 16.3 (Auth & Redis):** The `src/auth` folder is ready for JWT/OAuth integration, and the config layer is ready to accept `REDIS_URL`.
- **Deployment:** The `dist/server/index.js` output is container-ready. Environment variables strictly dictate behavior (no hardcoded credentials).

---
*End of Document*
