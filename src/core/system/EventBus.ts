import { Logger } from "./Logger";

export type EventType = 
  | "tool:start" 
  | "tool:progress" 
  | "tool:complete" 
  | "tool:error" 
  | "agent:start" 
  | "agent:progress" 
  | "agent:complete" 
  | "agent:error" 
  | "skill:start" 
  | "skill:complete" 
  | "skill:error" 
  | "permission:request" 
  | "permission:granted" 
  | "permission:denied";

export interface EventPayload {
  type: EventType;
  timestamp: number;
  data: Record<string, any>;
}

export type EventListener = (payload: EventPayload) => void;

export class EventBus {
  private static listeners = new Map<EventType, Set<EventListener>>();

  static on(eventType: EventType, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  static emit(eventType: EventType, data: Record<string, any>): void {
    const payload: EventPayload = {
      type: eventType,
      timestamp: Date.now(),
      data,
    };

    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(payload);
        } catch (error: any) {
          Logger.error(`Error in event listener for ${eventType}`, { error: error.message });
        }
      });
    }

    Logger.debug(`Event emitted: ${eventType}`, data);
  }

  static *streamEvents(eventType: EventType): AsyncGenerator<EventPayload> {
    const queue: EventPayload[] = [];
    let resolve: (() => void) | null = null;

    const listener = (payload: EventPayload) => {
      queue.push(payload);
      if (resolve) {
        resolve();
        resolve = null;
      }
    };

    this.on(eventType, listener);

    try {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise<void>(r => {
            resolve = r;
          });
        }
      }
    } finally {
      this.listeners.get(eventType)?.delete(listener);
    }
  }

  static clear(): void {
    this.listeners.clear();
    Logger.info("EventBus cleared.");
  }
}
