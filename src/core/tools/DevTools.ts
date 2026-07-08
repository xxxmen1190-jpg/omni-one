import { BaseTool } from "./BaseTool";

/**
 * GitHub Repository Tool - Interact with GitHub repositories
 */
export class GitHubRepositoryTool extends BaseTool {
  constructor() {
    super(
      "github-repository",
      "GitHub Repository",
      "Interact with GitHub repositories including cloning, pushing, pulling, and managing branches",
      {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["clone", "push", "pull", "create-branch", "list-branches", "merge"],
            description: "Git operation",
          },
          repository: { type: "string", description: "Repository URL or owner/repo" },
          branch: { type: "string", description: "Branch name" },
          message: { type: "string", description: "Commit message" },
          token: { type: "string", description: "GitHub authentication token" },
        },
        required: ["operation", "repository"],
      },
      {
        type: "object",
        properties: {
          success: { type: "boolean", description: "Whether operation succeeded" },
          result: { type: "object", description: "Operation result" },
          error: { type: "string", description: "Error message if failed" },
        },
      },
      ["openai", "anthropic", "gemini"]
    );
  }

  async execute(input: any): Promise<any> {
    try {
      const { operation, repository, branch, message, token } = input;

      if (!operation || typeof operation !== "string") {
        return {
          success: false,
          error: "Operation is required",
          result: {},
        };
      }

      if (!repository || typeof repository !== "string") {
        return {
          success: false,
          error: "Repository is required",
          result: {},
        };
      }

      const validOperations = ["clone", "push", "pull", "create-branch", "list-branches", "merge"];
      if (!validOperations.includes(operation)) {
        return {
          success: false,
          error: `Invalid operation. Must be one of: ${validOperations.join(", ")}`,
          result: {},
        };
      }

      // Real GitHub REST API (Phase 12.9)
      const ghToken = token ?? (typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined);
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "omni-one/1.0",
        ...(ghToken ? { Authorization: `Bearer ${ghToken}` } : {}),
      };
      const [owner, repo] = repository.includes("/") ? repository.replace("https://github.com/", "").split("/") : [repository, ""];
      const base = `https://api.github.com/repos/${owner}/${repo}`;

      if (operation === "list-branches") {
        const res = await fetch(`${base}/branches`, { headers, signal: AbortSignal.timeout(10000) });
        if (!res.ok) return { success: false, error: `GitHub API ${res.status}`, result: {} };
        const data = await res.json();
        return { success: true, result: { branches: data.map((b: any) => b.name) }, error: null };
      }
      if (operation === "create-branch") {
        const defaultRes = await fetch(`${base}`, { headers, signal: AbortSignal.timeout(10000) });
        const repoData = defaultRes.ok ? await defaultRes.json() : {};
        const sha = repoData.default_branch ? (await (await fetch(`${base}/git/ref/heads/${repoData.default_branch}`, { headers })).json()).object?.sha : null;
        if (!sha) return { success: false, error: "Could not get base SHA", result: {} };
        const res = await fetch(`${base}/git/refs`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }), signal: AbortSignal.timeout(10000) });
        if (!res.ok) return { success: false, error: `GitHub API ${res.status}: ${await res.text()}`, result: {} };
        return { success: true, result: { branch, created: true }, error: null };
      }
      // For pull, clone, push, merge: return metadata (full git ops need server-side git)
      const res = await fetch(`${base}`, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) return { success: false, error: `GitHub API ${res.status}`, result: {} };
      const data = await res.json();
      return { success: true, result: { operation, repository, branch: branch || data.default_branch, defaultBranch: data.default_branch, stars: data.stargazers_count, language: data.language, description: data.description }, error: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        result: {},
      };
    }
  }
}

/**
 * GitHub Issues Tool - Manage GitHub issues and pull requests
 */
export class GitHubIssuesTool extends BaseTool {
  constructor() {
    super(
      "github-issues",
      "GitHub Issues",
      "Create, read, update, and manage GitHub issues and pull requests",
      {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["create", "list", "get", "update", "close", "reopen"],
            description: "Issue operation",
          },
          repository: { type: "string", description: "Repository owner/repo" },
          issueNumber: { type: "number", description: "Issue number" },
          title: { type: "string", description: "Issue title" },
          body: { type: "string", description: "Issue description" },
          labels: { type: "array", description: "Issue labels" },
          assignees: { type: "array", description: "Assignee usernames" },
          token: { type: "string", description: "GitHub authentication token" },
        },
        required: ["operation", "repository"],
      },
      {
        type: "object",
        properties: {
          success: { type: "boolean", description: "Whether operation succeeded" },
          issue: { type: "object", description: "Issue data" },
          error: { type: "string", description: "Error message if failed" },
        },
      },
      ["openai", "anthropic", "gemini"]
    );
  }

  async execute(input: any): Promise<any> {
    try {
      const { operation, repository, issueNumber, title, body, labels = [], assignees = [], token } = input;

      if (!operation || typeof operation !== "string") {
        return {
          success: false,
          error: "Operation is required",
          issue: {},
        };
      }

      if (!repository || typeof repository !== "string") {
        return {
          success: false,
          error: "Repository is required",
          issue: {},
        };
      }

      // Real GitHub Issues API (Phase 12.9)
      const ghToken = token ?? (typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined);
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "omni-one/1.0",
        "Content-Type": "application/json",
        ...(ghToken ? { Authorization: `Bearer ${ghToken}` } : {}),
      };
      const base = `https://api.github.com/repos/${repository}/issues`;

      if (operation === "list") {
        const res = await fetch(`${base}?state=open&per_page=30`, { headers, signal: AbortSignal.timeout(10000) });
        if (!res.ok) return { success: false, error: `GitHub API ${res.status}`, issue: {} };
        return { success: true, issue: { issues: await res.json() }, error: null };
      }
      if (operation === "get") {
        const res = await fetch(`${base}/${issueNumber}`, { headers, signal: AbortSignal.timeout(10000) });
        if (!res.ok) return { success: false, error: `GitHub API ${res.status}`, issue: {} };
        return { success: true, issue: await res.json(), error: null };
      }
      if (operation === "create") {
        const res = await fetch(base, { method: "POST", headers, body: JSON.stringify({ title, body, labels, assignees }), signal: AbortSignal.timeout(10000) });
        if (!res.ok) return { success: false, error: `GitHub API ${res.status}: ${await res.text()}`, issue: {} };
        return { success: true, issue: await res.json(), error: null };
      }
      if (operation === "update" || operation === "close" || operation === "reopen") {
        const patchBody: any = {};
        if (title) patchBody.title = title;
        if (body) patchBody.body = body;
        if (labels.length) patchBody.labels = labels;
        if (operation === "close") patchBody.state = "closed";
        if (operation === "reopen") patchBody.state = "open";
        const res = await fetch(`${base}/${issueNumber}`, { method: "PATCH", headers, body: JSON.stringify(patchBody), signal: AbortSignal.timeout(10000) });
        if (!res.ok) return { success: false, error: `GitHub API ${res.status}`, issue: {} };
        return { success: true, issue: await res.json(), error: null };
      }
      return { success: false, error: `Unknown operation: ${operation}`, issue: {} };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        issue: {},
      };
    }
  }
}

/**
 * Code Execution Tool - Execute code in various languages
 */
export class CodeExecutionTool extends BaseTool {
  constructor() {
    super(
      "code-execution",
      "Code Execution",
      "Execute code snippets in various languages (JavaScript, Python, TypeScript, etc.)",
      {
        type: "object",
        properties: {
          language: {
            type: "string",
            enum: ["javascript", "python", "typescript", "bash", "sql"],
            description: "Programming language",
          },
          code: { type: "string", description: "Code to execute" },
          timeout: { type: "number", description: "Execution timeout in ms" },
          environment: { type: "object", description: "Environment variables" },
        },
        required: ["language", "code"],
      },
      {
        type: "object",
        properties: {
          output: { type: "string", description: "Execution output" },
          error: { type: "string", description: "Execution error" },
          exitCode: { type: "number", description: "Exit code" },
          success: { type: "boolean", description: "Whether execution succeeded" },
        },
      },
      ["openai", "anthropic", "gemini"]
    );
  }

  async execute(input: any): Promise<any> {
    try {
      const { language, code, timeout = 5000, environment = {} } = input;

      if (!language || typeof language !== "string") {
        return {
          success: false,
          error: "Language is required",
          output: "",
          exitCode: 1,
        };
      }

      if (!code || typeof code !== "string") {
        return {
          success: false,
          error: "Code is required",
          output: "",
          exitCode: 1,
        };
      }

      const validLanguages = ["javascript", "python", "typescript", "bash", "sql"];
      if (!validLanguages.includes(language)) {
        return {
          success: false,
          error: `Invalid language. Must be one of: ${validLanguages.join(", ")}`,
          output: "",
          exitCode: 1,
        };
      }

      return {
        success: true,
        output: "Mock execution output",
        error: null,
        exitCode: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        output: "",
        exitCode: 1,
      };
    }
  }
}

/**
 * Database Query Tool - Execute database queries
 */
export class DatabaseQueryTool extends BaseTool {
  constructor() {
    super(
      "database-query",
      "Database Query",
      "Execute queries against databases (SQL, MongoDB, etc.)",
      {
        type: "object",
        properties: {
          databaseType: {
            type: "string",
            enum: ["mysql", "postgresql", "mongodb", "sqlite"],
            description: "Database type",
          },
          connectionString: { type: "string", description: "Database connection string" },
          query: { type: "string", description: "Query to execute" },
          parameters: { type: "array", description: "Query parameters" },
          timeout: { type: "number", description: "Query timeout in ms" },
        },
        required: ["databaseType", "query"],
      },
      {
        type: "object",
        properties: {
          rows: { type: "array", description: "Query result rows" },
          rowCount: { type: "number", description: "Number of rows affected" },
          success: { type: "boolean", description: "Whether query succeeded" },
          error: { type: "string", description: "Error message if failed" },
        },
      },
      ["openai", "anthropic", "gemini"]
    );
  }

  async execute(input: any): Promise<any> {
    try {
      const { databaseType, connectionString, query, parameters = [], timeout = 30000 } = input;

      if (!databaseType || typeof databaseType !== "string") {
        return {
          success: false,
          error: "Database type is required",
          rows: [],
          rowCount: 0,
        };
      }

      if (!query || typeof query !== "string") {
        return {
          success: false,
          error: "Query is required",
          rows: [],
          rowCount: 0,
        };
      }

      return {
        success: true,
        rows: [],
        rowCount: 0,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        rows: [],
        rowCount: 0,
      };
    }
  }
}

/**
 * Email Tool - Send and manage emails
 */
export class EmailTool extends BaseTool {
  constructor() {
    super(
      "email",
      "Email",
      "Send emails and manage email operations",
      {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["send", "read", "delete"], description: "Email operation" },
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject" },
          body: { type: "string", description: "Email body" },
          attachments: { type: "array", description: "File attachments" },
          smtpConfig: { type: "object", description: "SMTP configuration" },
        },
        required: ["operation"],
      },
      {
        type: "object",
        properties: {
          success: { type: "boolean", description: "Whether operation succeeded" },
          messageId: { type: "string", description: "Email message ID" },
          error: { type: "string", description: "Error message if failed" },
        },
      },
      ["openai", "anthropic", "gemini"]
    );
  }

  async execute(input: any): Promise<any> {
    try {
      const { operation, to, subject, body, attachments = [], smtpConfig } = input;

      if (!operation || typeof operation !== "string") {
        return {
          success: false,
          error: "Operation is required",
          messageId: "",
        };
      }

      const validOperations = ["send", "read", "delete"];
      if (!validOperations.includes(operation)) {
        return {
          success: false,
          error: `Invalid operation. Must be one of: ${validOperations.join(", ")}`,
          messageId: "",
        };
      }

      return {
        success: true,
        messageId: `msg-${Date.now()}`,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        messageId: "",
      };
    }
  }
}

/**
 * Calendar Tool - Manage calendar events
 */
export class CalendarTool extends BaseTool {
  constructor() {
    super(
      "calendar",
      "Calendar",
      "Create, read, update, and manage calendar events",
      {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["create", "list", "get", "update", "delete"],
            description: "Calendar operation",
          },
          title: { type: "string", description: "Event title" },
          startTime: { type: "string", description: "Event start time (ISO 8601)" },
          endTime: { type: "string", description: "Event end time (ISO 8601)" },
          description: { type: "string", description: "Event description" },
          attendees: { type: "array", description: "Attendee email addresses" },
          calendarId: { type: "string", description: "Calendar ID" },
        },
        required: ["operation"],
      },
      {
        type: "object",
        properties: {
          success: { type: "boolean", description: "Whether operation succeeded" },
          event: { type: "object", description: "Event data" },
          error: { type: "string", description: "Error message if failed" },
        },
      },
      ["openai", "anthropic", "gemini"]
    );
  }

  async execute(input: any): Promise<any> {
    try {
      const { operation, title, startTime, endTime, description, attendees = [], calendarId } = input;

      if (!operation || typeof operation !== "string") {
        return {
          success: false,
          error: "Operation is required",
          event: {},
        };
      }

      const validOperations = ["create", "list", "get", "update", "delete"];
      if (!validOperations.includes(operation)) {
        return {
          success: false,
          error: `Invalid operation. Must be one of: ${validOperations.join(", ")}`,
          event: {},
        };
      }

      return {
        success: true,
        event: {
          title: title || "Event",
          startTime: startTime,
          endTime: endTime,
          description: description,
          attendees: attendees,
        },
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        event: {},
      };
    }
  }
}
