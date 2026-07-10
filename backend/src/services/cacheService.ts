/**
 * Cache Service — Omni One Backend
 *
 * Provides a simple key-value cache abstraction over Redis.
 */

import { redis } from "../database/redis.js";
import { logger } from "../utils/logger.js";

export class CacheService {
  /**
   * Get a value from cache.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      logger.error({ err, key }, "Cache get failed");
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL (seconds).
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!redis) return;
    try {
      const stringValue = JSON.stringify(value);
      if (ttl) {
        await redis.set(key, stringValue, "EX", ttl);
      } else {
        await redis.set(key, stringValue);
      }
    } catch (err) {
      logger.error({ err, key }, "Cache set failed");
    }
  }

  /**
   * Delete a key from cache.
   */
  async del(key: string): Promise<void> {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (err) {
      logger.error({ err, key }, "Cache del failed");
    }
  }

  /**
   * Increment a counter (useful for rate limiting).
   */
  async incr(key: string): Promise<number | null> {
    if (!redis) return null;
    try {
      return await redis.incr(key);
    } catch (err) {
      logger.error({ err, key }, "Cache incr failed");
      return null;
    }
  }
}

export const cacheService = new CacheService();
