# Omni One — Beta Launch Guide

This guide provides essential information for managing the Omni One platform during its beta phase. It covers user management, system monitoring, bug handling, and rollback procedures.

## 1. Beta User Management

### 1.1 Adding a Beta User

Beta users can be added to the system using invite codes. These codes can be generated and managed via the Admin Panel. Each invite code can be configured for a specific email address, a maximum number of uses, and an expiration date.

**Steps to Add a Beta User:**

1.  **Generate an Invite Code**: Access the Admin Panel (Frontend UI) or use the backend API endpoint `POST /admin/invites`.
    *   **Example API Request (Backend)**:
        ```json
        POST /admin/invites
        {
          "email": "beta.tester@example.com",
          "maxUses": 1,
          "expiresAt": "2027-12-31T23:59:59Z"
        }
        ```
    *   The API will return a unique `code` (e.g., `A1B2C3D4`).
2.  **Share the Code**: Provide the generated invite code to the beta user.
3.  **User Registration**: The beta user will use this code during their registration process on the Omni One platform. The system will validate the code, increment its usage count, and grant access.

### 1.2 Managing User Roles and Feature Flags

Administrators can adjust user roles and enable/disable specific features for beta users through the Admin Panel.

*   **Update User Role**: Use the `PATCH /admin/users/:id/role` API endpoint.
    *   **Example API Request (Backend)**:
        ```json
        PATCH /admin/users/a1b2c3d4-e5f6-7890-1234-567890abcdef/role
        {
          "role": "ADMIN"
        }
        ```
*   **Toggle Feature Flags**: Use the `POST /admin/features/toggle` API endpoint.
    *   **Example API Request (Backend)**:
        ```json
        POST /admin/features/toggle
        {
          "name": "new_ai_tool_x",
          "isEnabled": true
        }
        ```

## 2. System Monitoring

Effective monitoring is crucial during the beta phase to ensure stability and identify issues proactively. The Omni One backend exposes several metrics endpoints.

### 2.1 Accessing Metrics

All metrics endpoints require authentication and administrator privileges.

*   **Full Dashboard**: `GET /metrics`
    *   Provides a comprehensive overview of system, AI, and user activity metrics.
*   **System Health**: `GET /metrics/system`
    *   Includes uptime, memory usage, active requests, and error rates.
*   **AI Usage**: `GET /metrics/ai?window=60`
    *   Summarizes AI requests, latency, token consumption, and estimated costs for the last 60 minutes.
*   **User Activity**: `GET /metrics/activity?window=60`
    *   Tracks user registrations, logins, and other key actions over the last 60 minutes.

### 2.2 Monitoring Tools

It is recommended to integrate these metrics into a dedicated monitoring dashboard (e.g., Grafana, Datadog) for real-time visualization and alerting. The `AdminDashboard.tsx` component in the frontend provides a basic example of how these metrics can be consumed and displayed.

## 3. Bug Handling

During beta, expect bugs. A structured approach to bug handling is essential.

1.  **User Reporting**: Users will report issues via the in-app feedback system (👍/👎 buttons with comment fields) or dedicated channels.
2.  **Error Tracking**: Frontend errors are captured by `ErrorBoundary` and reported via `ErrorTracker`, providing a unique Error ID and stack trace. Backend errors are logged with detailed context.
3.  **Investigation**: When a bug is reported:
    *   Check backend logs for corresponding errors using the `requestId` or `Error ID`.
    *   Review metrics for any anomalies (e.g., spikes in error rate, increased latency).
    *   Reproduce the issue using the provided user context (user ID, conversation ID, message ID).
4.  **Resolution**: Prioritize bugs based on severity and impact. Deploy hotfixes as necessary.

## 4. Rollback Procedures

In case of critical issues post-deployment, a quick rollback mechanism is vital.

1.  **Identify the Problem**: Confirm the severity and scope of the issue. Determine if a rollback is the fastest and safest solution.
2.  **Revert Code**: Use Git to revert to the last known stable commit.
    *   `git revert <bad_commit_hash>` (creates a new commit that undoes the changes)
    *   Alternatively, `git reset --hard <stable_commit_hash>` (rewrites history, use with caution on shared branches).
3.  **Redeploy**: Deploy the reverted codebase to the production environment.
4.  **Monitor**: Closely monitor the system after rollback to ensure stability and verify the issue is resolved.
5.  **Post-Mortem**: Analyze the root cause of the issue and implement preventative measures to avoid recurrence. This may involve updating automated tests or improving deployment pipelines.

This guide will be updated as the beta program progresses and new operational insights are gained. For urgent issues, contact the core development team immediately.
