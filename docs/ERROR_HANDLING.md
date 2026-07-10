# Error Handling & Tracking System
**Omni One - Beta Reliability Phase**

## Overview
The centralized error tracking system in Omni One ensures that all exceptions—whether in the frontend, backend, or AI orchestration layer—are captured, categorized, and reported effectively without exposing sensitive stack traces to the user.

## Error Categories & Severity Levels

Errors are classified into the following categories:

| Category | Description | Severity | Recoverable |
| :--- | :--- | :--- | :--- |
| **Network** | Connectivity issues, DNS failures, connection refused. | High | Yes |
| **Timeout** | AI provider or database request exceeded time limits. | Medium | Yes |
| **Validation** | Invalid user input or malformed payload. | Low | Yes |
| **Memory/OOM** | System out of memory or heap exhaustion. | High | No |
| **Authentication** | Invalid tokens, expired sessions, missing permissions. | Medium | Yes |
| **AI Provider** | Rate limits or 500 errors from external AI models. | Medium | Yes (Fallback) |

## Centralized Error Tracking

### Backend
The backend utilizes a centralized middleware (`errorHandler.ts`) to intercept all unhandled exceptions:
- **Logging**: Errors are logged using Pino, including the `x-request-id` for traceability.
- **Sanitization**: Stack traces are stripped from API responses.
- **Standardized Responses**: The client always receives a JSON payload containing `success: false`, an error `code`, `message`, and `requestId`.

### Frontend
The React frontend implements global error boundaries and interceptors:
- **ErrorBoundary**: Catches rendering errors and displays a user-friendly fallback UI (`<ErrorBoundary />`).
- **Axios Interceptors**: Global interceptors catch 401/403 errors to trigger automatic re-authentication or redirect to the login screen.
- **Zustand State**: Stores (`useAuthStore`, `useChatStore`) manage local error states and provide `clearError()` functions to allow users to retry actions.

## User-Friendly Error Messages
Instead of technical jargon, the system maps internal error codes to user-friendly messages:
- `RATE_LIMITED`: "Too many requests. Please wait a moment and try again."
- `NETWORK_ERROR`: "There's a network issue. Please check your connection and try again."
- `TIMEOUT`: "The request took too long to process. Try a simpler query or enable Speed mode."

## Production Error Reports
In production, unhandled promise rejections and uncaught exceptions trigger alerts via the centralized monitoring system (integrated with tools like Sentry/Datadog if configured), and are persisted in the `AuditLog` table for historical analysis.
