# Omni One: Authentication Architecture

**Phase:** 16.3 (Authentication, Security & Multi-User Platform)
**Author:** Manus AI
**Date:** July 10, 2026

This document details the authentication system of Omni One, covering user registration, login, session management, and OAuth integrations.

---

## 1. User Identity

The `User` model in PostgreSQL is the central entity for authentication. It has been extended to include:
- `email` (unique, primary identifier)
- `passwordHash` (for email/password users)
- `username` (optional, unique, for public profiles)
- `displayName`, `avatarUrl`, `bio`, `timezone`, `language` (for user profiles)
- `role` (for RBAC: `OWNER`, `ADMIN`, `USER`, `GUEST`)
- `status` (e.g., `ACTIVE`, `PENDING_VERIFICATION`, `SUSPENDED`)
- `emailVerified` (boolean for email confirmation)
- `lastSeenAt` (timestamp of last activity)
- `preferences` (JSONB for user-specific settings)

---

## 2. Registration & Login

### Email and Password
- **Registration (`POST /auth/register`):** Users provide email, password, and optional display name. Passwords are hashed using `bcrypt` before storage. A new session is created upon successful registration.
- **Login (`POST /auth/login`):** Users provide email and password. The password is compared against the stored hash. A new session is created upon successful login.
- **Forgot/Reset Password:** (Future expansion) Placeholder for email-based password reset flow.

### OAuth (Google, GitHub)
- **OAuthAccount Model:** Stores provider-specific user IDs, access tokens, and refresh tokens. This allows users to link multiple OAuth providers to a single Omni One account.
- **Integration:** Fastify OAuth2 plugin will be used to handle the OAuth flow, redirecting users to Google/GitHub for authentication and receiving callbacks.

---

## 3. Session Management

Omni One uses a robust session management system to track user activity and provide security features.

### Session Model
- `id` (unique session identifier)
- `userId` (links to the `User`)
- `tokenHash` (SHA256 hash of the session token stored in the client's cookie)
- `deviceName`, `browser`, `os`, `ip`, `country` (metadata for active devices)
- `isActive` (boolean, allows invalidating sessions)
- `lastUsedAt` (timestamp of last activity)
- `expiresAt` (session expiration date)

### Session Flow
1. **Creation:** Upon successful login or registration, a secure, random session token is generated. Its SHA256 hash is stored in the `Session` table, and the raw token is sent to the client in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
2. **Validation:** On subsequent requests, the `authenticate` middleware extracts the session token from the cookie, hashes it, and looks up the `Session` in the database. It verifies `isActive` and `expiresAt`.
3. **Activity Tracking:** `lastUsedAt` is updated on each successful session validation.
4. **Revocation:** Users can view and terminate active sessions (`DELETE /sessions/:id`, `DELETE /sessions`). This deactivates the session in the database, rendering the token invalid.

---

## 4. JWT (JSON Web Tokens)

While sessions are managed via database, JWTs can be used for specific, short-lived access tokens or for API key authentication. The system is designed to support both.

- **Access Token:** Short-lived, used for API authorization. Can be issued as Bearer tokens.
- **Refresh Token:** Longer-lived, used to obtain new access tokens without re-authenticating. (Future expansion: integrated with session management).

---

## 5. Email Verification & Password Reset

(Future expansion) The `emailVerified` field and `passwordHash` structure are in place to support:
- Sending verification emails upon registration.
- Generating secure, time-limited tokens for password reset links.

---
*End of Document*
