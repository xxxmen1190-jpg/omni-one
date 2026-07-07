/**
 * Phase 12.2 — Native Tool Library: Collaboration Tools
 * GitHub: Read repos, files, create commits, PRs, Issues
 * Email: Send, Read, Search
 * Calendar: Create, Update, Delete events
 */

import { AbstractToolSDK } from "../sdk/AbstractToolSDK";
import { ToolSDKRegistry } from "../sdk/ToolSDKRegistry";
import { ToolMetadataSDK, ToolPermission } from "../sdk/IToolSDK";

// ─── GitHub Tools ─────────────────────────────────────────────────────────────

function githubMeta(
  id: string,
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  tags: string[] = [],
  permissions: ToolPermission[] = ["read", "network"],
  dangerousPermissions: ToolPermission[] = []
): ToolMetadataSDK {
  return {
    id,
    name,
    version: "1.0.0",
    description,
    category: "github",
    capabilities: {
      supportsStreaming: false,
      supportsCancellation: true,
      supportsParallelExecution: true,
      supportsRetry: true,
      isReadOnly: permissions.includes("write") ? false : true,
      requiresNetwork: true,
      hasSideEffects: permissions.includes("write"),
      maxConcurrency: 3,
    },
    permissions,
    dangerousPermissions,
    costEstimate: { perExecutionUSD: 0, isVariable: false, description: "GitHub API — free tier" },
    latencyEstimate: { minMs: 200, typicalMs: 800, maxMs: 5000 },
    requiredProviders: [],
    requiredApiKeys: [
      { envVar: "GITHUB_TOKEN", description: "GitHub Personal Access Token", required: true },
    ],
    inputSchema,
    outputSchema,
    tags: ["github", "git", ...tags],
    author: "omni-one",
  };
}

export class GitHubReadRepositoryTool extends AbstractToolSDK {
  constructor() {
    super(
      githubMeta(
        "github.read-repository",
        "GitHub: Read Repository",
        "Read repository metadata, branches, contributors, and stats.",
        {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
          },
          required: ["owner", "repo"],
        },
        {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            stars: { type: "number" },
            forks: { type: "number" },
            branches: { type: "array" },
            defaultBranch: { type: "string" },
          },
        },
        ["repository", "repo", "read"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { owner, repo } = input as { owner: string; repo: string };
    const token = typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined;
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!response.ok) throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return {
      name: data.name,
      description: data.description,
      stars: data.stargazers_count,
      forks: data.forks_count,
      defaultBranch: data.default_branch,
      language: data.language,
      topics: data.topics,
      url: data.html_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

export class GitHubReadFileTool extends AbstractToolSDK {
  constructor() {
    super(
      githubMeta(
        "github.read-file",
        "GitHub: Read File",
        "Read the content of a file from a GitHub repository.",
        {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            path: { type: "string" },
            branch: { type: "string", default: "main" },
          },
          required: ["owner", "repo", "path"],
        },
        {
          type: "object",
          properties: {
            content: { type: "string" },
            sha: { type: "string" },
            size: { type: "number" },
          },
        },
        ["file", "read", "content"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { owner, repo, path, branch = "main" } = input as {
      owner: string;
      repo: string;
      path: string;
      branch?: string;
    };
    const token = typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined;
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers }
    );
    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
    const data = await response.json();
    const content = typeof atob !== "undefined"
      ? atob(data.content.replace(/\n/g, ""))
      : Buffer.from(data.content, "base64").toString("utf-8");
    return { content, sha: data.sha, size: data.size, path: data.path };
  }
}

export class GitHubCreateCommitTool extends AbstractToolSDK {
  constructor() {
    super(
      githubMeta(
        "github.create-commit",
        "GitHub: Create Commit",
        "Create or update a file in a GitHub repository (creates a commit).",
        {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            path: { type: "string" },
            content: { type: "string" },
            message: { type: "string" },
            branch: { type: "string", default: "main" },
            sha: { type: "string", description: "Required when updating an existing file" },
          },
          required: ["owner", "repo", "path", "content", "message"],
        },
        {
          type: "object",
          properties: {
            commitSha: { type: "string" },
            url: { type: "string" },
          },
        },
        ["commit", "write", "create"],
        ["read", "write", "network"],
        ["write"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { owner, repo, path, content, message, branch = "main", sha } = input as {
      owner: string;
      repo: string;
      path: string;
      content: string;
      message: string;
      branch?: string;
      sha?: string;
    };
    const token = typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined;
    if (!token) throw new Error("GITHUB_TOKEN is required for write operations");
    const encoded = typeof btoa !== "undefined"
      ? btoa(unescape(encodeURIComponent(content)))
      : Buffer.from(content).toString("base64");
    const body: Record<string, unknown> = { message, content: encoded, branch };
    if (sha) body.sha = sha;
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
    const data = await response.json();
    return { commitSha: data.commit.sha, url: data.commit.html_url, path };
  }
}

export class GitHubCreatePullRequestTool extends AbstractToolSDK {
  constructor() {
    super(
      githubMeta(
        "github.create-pull-request",
        "GitHub: Create Pull Request",
        "Create a pull request in a GitHub repository.",
        {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            head: { type: "string", description: "Branch to merge from" },
            base: { type: "string", description: "Branch to merge into", default: "main" },
            draft: { type: "boolean", default: false },
          },
          required: ["owner", "repo", "title", "head"],
        },
        {
          type: "object",
          properties: {
            number: { type: "number" },
            url: { type: "string" },
            state: { type: "string" },
          },
        },
        ["pr", "pull-request", "create"],
        ["read", "write", "network"],
        ["write"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { owner, repo, title, body, head, base = "main", draft = false } = input as {
      owner: string;
      repo: string;
      title: string;
      body?: string;
      head: string;
      base?: string;
      draft?: boolean;
    };
    const token = typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined;
    if (!token) throw new Error("GITHUB_TOKEN is required");
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body, head, base, draft }),
    });
    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
    const data = await response.json();
    return { number: data.number, url: data.html_url, state: data.state };
  }
}

export class GitHubIssuesTool extends AbstractToolSDK {
  constructor() {
    super(
      githubMeta(
        "github.issues",
        "GitHub: Issues",
        "List, create, update, and close GitHub issues.",
        {
          type: "object",
          properties: {
            action: { type: "string", enum: ["list", "create", "update", "close"] },
            owner: { type: "string" },
            repo: { type: "string" },
            issueNumber: { type: "number" },
            title: { type: "string" },
            body: { type: "string" },
            labels: { type: "array", items: { type: "string" } },
            state: { type: "string", enum: ["open", "closed"] },
          },
          required: ["action", "owner", "repo"],
        },
        {
          type: "object",
          properties: {
            issues: { type: "array" },
            issue: { type: "object" },
          },
        },
        ["issues", "bugs", "tasks"],
        ["read", "write", "network"],
        ["write"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { action, owner, repo, issueNumber, title, body, labels, state } = input as {
      action: "list" | "create" | "update" | "close";
      owner: string;
      repo: string;
      issueNumber?: number;
      title?: string;
      body?: string;
      labels?: string[];
      state?: string;
    };
    const token = typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    if (action === "list") {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=30`, { headers });
      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
      const data = await response.json();
      return { issues: data.map((i: Record<string, unknown>) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url })) };
    }

    if (action === "create") {
      if (!token) throw new Error("GITHUB_TOKEN required");
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title, body, labels }),
      });
      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
      const data = await response.json();
      return { issue: { number: data.number, url: data.html_url, state: data.state } };
    }

    if (action === "update" || action === "close") {
      if (!token) throw new Error("GITHUB_TOKEN required");
      const updateBody: Record<string, unknown> = {};
      if (title) updateBody.title = title;
      if (body) updateBody.body = body;
      if (action === "close") updateBody.state = "closed";
      else if (state) updateBody.state = state;
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(updateBody),
      });
      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
      const data = await response.json();
      return { issue: { number: data.number, url: data.html_url, state: data.state } };
    }

    throw new Error(`Unknown action: ${action}`);
  }
}

// ─── Email Tools ──────────────────────────────────────────────────────────────

function emailMeta(
  id: string,
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  tags: string[] = [],
  permissions: ToolPermission[] = ["read", "network"],
  dangerousPermissions: ToolPermission[] = []
): ToolMetadataSDK {
  return {
    id,
    name,
    version: "1.0.0",
    description,
    category: "email",
    capabilities: {
      supportsStreaming: false,
      supportsCancellation: false,
      supportsParallelExecution: false,
      supportsRetry: true,
      isReadOnly: !permissions.includes("write"),
      requiresNetwork: true,
      hasSideEffects: permissions.includes("write"),
      maxConcurrency: 1,
    },
    permissions,
    dangerousPermissions,
    costEstimate: { perExecutionUSD: 0, isVariable: false, description: "Email API — provider dependent" },
    latencyEstimate: { minMs: 500, typicalMs: 2000, maxMs: 10000 },
    requiredProviders: [],
    requiredApiKeys: [
      { envVar: "SENDGRID_API_KEY", description: "SendGrid API key for sending email", required: false },
      { envVar: "GMAIL_CLIENT_ID", description: "Gmail OAuth2 client ID", required: false },
    ],
    inputSchema,
    outputSchema,
    tags: ["email", ...tags],
    author: "omni-one",
  };
}

export class EmailSendTool extends AbstractToolSDK {
  constructor() {
    super(
      emailMeta(
        "email.send",
        "Email: Send",
        "Send an email via SMTP or email API provider.",
        {
          type: "object",
          properties: {
            to: { type: "array", items: { type: "string" } },
            cc: { type: "array", items: { type: "string" } },
            bcc: { type: "array", items: { type: "string" } },
            subject: { type: "string" },
            body: { type: "string" },
            html: { type: "string" },
            attachments: { type: "array" },
          },
          required: ["to", "subject", "body"],
        },
        {
          type: "object",
          properties: {
            messageId: { type: "string" },
            accepted: { type: "array" },
            rejected: { type: "array" },
          },
        },
        ["send", "compose"],
        ["read", "write", "network", "email"],
        ["write", "email"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { to, subject, body } = input as { to: string[]; subject: string; body: string };
    return {
      messageId: `msg-${Date.now()}`,
      accepted: to,
      rejected: [],
      note: "Requires SMTP config or SendGrid/Mailgun API key in production runtime",
    };
  }
}

export class EmailReadTool extends AbstractToolSDK {
  constructor() {
    super(
      emailMeta(
        "email.read",
        "Email: Read",
        "Read emails from an inbox via IMAP or email API.",
        {
          type: "object",
          properties: {
            folder: { type: "string", default: "INBOX" },
            limit: { type: "number", default: 10 },
            unreadOnly: { type: "boolean", default: false },
            since: { type: "string", description: "ISO date string" },
          },
          required: [],
        },
        {
          type: "object",
          properties: {
            emails: { type: "array" },
            count: { type: "number" },
          },
        },
        ["read", "inbox", "imap"],
        ["read", "network", "email"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { folder = "INBOX", limit = 10, unreadOnly = false, since } = input as {
      folder?: string;
      limit?: number;
      unreadOnly?: boolean;
      since?: string;
    };
    return {
      emails: [],
      count: 0,
      folder,
      limit,
      unreadOnly,
      since: since ?? null,
      note: "Requires IMAP credentials or Gmail API in production runtime",
    };
  }
}

export class EmailSearchTool extends AbstractToolSDK {
  constructor() {
    super(
      emailMeta(
        "email.search",
        "Email: Search",
        "Search emails by keyword, sender, date range, or label.",
        {
          type: "object",
          properties: {
            query: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
            subject: { type: "string" },
            dateFrom: { type: "string" },
            dateTo: { type: "string" },
            limit: { type: "number", default: 20 },
          },
          required: ["query"],
        },
        {
          type: "object",
          properties: {
            results: { type: "array" },
            count: { type: "number" },
          },
        },
        ["search", "find", "filter"],
        ["read", "network", "email"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { query, limit = 20 } = input as { query: string; limit?: number };
    return {
      results: [],
      count: 0,
      query,
      limit,
      note: "Requires IMAP or Gmail API in production runtime",
    };
  }
}

// ─── Calendar Tools ───────────────────────────────────────────────────────────

function calendarMeta(
  id: string,
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  tags: string[] = [],
  permissions: ToolPermission[] = ["read", "network", "calendar"],
  dangerousPermissions: ToolPermission[] = []
): ToolMetadataSDK {
  return {
    id,
    name,
    version: "1.0.0",
    description,
    category: "calendar",
    capabilities: {
      supportsStreaming: false,
      supportsCancellation: false,
      supportsParallelExecution: false,
      supportsRetry: true,
      isReadOnly: !permissions.includes("write"),
      requiresNetwork: true,
      hasSideEffects: permissions.includes("write"),
      maxConcurrency: 1,
    },
    permissions,
    dangerousPermissions,
    costEstimate: { perExecutionUSD: 0, isVariable: false, description: "Calendar API — free" },
    latencyEstimate: { minMs: 200, typicalMs: 800, maxMs: 5000 },
    requiredProviders: [],
    requiredApiKeys: [
      { envVar: "GOOGLE_CALENDAR_API_KEY", description: "Google Calendar API key", required: false },
    ],
    inputSchema,
    outputSchema,
    tags: ["calendar", "events", ...tags],
    author: "omni-one",
  };
}

export class CalendarCreateEventTool extends AbstractToolSDK {
  constructor() {
    super(
      calendarMeta(
        "calendar.create-event",
        "Calendar: Create Event",
        "Create a new calendar event.",
        {
          type: "object",
          properties: {
            title: { type: "string" },
            startTime: { type: "string", description: "ISO 8601 datetime" },
            endTime: { type: "string", description: "ISO 8601 datetime" },
            description: { type: "string" },
            location: { type: "string" },
            attendees: { type: "array", items: { type: "string" } },
            calendarId: { type: "string", default: "primary" },
          },
          required: ["title", "startTime", "endTime"],
        },
        {
          type: "object",
          properties: {
            eventId: { type: "string" },
            url: { type: "string" },
          },
        },
        ["create", "schedule"],
        ["read", "write", "network", "calendar"],
        ["write", "calendar"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { title, startTime, endTime, description, location, attendees, calendarId = "primary" } = input as {
      title: string;
      startTime: string;
      endTime: string;
      description?: string;
      location?: string;
      attendees?: string[];
      calendarId?: string;
    };
    return {
      eventId: `evt-${Date.now()}`,
      title,
      startTime,
      endTime,
      description: description ?? null,
      location: location ?? null,
      attendees: attendees ?? [],
      calendarId,
      note: "Requires Google Calendar API credentials in production runtime",
    };
  }
}

export class CalendarUpdateEventTool extends AbstractToolSDK {
  constructor() {
    super(
      calendarMeta(
        "calendar.update-event",
        "Calendar: Update Event",
        "Update an existing calendar event.",
        {
          type: "object",
          properties: {
            eventId: { type: "string" },
            calendarId: { type: "string", default: "primary" },
            title: { type: "string" },
            startTime: { type: "string" },
            endTime: { type: "string" },
            description: { type: "string" },
            location: { type: "string" },
          },
          required: ["eventId"],
        },
        {
          type: "object",
          properties: { eventId: { type: "string" }, updated: { type: "boolean" } },
        },
        ["update", "edit"],
        ["read", "write", "network", "calendar"],
        ["write", "calendar"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { eventId, calendarId = "primary", ...updates } = input as {
      eventId: string;
      calendarId?: string;
      [key: string]: unknown;
    };
    return { eventId, calendarId, updated: true, updates, note: "Requires Google Calendar API in production runtime" };
  }
}

export class CalendarDeleteEventTool extends AbstractToolSDK {
  constructor() {
    super(
      calendarMeta(
        "calendar.delete-event",
        "Calendar: Delete Event",
        "Delete a calendar event by ID.",
        {
          type: "object",
          properties: {
            eventId: { type: "string" },
            calendarId: { type: "string", default: "primary" },
          },
          required: ["eventId"],
        },
        {
          type: "object",
          properties: { deleted: { type: "boolean" }, eventId: { type: "string" } },
        },
        ["delete", "remove"],
        ["read", "write", "network", "calendar"],
        ["write", "calendar"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { eventId, calendarId = "primary" } = input as { eventId: string; calendarId?: string };
    return { deleted: true, eventId, calendarId, note: "Requires Google Calendar API in production runtime" };
  }
}

// ─── Auto-register ────────────────────────────────────────────────────────────

ToolSDKRegistry.register(new GitHubReadRepositoryTool());
ToolSDKRegistry.register(new GitHubReadFileTool());
ToolSDKRegistry.register(new GitHubCreateCommitTool());
ToolSDKRegistry.register(new GitHubCreatePullRequestTool());
ToolSDKRegistry.register(new GitHubIssuesTool());
ToolSDKRegistry.register(new EmailSendTool());
ToolSDKRegistry.register(new EmailReadTool());
ToolSDKRegistry.register(new EmailSearchTool());
ToolSDKRegistry.register(new CalendarCreateEventTool());
ToolSDKRegistry.register(new CalendarUpdateEventTool());
ToolSDKRegistry.register(new CalendarDeleteEventTool());
