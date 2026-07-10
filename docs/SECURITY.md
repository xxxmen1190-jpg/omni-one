# Omni One: Security Architecture

**Phase:** 16.3 (Authentication, Security & Multi-User Platform)
**Author:** Manus AI
**Date:** July 10, 2026

This document outlines the security measures implemented in the Omni One backend to protect data, prevent unauthorized access, and ensure system integrity.

---

## 1. Authentication & Authorization

### User Authentication
- **Email/Password:** Passwords are never stored directly. Instead, they are hashed using `bcrypt` (a strong, adaptive hashing algorithm) with a randomly generated salt. This protects against rainbow table attacks and ensures that even if the database is compromised, passwords cannot be recovered.
- **OAuth2:** Integration with external providers like Google and GitHub allows users to authenticate without creating a new password. Access and refresh tokens from these providers are encrypted using AES-256-GCM before storage in the `OAuthAccount` model.

### Session Management
- **HttpOnly Cookies:** Session tokens are stored in `HttpOnly` cookies, preventing client-side JavaScript from accessing them and mitigating XSS attacks.
- **Secure Cookies:** Cookies are marked `Secure` to ensure they are only sent over HTTPS connections, protecting against man-in-the-middle attacks.
- **SameSite=Strict:** Prevents CSRF attacks by ensuring cookies are only sent with requests originating from the same site.
- **Session Invalidation:** Sessions can be explicitly invalidated by the user (logout, logout all devices) or automatically expire, reducing the window of opportunity for hijacked sessions.

### Role-Based Access Control (RBAC)
- **User Roles:** The system defines distinct roles (`OWNER`, `ADMIN`, `USER`, `GUEST`) with hierarchical privileges.
- **Authorization Middleware:** The `authorize` middleware checks the user's role against required permissions for specific API endpoints, ensuring that only authorized users can perform certain actions.

---

## 2. API Security

### Request Validation
- **JSON Schema Validation:** All incoming API requests (body, params, querystring) are rigorously validated against predefined JSON Schemas using Fastify's built-in validation. This prevents malformed requests, injection attacks (SQL, NoSQL, XSS), and ensures data integrity.
- **Input Sanitization:** (Implicitly handled by schema validation and strict typing) All user-provided input is treated as untrusted.

### Security Headers (Helmet)
- **Content Security Policy (CSP):** Mitigates XSS and data injection attacks by controlling which resources the browser is allowed to load.
- **X-Frame-Options:** Prevents clickjacking attacks by disallowing embedding the application in iframes.
- **Strict-Transport-Security (HSTS):** Enforces HTTPS for all future connections, protecting against protocol downgrade attacks.
- **X-Content-Type-Options:** Prevents MIME-sniffing attacks.

### Cross-Origin Resource Sharing (CORS)
- **Whitelisting:** Only explicitly configured origins (`config.cors.origins`) are allowed to make cross-origin requests, preventing unauthorized domains from interacting with the API.

### Rate Limiting
- **Global Rate Limiting:** Prevents brute-force attacks, denial-of-service (DoS), and resource exhaustion by limiting the number of requests a single IP address can make within a time window.
- **Configurable:** Rate limits are configurable via environment variables (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`).

### Request Size Limits
- **Body Limit:** A global request body limit (10MB) prevents large payload attacks that could consume server memory and bandwidth.

---

## 3. Data Protection

### Encryption at Rest
- **Sensitive Data:** API Keys, OAuth tokens, and other sensitive configuration values are encrypted using **AES-256-GCM** before being stored in the database. A unique, securely generated encryption key (`ENCRYPTION_KEY`) is required for this process.

### Logging & Monitoring
- **Structured Logging (Pino):** All application logs are structured (JSON) for easy parsing and analysis by security information and event management (SIEM) systems.
- **Sensitive Data Redaction:** The logger automatically redacts sensitive information (e.g., `authorization` headers, `password` fields) from logs to prevent accidental exposure.
- **Audit Logs:** The `AuditLog` model tracks critical security-related events (logins, logouts, permission changes, API calls) for forensic analysis and compliance.

### Error Handling
- **No Stack Traces to Client:** The centralized error handler (`errorHandler` middleware) ensures that detailed stack traces are never exposed to the client, preventing information leakage that could aid attackers.
- **Generic Error Messages:** Clients receive generic error messages for unhandled exceptions, while detailed errors are logged internally.

---

## 4. Operational Security

### Environment Variables
- **Strict Validation:** All environment variables are strictly validated at startup using Zod. The application will not start if critical security-related variables (e.g., `JWT_SECRET`, `ENCRYPTION_KEY`) are missing or malformed.
- **No Hardcoded Secrets:** All secrets and sensitive configurations are loaded from environment variables, never hardcoded in the codebase.

### Dependency Management
- **Regular Audits:** Dependencies are regularly audited for known vulnerabilities using `npm audit`.

---
*End of Document*
