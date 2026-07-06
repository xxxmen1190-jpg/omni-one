import { LogEntry } from "../../types";

export class Logger {
  private static logs: LogEntry[] = [];
  private static readonly MAX_LOGS = 1000;

  static log(level: LogEntry["level"], message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
    };

    this.logs.push(entry);
    
    // Console output for development
    const timestamp = new Date(entry.timestamp).toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`);

    // Maintain log size
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
  }

  static info(message: string, context?: Record<string, any>) {
    this.log("info", message, context);
  }

  static warn(message: string, context?: Record<string, any>) {
    this.log("warn", message, context);
  }

  static error(message: string, context?: Record<string, any>) {
    this.log("error", message, context);
  }

  static debug(message: string, context?: Record<string, any>) {
    this.log("debug", message, context);
  }

  static getLogs(): LogEntry[] {
    return [...this.logs];
  }

  static clearLogs() {
    this.logs = [];
  }
}
