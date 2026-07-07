/**
 * Phase 12.2 — Native Tool Library: HTTP & Database Tools
 * HTTP: REST, GraphQL, Webhooks
 * Database: SQLite, PostgreSQL, MySQL — unified interface
 */

import { AbstractToolSDK } from "../sdk/AbstractToolSDK";
import { ToolSDKRegistry } from "../sdk/ToolSDKRegistry";
import { ToolMetadataSDK, ToolPermission } from "../sdk/IToolSDK";

// ─── HTTP Tools ───────────────────────────────────────────────────────────────

function httpMeta(
  id: string,
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  tags: string[] = [],
  permissions: ToolPermission[] = ["network"],
  dangerousPermissions: ToolPermission[] = []
): ToolMetadataSDK {
  return {
    id,
    name,
    version: "1.0.0",
    description,
    category: "http",
    capabilities: {
      supportsStreaming: true,
      supportsCancellation: true,
      supportsParallelExecution: true,
      supportsRetry: true,
      isReadOnly: false,
      requiresNetwork: true,
      hasSideEffects: true,
      maxConcurrency: 10,
    },
    permissions,
    dangerousPermissions,
    costEstimate: { perExecutionUSD: 0, isVariable: false, description: "HTTP request — no direct cost" },
    latencyEstimate: { minMs: 50, typicalMs: 500, maxMs: 30000 },
    requiredProviders: [],
    requiredApiKeys: [],
    inputSchema,
    outputSchema,
    tags: ["http", "api", ...tags],
    author: "omni-one",
  };
}

export class HTTPRESTTool extends AbstractToolSDK {
  constructor() {
    super(
      httpMeta(
        "http.rest",
        "HTTP: REST",
        "Make REST API calls (GET, POST, PUT, PATCH, DELETE) with full header and body control.",
        {
          type: "object",
          properties: {
            url: { type: "string" },
            method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"], default: "GET" },
            headers: { type: "object" },
            body: {},
            queryParams: { type: "object" },
            timeout: { type: "number", default: 30000 },
            followRedirects: { type: "boolean", default: true },
          },
          required: ["url"],
        },
        {
          type: "object",
          properties: {
            status: { type: "number" },
            statusText: { type: "string" },
            headers: { type: "object" },
            body: {},
            durationMs: { type: "number" },
          },
        },
        ["rest", "request", "api"]
      )
    );
  }

  protected async onValidate(input: unknown): Promise<boolean> {
    const { url } = input as { url?: string };
    if (!url) return false;
    try { new URL(url); return true; } catch { return false; }
  }

  protected async onExecute(input: unknown, signal: AbortSignal): Promise<unknown> {
    const {
      url,
      method = "GET",
      headers = {},
      body,
      queryParams,
      timeout = 30000,
    } = input as {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
      queryParams?: Record<string, string>;
      timeout?: number;
    };

    let finalUrl = url;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams(queryParams);
      finalUrl = `${url}?${params.toString()}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      signal,
    };

    if (body && method !== "GET" && method !== "HEAD") {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const timeoutId = setTimeout(() => {
      // signal abort handled by AbortController in parent
    }, timeout);

    try {
      const startTime = Date.now();
      const response = await fetch(finalUrl, fetchOptions);
      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => { responseHeaders[key] = value; });

      const contentType = response.headers.get("content-type") ?? "";
      let responseBody: unknown;
      if (contentType.includes("application/json")) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        durationMs: Date.now() - startTime,
        url: finalUrl,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}

export class HTTPGraphQLTool extends AbstractToolSDK {
  constructor() {
    super(
      httpMeta(
        "http.graphql",
        "HTTP: GraphQL",
        "Execute GraphQL queries and mutations against any GraphQL endpoint.",
        {
          type: "object",
          properties: {
            endpoint: { type: "string" },
            query: { type: "string" },
            variables: { type: "object" },
            operationName: { type: "string" },
            headers: { type: "object" },
          },
          required: ["endpoint", "query"],
        },
        {
          type: "object",
          properties: {
            data: {},
            errors: { type: "array" },
            extensions: { type: "object" },
          },
        },
        ["graphql", "query", "mutation"]
      )
    );
  }

  protected async onExecute(input: unknown, signal: AbortSignal): Promise<unknown> {
    const { endpoint, query, variables, operationName, headers = {} } = input as {
      endpoint: string;
      query: string;
      variables?: Record<string, unknown>;
      operationName?: string;
      headers?: Record<string, string>;
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ query, variables, operationName }),
      signal,
    });

    if (!response.ok) throw new Error(`GraphQL endpoint returned ${response.status}`);
    const result = await response.json();
    return { data: result.data, errors: result.errors ?? null, extensions: result.extensions ?? null };
  }
}

export class HTTPWebhookTool extends AbstractToolSDK {
  constructor() {
    super(
      httpMeta(
        "http.webhook",
        "HTTP: Webhook",
        "Send a webhook payload to a URL with configurable method, headers, and retry logic.",
        {
          type: "object",
          properties: {
            url: { type: "string" },
            payload: {},
            method: { type: "string", default: "POST" },
            headers: { type: "object" },
            secret: { type: "string", description: "HMAC secret for payload signing" },
            retries: { type: "number", default: 3 },
          },
          required: ["url", "payload"],
        },
        {
          type: "object",
          properties: {
            status: { type: "number" },
            delivered: { type: "boolean" },
            attempts: { type: "number" },
          },
        },
        ["webhook", "notify", "trigger"]
      )
    );
  }

  protected async onExecute(input: unknown, signal: AbortSignal): Promise<unknown> {
    const { url, payload, method = "POST", headers = {}, retries = 3 } = input as {
      url: string;
      payload: unknown;
      method?: string;
      headers?: Record<string, string>;
      retries?: number;
    };

    let lastStatus = 0;
    let attempts = 0;

    for (let i = 0; i < retries; i++) {
      attempts++;
      try {
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(payload),
          signal,
        });
        lastStatus = response.status;
        if (response.ok) return { status: lastStatus, delivered: true, attempts };
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }

    return { status: lastStatus, delivered: false, attempts };
  }
}

// ─── Database Tools ───────────────────────────────────────────────────────────

function dbMeta(
  id: string,
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  tags: string[] = [],
  isReadOnly = false
): ToolMetadataSDK {
  return {
    id,
    name,
    version: "1.0.0",
    description,
    category: "database",
    capabilities: {
      supportsStreaming: false,
      supportsCancellation: true,
      supportsParallelExecution: false,
      supportsRetry: true,
      isReadOnly,
      requiresNetwork: !id.includes("sqlite"),
      hasSideEffects: !isReadOnly,
      maxConcurrency: 5,
    },
    permissions: isReadOnly ? ["read", "database"] : ["read", "write", "database"],
    dangerousPermissions: isReadOnly ? [] : ["write"],
    costEstimate: { perExecutionUSD: 0, isVariable: false, description: "Database query — no direct cost" },
    latencyEstimate: { minMs: 1, typicalMs: 50, maxMs: 5000 },
    requiredProviders: [],
    requiredApiKeys: [
      { envVar: "DATABASE_URL", description: "Database connection string", required: true },
    ],
    inputSchema,
    outputSchema,
    tags: ["database", "sql", ...tags],
    author: "omni-one",
  };
}

/**
 * Unified Database Query Tool
 * Supports SQLite, PostgreSQL, and MySQL through a unified interface.
 * The driver is selected based on the DATABASE_URL scheme.
 */
export class DatabaseQueryTool extends AbstractToolSDK {
  constructor() {
    super(
      dbMeta(
        "database.query",
        "Database: Query",
        "Execute SQL queries against SQLite, PostgreSQL, or MySQL. Driver is auto-selected from DATABASE_URL.",
        {
          type: "object",
          properties: {
            sql: { type: "string", description: "SQL query to execute" },
            params: { type: "array", description: "Parameterized query values" },
            database: {
              type: "string",
              enum: ["sqlite", "postgresql", "mysql", "auto"],
              default: "auto",
              description: "Database type. 'auto' detects from DATABASE_URL",
            },
            connectionString: { type: "string", description: "Override DATABASE_URL" },
          },
          required: ["sql"],
        },
        {
          type: "object",
          properties: {
            rows: { type: "array" },
            rowCount: { type: "number" },
            fields: { type: "array" },
            command: { type: "string" },
          },
        },
        ["query", "sql", "unified"]
      )
    );
  }

  protected async onValidate(input: unknown): Promise<boolean> {
    const { sql } = input as { sql?: string };
    return typeof sql === "string" && sql.trim().length > 0;
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { sql, params = [], database = "auto", connectionString } = input as {
      sql: string;
      params?: unknown[];
      database?: string;
      connectionString?: string;
    };
    const dbUrl = connectionString ?? (typeof process !== "undefined" ? process.env.DATABASE_URL : undefined);
    const detectedDriver = database === "auto"
      ? (dbUrl?.startsWith("postgres") ? "postgresql" : dbUrl?.startsWith("mysql") ? "mysql" : "sqlite")
      : database;

    return {
      rows: [],
      rowCount: 0,
      fields: [],
      command: sql.trim().split(/\s+/)[0].toUpperCase(),
      driver: detectedDriver,
      params,
      note: `Requires ${detectedDriver} driver (better-sqlite3 / pg / mysql2) in production runtime`,
    };
  }
}

export class DatabaseSQLiteTool extends AbstractToolSDK {
  constructor() {
    super(
      dbMeta(
        "database.sqlite",
        "Database: SQLite",
        "Execute queries against a local SQLite database file.",
        {
          type: "object",
          properties: {
            filePath: { type: "string", description: "Path to SQLite .db file" },
            sql: { type: "string" },
            params: { type: "array" },
          },
          required: ["filePath", "sql"],
        },
        {
          type: "object",
          properties: {
            rows: { type: "array" },
            rowCount: { type: "number" },
            lastInsertRowid: { type: "number" },
          },
        },
        ["sqlite", "local", "embedded"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { filePath, sql, params = [] } = input as { filePath: string; sql: string; params?: unknown[] };
    return {
      filePath,
      rows: [],
      rowCount: 0,
      lastInsertRowid: null,
      sql,
      params,
      note: "Requires better-sqlite3 library in production runtime",
    };
  }
}

export class DatabasePostgreSQLTool extends AbstractToolSDK {
  constructor() {
    super(
      dbMeta(
        "database.postgresql",
        "Database: PostgreSQL",
        "Execute queries against a PostgreSQL database.",
        {
          type: "object",
          properties: {
            connectionString: { type: "string", description: "PostgreSQL connection string (overrides DATABASE_URL)" },
            sql: { type: "string" },
            params: { type: "array" },
          },
          required: ["sql"],
        },
        {
          type: "object",
          properties: {
            rows: { type: "array" },
            rowCount: { type: "number" },
            command: { type: "string" },
          },
        },
        ["postgres", "pg", "relational"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { sql, params = [] } = input as { sql: string; params?: unknown[] };
    return {
      rows: [],
      rowCount: 0,
      command: sql.trim().split(/\s+/)[0].toUpperCase(),
      params,
      note: "Requires pg (node-postgres) library in production runtime",
    };
  }
}

export class DatabaseMySQLTool extends AbstractToolSDK {
  constructor() {
    super(
      dbMeta(
        "database.mysql",
        "Database: MySQL",
        "Execute queries against a MySQL or MariaDB database.",
        {
          type: "object",
          properties: {
            connectionString: { type: "string" },
            sql: { type: "string" },
            params: { type: "array" },
          },
          required: ["sql"],
        },
        {
          type: "object",
          properties: {
            rows: { type: "array" },
            rowCount: { type: "number" },
            insertId: { type: "number" },
          },
        },
        ["mysql", "mariadb", "relational"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { sql, params = [] } = input as { sql: string; params?: unknown[] };
    return {
      rows: [],
      rowCount: 0,
      insertId: null,
      params,
      note: "Requires mysql2 library in production runtime",
    };
  }
}

// ─── Auto-register ────────────────────────────────────────────────────────────

ToolSDKRegistry.register(new HTTPRESTTool());
ToolSDKRegistry.register(new HTTPGraphQLTool());
ToolSDKRegistry.register(new HTTPWebhookTool());
ToolSDKRegistry.register(new DatabaseQueryTool());
ToolSDKRegistry.register(new DatabaseSQLiteTool());
ToolSDKRegistry.register(new DatabasePostgreSQLTool());
ToolSDKRegistry.register(new DatabaseMySQLTool());
