/**
 * Auth Service — Omni One Backend
 *
 * Handles registration, login, token generation, and session management.
 */

import crypto from "crypto";
import { userRepository } from "../database/userRepository.js";
import { sessionRepository } from "../database/sessionRepository.js";
import { hashPassword, comparePassword } from "../utils/crypto.js";
import { AppError } from "../types/index.js";


import type { User, Session } from "@prisma/client";

export class AuthService {
  /**
   * Generate a secure random token for sessions.
   */
  private generateSessionToken(): string {
    return crypto.randomBytes(40).toString("hex");
  }

  /**
   * Hash a session token for storage.
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Create a new user session.
   */
  async createSession(userId: string, metadata: {
    ip?: string;
    userAgent?: string;
    deviceName?: string;
    browser?: string;
    os?: string;
    country?: string;
  }): Promise<{ token: string; session: Session }> {
    const token = this.generateSessionToken();
    const tokenHash = this.hashToken(token);
    
    // Calculate expiration (default 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session = await sessionRepository.create({
      user: { connect: { id: userId } },
      tokenHash,
      expiresAt,
      ...metadata,
    });

    return { token, session };
  }

  /**
   * Validate a session token.
   */
  async validateSession(token: string): Promise<User> {
    const tokenHash = this.hashToken(token);
    const session = await sessionRepository.findByTokenHash(tokenHash);

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      throw new AppError("Invalid or expired session", 401, "UNAUTHORIZED");
    }

    // Update last used timestamp
    await sessionRepository.updateLastUsed(session.id);

    return (session as any).user;
  }

  /**
   * Register a new user.
   */
  async register(data: { email: string; password?: string; displayName?: string }): Promise<User> {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new AppError("User already exists", 400, "BAD_REQUEST");
    }

    const passwordHash = data.password ? await hashPassword(data.password) : null;
    
    return userRepository.create({
      email: data.email,
      passwordHash,
      displayName: data.displayName,
      status: "ACTIVE", // In real prod, this might be PENDING_VERIFICATION
    });
  }

  /**
   * Login with email and password.
   */
  async login(email: string, password?: string): Promise<User> {
    const user = await userRepository.findByEmail(email);
    if (!user || !user.passwordHash || !password) {
      throw new AppError("Invalid email or password", 401, "UNAUTHORIZED");
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw new AppError("Invalid email or password", 401, "UNAUTHORIZED");
    }

    if (user.status === "SUSPENDED") {
      throw new AppError("Account is suspended", 403, "FORBIDDEN");
    }

    return user;
  }

  /**
   * Logout a session.
   */
  async logout(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const session = await sessionRepository.findByTokenHash(tokenHash);
    if (session) {
      await sessionRepository.deactivate(session.id);
    }
  }
}

export const authService = new AuthService();
