import { Logger } from "./Logger";

export interface AuditEntry {
  id: string;
  timestamp: number;
  action: string;
  actor: string; // user, system, tool, agent
  resource: string; // toolId, permission, etc.
  details: Record<string, any>;
  result: "success" | "failure" | "denied";
}

export class AuditLog {
  private static entries: AuditEntry[] = [];
  private static readonly MAX_ENTRIES = 10000;

  static record(
    action: string,
    actor: string,
    resource: string,
    result: "success" | "failure" | "denied",
    details?: Record<string, any>
  ): void {
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      action,
      actor,
      resource,
      details: details || {},
      result,
    };

    this.entries.push(entry);
    Logger.info(`Audit log recorded: ${action} on ${resource}`, { actor, result });

    // Maintain log size
    if (this.entries.length > this.MAX_ENTRIES) {
      this.entries.shift();
    }
  }

  static getEntries(filter?: { action?: string; actor?: string; resource?: string; result?: string }): AuditEntry[] {
    if (!filter) return [...this.entries];

    return this.entries.filter(entry => {
      if (filter.action && entry.action !== filter.action) return false;
      if (filter.actor && entry.actor !== filter.actor) return false;
      if (filter.resource && entry.resource !== filter.resource) return false;
      if (filter.result && entry.result !== filter.result) return false;
      return true;
    });
  }

  static getRecentEntries(limit: number = 100): AuditEntry[] {
    return this.entries.slice(-limit);
  }

  static clear(): void {
    this.entries = [];
    Logger.info("Audit log cleared.");
  }
}
