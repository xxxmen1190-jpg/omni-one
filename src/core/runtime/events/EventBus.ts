import {
  RuntimeEvent,
  RuntimeEventListener,
  RuntimeEventType,
  EventBusConfig,
} from "../../../types/runtime";
import { Logger } from "../../system/Logger";

/**
 * Runtime Event Bus - Central event system for the entire runtime
 * All components communicate through events
 */

export class EventBus {
  private listeners: Map<RuntimeEventType, Set<RuntimeEventListener>> = new Map();
  private eventHistory: RuntimeEvent[] = [];
  private config: EventBusConfig;
  private eventQueue: RuntimeEvent[] = [];
  private isProcessing = false;

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = {
      maxListeners: config.maxListeners || 100,
      enableLogging: config.enableLogging !== false,
      enablePersistence: config.enablePersistence || false,
      persistencePath: config.persistencePath,
    };

    Logger.info("EventBus initialized", { config: this.config });
  }

  /**
   * Subscribe to events
   */
  on(eventType: RuntimeEventType, listener: RuntimeEventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const listeners = this.listeners.get(eventType)!;

    if (listeners.size >= this.config.maxListeners) {
      Logger.warn("Max listeners reached for event type", { eventType });
      return;
    }

    listeners.add(listener);
    Logger.debug("Listener registered", { eventType, count: listeners.size });
  }

  /**
   * Subscribe to events (one-time)
   */
  once(eventType: RuntimeEventType, listener: RuntimeEventListener): void {
    const wrappedListener: RuntimeEventListener = async (event) => {
      this.off(eventType, wrappedListener);
      await listener(event);
    };

    this.on(eventType, wrappedListener);
  }

  /**
   * Unsubscribe from events
   */
  off(eventType: RuntimeEventType, listener: RuntimeEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      Logger.debug("Listener unregistered", { eventType, count: listeners.size });
    }
  }

  /**
   * Emit an event
   */
  async emit(event: RuntimeEvent): Promise<void> {
    // Add to queue for processing
    this.eventQueue.push(event);

    // Process queue
    if (!this.isProcessing) {
      await this.processEventQueue();
    }
  }

  /**
   * Process event queue
   */
  private async processEventQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: RuntimeEvent): Promise<void> {
    // Add to history
    this.eventHistory.push(event);

    // Keep history size manageable
    if (this.eventHistory.length > 10000) {
      this.eventHistory = this.eventHistory.slice(-5000);
    }

    // Log if enabled
    if (this.config.enableLogging) {
      Logger.debug("Event emitted", {
        type: event.type,
        source: event.source,
        priority: event.priority,
      });
    }

    // Call listeners
    const listeners = this.listeners.get(event.type);
    if (listeners && listeners.size > 0) {
      const listenerArray = Array.from(listeners);

      for (const listener of listenerArray) {
        try {
          const result = listener(event);
          if (result instanceof Promise) {
            await result;
          }
        } catch (error: any) {
          Logger.error("Event listener error", {
            eventType: event.type,
            error: error.message,
          });
        }
      }
    }
  }

  /**
   * Get event history
   */
  getHistory(
    eventType?: RuntimeEventType,
    limit: number = 100
  ): RuntimeEvent[] {
    let history = this.eventHistory;

    if (eventType) {
      history = history.filter((e) => e.type === eventType);
    }

    return history.slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
    Logger.info("Event history cleared");
  }

  /**
   * Get listener count
   */
  getListenerCount(eventType?: RuntimeEventType): number {
    if (eventType) {
      return this.listeners.get(eventType)?.size || 0;
    }

    let total = 0;
    this.listeners.forEach((listeners) => {
      total += listeners.size;
    });
    return total;
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): RuntimeEventType[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Wait for an event
   */
  waitFor(eventType: RuntimeEventType, timeout: number = 30000): Promise<RuntimeEvent> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(eventType, listener);
        reject(new Error(`Event ${eventType} not received within ${timeout}ms`));
      }, timeout);

      const listener: RuntimeEventListener = (event) => {
        clearTimeout(timer);
        this.off(eventType, listener);
        resolve(event);
      };

      this.on(eventType, listener);
    });
  }

  /**
   * Wait for multiple events
   */
  async waitForAll(
    eventTypes: RuntimeEventType[],
    timeout: number = 30000
  ): Promise<RuntimeEvent[]> {
    const promises = eventTypes.map((type) => this.waitFor(type, timeout));
    return Promise.all(promises);
  }

  /**
   * Wait for any event
   */
  async waitForAny(
    eventTypes: RuntimeEventType[],
    timeout: number = 30000
  ): Promise<RuntimeEvent> {
    return Promise.race(eventTypes.map((type) => this.waitFor(type, timeout)));
  }

  /**
   * Get event statistics
   */
  getStatistics(): Record<string, any> {
    const stats: Record<string, number> = {};

    this.eventHistory.forEach((event) => {
      stats[event.type] = (stats[event.type] || 0) + 1;
    });

    return {
      totalEvents: this.eventHistory.length,
      uniqueEventTypes: this.listeners.size,
      totalListeners: this.getListenerCount(),
      eventCounts: stats,
      queueSize: this.eventQueue.length,
    };
  }

  /**
   * Reset event bus
   */
  reset(): void {
    this.listeners.clear();
    this.eventHistory = [];
    this.eventQueue = [];
    this.isProcessing = false;
    Logger.info("EventBus reset");
  }
}

export const createEventBus = (config?: Partial<EventBusConfig>): EventBus => {
  return new EventBus(config);
};
