import { CacheEntry } from "../../types";
import { Logger } from "./Logger";

export class SmartCache {
  private static cache = new Map<string, CacheEntry>();
  private static cleanupInterval: any = null;

  static async generateHash(input: any): Promise<string> {
    const str = JSON.stringify(input);
    // Simple hash function for environment without crypto-subtle if needed, 
    // but browser environments usually have it.
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const msgUint8 = new TextEncoder().encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      Logger.debug("Cache expired and removed", { key });
      return null;
    }

    Logger.debug("Cache hit", { key });
    return entry.value as T;
  }

  static set(key: string, value: any, ttlMs: number = 3600000): void {
    const expiry = Date.now() + ttlMs;
    this.cache.set(key, { key, value, expiry });
    Logger.debug("Cache set", { key, ttlMs });
    
    if (!this.cleanupInterval) {
      this.startCleanupTask();
    }
  }

  static invalidate(key: string): void {
    this.cache.delete(key);
    Logger.debug("Cache invalidated", { key });
  }

  static clear(): void {
    this.cache.clear();
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    Logger.info("Cache cleared");
  }

  private static startCleanupTask() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let count = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiry) {
          this.cache.delete(key);
          count++;
        }
      }
      if (count > 0) {
        Logger.debug("Auto-cleanup removed expired cache entries", { count });
      }
    }, 60000); // Clean every minute
  }
}
