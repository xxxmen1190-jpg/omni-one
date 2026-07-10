# Omni One: Database & Persistence Architecture

**Phase:** 16.2 (Production Database & Persistence Layer)
**Author:** Manus AI
**Date:** July 10, 2026

This document details the persistence layer of Omni One, covering PostgreSQL, Redis, Vector Storage, and File Storage abstractions.

---

## 1. Relational Layer (PostgreSQL)

We use **PostgreSQL** as our primary source of truth for structured data. Interaction is managed via **Prisma ORM** (v7) for type-safety and automated migrations.

### Data Models
- **User:** Identity, settings, and relationships to all other resources.
- **Conversation & Message:** Full chat history with token counts and metadata.
- **Project:** Organizational units for grouping conversations and files.
- **File:** Metadata for uploaded assets, linked to storage providers.
- **Agent & Task:** Orchestration state for autonomous agents.
- **AuditLog:** System-wide activity tracking for security and debugging.
- **ApiKey:** Management of user-generated keys for API access.

### Repository Pattern
All database interactions are encapsulated in the **Repository Layer** (`backend/src/database/*Repository.ts`). This ensures:
- **Separation of Concerns:** Business logic doesn't know about Prisma specifics.
- **Testability:** Repositories can be easily mocked in unit tests.
- **Transaction Support:** Complex multi-model operations are wrapped in `BaseRepository.transaction`.

---

## 2. Caching & State (Redis)

**Redis** is used for high-performance, temporary data storage:
- **Cache:** AI response caching and frequently accessed metadata.
- **Rate Limiting:** Distributed request counting.
- **Session Store:** (Phase 16.3) User session persistence.
- **Job Queue:** (Phase 16.3) Background task orchestration.

---

## 3. Semantic Layer (pgvector)

For RAG (Retrieval-Augmented Generation) and Long-Term Memory, we use the **pgvector** extension on PostgreSQL.

- **Model:** `Memory`
- **Embedding:** 1536-dimensional vectors (OpenAI standard).
- **Search:** Cosine distance similarity (`<=>` operator) executed via Prisma raw queries for maximum performance.

---

## 4. File Storage Abstraction

The `StorageService` provides a unified interface for file persistence, supporting two providers:
- **Local:** Stores files on the server's disk (useful for development/on-prem).
- **S3:** Production-ready storage using Amazon S3 or any S3-compatible API (MinIO, R2).

Files are stored using a content-addressable or UUID-based key system, with metadata stored in the PostgreSQL `File` model.

---

## 5. Health & Monitoring

The `/health` endpoint now performs live connectivity checks:
- **PostgreSQL:** Executes a `SELECT 1` probe.
- **Redis:** Executes a `PING` probe.
- **Storage:** Reports the active provider (`local` | `s3`).

If any critical persistence service is disconnected, the health status switches from `healthy` to `degraded`.

---
*End of Document*
