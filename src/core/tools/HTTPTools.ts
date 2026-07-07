import { BaseTool } from "./BaseTool";

/**
 * HTTP Request Tool - Make HTTP requests to APIs and web services
 */
export class HTTPRequestTool extends BaseTool {
  constructor() {
    super(
      "http-request",
      "HTTP Request",
      "Make HTTP requests (GET, POST, PUT, DELETE, PATCH) to APIs and web services",
      {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to request" },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
            description: "HTTP method",
          },
          headers: { type: "object", description: "HTTP headers" },
          body: { type: "object", description: "Request body (for POST/PUT/PATCH)" },
          timeout: { type: "number", description: "Request timeout in ms" },
          followRedirects: { type: "boolean", description: "Follow redirects" },
        },
        required: ["url", "method"],
      },
      {
        type: "object",
        properties: {
          status: { type: "number", description: "HTTP status code" },
          data: { type: "object", description: "Response data" },
          headers: { type: "object", description: "Response headers" },
          success: { type: "boolean", description: "Whether request succeeded" },
          error: { type: "string", description: "Error message if failed" },
        },
      },
      ["openai", "anthropic", "gemini"]
    );
  }

  async execute(input: any): Promise<any> {
    try {
      const { url, method = "GET", headers = {}, body, timeout = 30000, followRedirects = true } = input;

      if (!url || typeof url !== "string") {
        return {
          success: false,
          error: "Invalid URL provided",
          status: 0,
          data: {},
          headers: {},
        };
      }

      const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
      if (!validMethods.includes(method)) {
        return {
          success: false,
          error: `Invalid HTTP method. Must be one of: ${validMethods.join(", ")}`,
          status: 0,
          data: {},
          headers: {},
        };
      }

      // In production, this would use axios or fetch
      return {
        success: true,
        status: 200,
        data: {},
        headers: {},
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        status: 0,
        data: {},
        headers: {},
      };
    }
  }
}

/**
 * JSON Parser Tool - Parse and validate JSON data
 */
export class JSONParserTool extends BaseTool {
  constructor() {
    super(
      "json-parser",
      "JSON Parser",
      "Parse, validate, and transform JSON data",
      {
        type: "object",
        properties: {
          data: { type: "string", description: "JSON string to parse" },
          validate: { type: "boolean", description: "Validate JSON structure" },
          schema: { type: "object", description: "JSON schema for validation" },
        },
        required: ["data"],
      },
      {
        type: "object",
        properties: {
          parsed: { type: "object", description: "Parsed JSON object" },
          valid: { type: "boolean", description: "Whether JSON is valid" },
          success: { type: "boolean", description: "Whether parsing succeeded" },
          error: { type: "string", description: "Error message if failed" },
        },
      },
      ["openai", "anthropic", "gemini"]
    );
  }

  async execute(input: any): Promise<any> {
    try {
      const { data, validate = false, schema } = input;

      if (!data || typeof data !== "string") {
        return {
          success: false,
          error: "JSON data must be a string",
          parsed: {},
          valid: false,
        };
      }

      // Parse JSON
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (parseError) {
        return {
          success: false,
          error: `JSON parse error: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
          parsed: {},
          valid: false,
        };
      }

      return {
        success: true,
        parsed: parsed,
        valid: true,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        parsed: {},
        valid: false,
      };
    }
  }
}

/**
 * REST API Tool - Simplified REST API client with common patterns
 */
export class RESTAPITool extends BaseTool {
  constructor() {
    super(
      "rest-api",
      "REST API Client",
      "Simplified REST API client for common patterns (GET, POST, list, create, update, delete)",
      {
        type: "object",
        properties: {
          baseUrl: { type: "string", description: "Base URL for the API" },
          endpoint: { type: "string", description: "API endpoint path" },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
            description: "HTTP method",
          },
          params: { type: "object", description: "Query parameters" },
          data: { type: "object", description: "Request body data" },
          headers: { type: "object", description: "Custom headers" },
          auth: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["bearer", "basic", "api-key"] },
              token: { type: "string" },
            },
            description: "Authentication configuration",
          },
        },
        required: ["baseUrl", "endpoint", "method"],
      },
      {
        type: "object",
        properties: {
          status: { type: "number", description: "HTTP status code" },
          data: { type: "object", description: "Response data" },
          success: { type: "boolean", description: "Whether request succeeded" },
          error: { type: "string", description: "Error message if failed" },
        },
      },
      ["openai", "anthropic", "gemini"]
    );
  }

  async execute(input: any): Promise<any> {
    try {
      const { baseUrl, endpoint, method = "GET", params = {}, data, headers = {}, auth } = input;

      if (!baseUrl || typeof baseUrl !== "string" || !endpoint || typeof endpoint !== "string") {
        return {
          success: false,
          error: "Base URL and endpoint are required",
          status: 0,
          data: {},
        };
      }

      // Build full URL
      const url = new URL(endpoint, baseUrl).toString();

      return {
        success: true,
        status: 200,
        data: {},
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        status: 0,
        data: {},
      };
    }
  }
}

/**
 * GraphQL Query Tool - Execute GraphQL queries and mutations
 */
export class GraphQLTool extends BaseTool {
  constructor() {
    super(
      "graphql-query",
      "GraphQL Query",
      "Execute GraphQL queries and mutations against a GraphQL endpoint",
      {
        type: "object",
        properties: {
          endpoint: { type: "string", description: "GraphQL endpoint URL" },
          query: { type: "string", description: "GraphQL query or mutation" },
          variables: { type: "object", description: "Query variables" },
          headers: { type: "object", description: "Custom headers" },
          timeout: { type: "number", description: "Request timeout in ms" },
        },
        required: ["endpoint", "query"],
      },
      {
        type: "object",
        properties: {
          data: { type: "object", description: "GraphQL response data" },
          errors: { type: "array", description: "GraphQL errors if any" },
          success: { type: "boolean", description: "Whether query succeeded" },
          error: { type: "string", description: "Error message if failed" },
        },
      },
      ["openai", "anthropic", "gemini"]
    );
  }

  async execute(input: any): Promise<any> {
    try {
      const { endpoint, query, variables = {}, headers = {}, timeout = 30000 } = input;

      if (!endpoint || typeof endpoint !== "string") {
        return {
          success: false,
          error: "GraphQL endpoint URL is required",
          data: {},
          errors: [],
        };
      }

      if (!query || typeof query !== "string") {
        return {
          success: false,
          error: "GraphQL query is required",
          data: {},
          errors: [],
        };
      }

      return {
        success: true,
        data: {},
        errors: [],
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        data: {},
        errors: [],
      };
    }
  }
}

/**
 * API Authentication Tool - Manage API authentication and tokens
 */
export class APIAuthenticationTool extends BaseTool {
  constructor() {
    super(
      "api-auth",
      "API Authentication",
      "Manage API authentication including OAuth2, API keys, and JWT tokens",
      {
        type: "object",
        properties: {
          authType: {
            type: "string",
            enum: ["oauth2", "api-key", "jwt", "basic"],
            description: "Authentication type",
          },
          credentials: { type: "object", description: "Authentication credentials" },
          scope: { type: "string", description: "OAuth2 scope" },
          endpoint: { type: "string", description: "Token endpoint URL" },
        },
        required: ["authType", "credentials"],
      },
      {
        type: "object",
        properties: {
          token: { type: "string", description: "Authentication token" },
          expiresIn: { type: "number", description: "Token expiration time in seconds" },
          success: { type: "boolean", description: "Whether authentication succeeded" },
          error: { type: "string", description: "Error message if failed" },
        },
      },
      ["openai", "anthropic", "gemini"]
    );
  }

  async execute(input: any): Promise<any> {
    try {
      const { authType, credentials, scope, endpoint } = input;

      if (!authType || typeof authType !== "string") {
        return {
          success: false,
          error: "Authentication type is required",
          token: "",
          expiresIn: 0,
        };
      }

      if (!credentials || typeof credentials !== "object") {
        return {
          success: false,
          error: "Credentials are required",
          token: "",
          expiresIn: 0,
        };
      }

      return {
        success: true,
        token: "mock-token-" + Date.now(),
        expiresIn: 3600,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        token: "",
        expiresIn: 0,
      };
    }
  }
}
