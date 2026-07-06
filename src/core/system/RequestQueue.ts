import { RequestQueueItem } from "../../types";
import { Logger } from "./Logger";

export class RequestQueue {
  private static queue: RequestQueueItem[] = [];
  private static activeRequests = 0;
  private static readonly MAX_CONCURRENT = 5;

  static enqueue(item: RequestQueueItem): void {
    Logger.debug("Request enqueued", { id: item.id, priority: item.priority });
    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority);
    this.process();
  }

  static cancel(id: string): void {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      const [item] = this.queue.splice(index, 1);
      item.reject(new Error("Request cancelled in queue"));
      Logger.info("Request cancelled from queue", { id });
    }
  }

  private static async process(): Promise<void> {
    if (this.activeRequests >= this.MAX_CONCURRENT || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeRequests++;
    Logger.debug("Processing request from queue", { id: item.id, active: this.activeRequests });

    try {
      // Check if already aborted
      if (item.signal.aborted) {
        throw new Error("Request already aborted");
      }

      // The actual execution is handled by the caller via the resolve callback
      // We just signal that it's this item's turn.
      item.resolve(null);
    } catch (error) {
      item.reject(error);
    } finally {
      // Note: activeRequests decrement should be handled by the caller when the task is actually done
      // However, for this simplified OS core, we'll use a wrapper or the caller must call release()
    }
  }

  static release(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    Logger.debug("Request slot released", { active: this.activeRequests });
    this.process();
  }

  static getPendingCount(): number {
    return this.queue.length;
  }
}
