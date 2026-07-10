/**
 * Base Repository — Omni One Backend
 *
 * Provides shared logic and transaction support for all repositories.
 */

import { prisma } from "./prisma.js";
import { Prisma } from "@prisma/client";

export abstract class BaseRepository {
  protected prisma = prisma;

  /**
   * Execute logic within a database transaction.
   */
  async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
