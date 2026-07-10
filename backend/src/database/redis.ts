/**
 * Redis Client Utility — Omni One Backend
 *
 * Centralized Redis client using ioredis.
 */

import { Redis } from "ioredis";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

let redis: Redis | null = null;

if (config.redis.url) {
  redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on("connect", () => logger.info("Redis connected"));
  redis.on("error", (err) => logger.error({ err }, "Redis error"));
} else {
  logger.warn("Redis URL not configured — some features may be disabled");
}

export { redis };

/**
 * Test Redis connection.
 */
export async function testRedisConnection(): Promise<boolean> {
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch (err) {
    logger.error({ err }, "Redis ping failed");
    return false;
  }
}
