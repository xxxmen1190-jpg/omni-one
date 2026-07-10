/**
 * Response Utilities — Omni One Backend
 *
 * Standardized response builders for all API endpoints.
 */

import { v4 as uuidv4 } from "uuid";
import type { ApiSuccessResponse, ApiErrorResponse, ErrorCode } from "../types/index.js";

export function generateRequestId(): string {
  return uuidv4();
}

export function successResponse<T>(
  data: T,
  requestId: string
): ApiSuccessResponse<T> {
  return {
    success: true,
    requestId,
    timestamp: new Date().toISOString(),
    data,
  };
}

export function errorResponse(
  message: string,
  code: ErrorCode,
  statusCode: number,
  requestId: string
): ApiErrorResponse {
  return {
    success: false,
    requestId,
    timestamp: new Date().toISOString(),
    error: {
      code,
      message,
      statusCode,
    },
  };
}
