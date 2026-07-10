/**
 * Auth Middleware — Omni One Backend
 *
 * Handles JWT verification and Role-Based Access Control (RBAC).
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { authService } from "../services/authService.js";
import { AppError } from "../types/index.js";
import { logger } from "../utils/logger.js";
import type { UserRole } from "@prisma/client";

/**
 * Middleware to require a valid session (JWT or Session Token).
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  try {
    // 1. Try to get token from Authorization header
    const authHeader = request.headers.authorization;
    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } 
    // 2. Try to get token from cookies
    else if ((request as any).cookies?.session) {
      token = (request as any).cookies.session;
    }

    if (!token) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const user = await authService.validateSession(token);
    
    // Attach user to request for downstream handlers
    (request as any).user = user;
  } catch (err) {
    logger.warn({ err }, "Authentication failed");
    if (err instanceof AppError) throw err;
    throw new AppError("Authentication failed", 401, "UNAUTHORIZED");
  }
}

/**
 * Middleware to require a specific role.
 */
export function authorize(roles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = (request as any).user;
    
    if (!user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    if (!roles.includes(user.role)) {
      throw new AppError(
        `Required role: ${roles.join(" or ")}. Current role: ${user.role}`,
        403,
        "FORBIDDEN"
      );
    }
  };
}
