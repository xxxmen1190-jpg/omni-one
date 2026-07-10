# Omni One: Multi-User Platform Architecture

**Phase:** 16.3 (Authentication, Security & Multi-User Platform)
**Author:** Manus AI
**Date:** July 10, 2026

This document describes the architecture enabling Omni One to function as a multi-user platform, focusing on user management, roles, permissions, and personalization.

---

## 1. User Management

At the core of the multi-user platform is the enhanced `User` model in PostgreSQL. This model now captures comprehensive user profiles and preferences:

- **Basic Profile:** `email`, `username`, `displayName`, `avatarUrl`, `bio`.
- **Localization:** `timezone`, `language` for personalized experience.
- **Account Status:** `role`, `status`, `emailVerified`, `lastSeenAt` for administrative control and user lifecycle management.
- **Personalization:** `preferences` (JSONB field) stores user-specific settings like theme, AI defaults, privacy settings, voice preferences, and provider configurations.

---

## 2. Role-Based Access Control (RBAC)

Omni One implements a robust RBAC system to manage user permissions and access to features.

### Roles
Defined in the `UserRole` enum:
- **OWNER:** Full administrative control, typically the creator of the Omni One instance.
- **ADMIN:** Comprehensive administrative privileges, managing users, settings, and system resources.
- **USER:** Standard user with access to core functionalities like chat, tools, agents, and project management.
- **GUEST:** Limited access, primarily for viewing public content or specific shared resources (future expansion).

### Permissions
Permissions are implicitly managed by roles and enforced by the `authorize` middleware. Examples of features controlled by permissions include:
- **Chat:** Access to AI chat functionalities.
- **Files:** Ability to upload, download, and manage files.
- **Agents:** Ability to create, run, and manage AI agents.
- **Projects:** Creation and management of projects.
- **Admin Dashboard:** Access to administrative interfaces and controls.
- **API Keys:** Management of personal API keys.

---

## 3. Session Management & Active Devices

The `Session` model tracks all active user sessions, providing transparency and control to the user.

- **Active Devices List:** Users can view a list of their active sessions, including `deviceName`, `browser`, `os`, `ip`, and `country`.
- **Remote Logout:** Users can terminate individual sessions (`DELETE /sessions/:id`) or all sessions (`DELETE /sessions`) from other devices, enhancing security in case of compromised credentials.
- **Last Login Tracking:** The `lastSeenAt` field on the `User` model and `lastUsedAt` on the `Session` model provide insights into user activity.

---

## 4. Personalization & User Settings

The `preferences` JSONB field in the `User` model allows for flexible storage of user-specific settings without requiring schema migrations for every new preference.

- **Backend Endpoints:** `PATCH /users/me` allows users to update their profile information and preferences.
- **Categories of Settings:**
    - **Theme:** UI theme preferences.
    - **Language:** Preferred display language.
    - **AI Defaults:** Default AI models, temperature, and other parameters.
    - **Privacy:** Data sharing and retention settings.
    - **Voice:** Text-to-speech and speech-to-text preferences.
    - **Notifications:** Email, in-app, or push notification settings.
    - **Memory:** Settings related to long-term memory and knowledge retention.
    - **Providers:** Configuration for external AI providers.

---

## 5. Backend Integration

The multi-user system integrates deeply with existing and future backend components:

- **Database:** All user-related data, sessions, and OAuth accounts are persistently stored in PostgreSQL.
- **OmniBrain:** Future integration will ensure AI responses are personalized based on user preferences and memory.
- **CloudSync:** (Future expansion) User data and settings will be synchronized across devices.
- **Projects & Conversation Library:** All these resources are now tied to a specific `userId`, enabling multi-tenancy.
- **API Gateway:** Authentication and authorization are enforced at the API Gateway level, protecting all downstream services.

---
*End of Document*
