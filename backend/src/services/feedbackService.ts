/**
 * Feedback Service — Omni One Backend
 * 
 * Handles user feedback (ratings, comments) and automated AI quality evaluation.
 */

import { prisma } from "../database/prisma.js";
import { AppError } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { metricsService } from "./metricsService.js";

export interface CreateFeedbackDTO {
  userId: string;
  conversationId?: string;
  messageId?: string;
  rating: number; // 1 or -1
  comment?: string;
  model?: string;
  provider?: string;
  toolsUsed?: string[];
  confidence?: number;
  metadata?: any;
}

class FeedbackServiceClass {
  /**
   * Submit user feedback for a specific interaction.
   */
  async submitFeedback(data: CreateFeedbackDTO) {
    try {
      const feedback = await prisma.feedback.create({
        data: {
          userId: data.userId,
          conversationId: data.conversationId,
          messageId: data.messageId,
          rating: data.rating,
          comment: data.comment,
          model: data.model,
          provider: data.provider,
          toolsUsed: data.toolsUsed || [],
          confidence: data.confidence,
          metadata: data.metadata || {},
        },
      });

      // Track feedback in metrics
      metricsService.recordActivity({
        userId: data.userId,
        action: "feedback_submitted" as any,
        metadata: { rating: data.rating, model: data.model },
      });

      return feedback;
    } catch (error) {
      logger.error({ error, data }, "Failed to submit feedback");
      throw new AppError("Failed to submit feedback", 500);
    }
  }

  /**
   * Get feedback summary for analytics.
   */
  async getFeedbackStats(windowDays = 30) {
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const feedbacks = await prisma.feedback.findMany({
      where: { createdAt: { gte: since } },
    });

    const total = feedbacks.length;
    const positive = feedbacks.filter(f => f.rating > 0).length;
    const negative = total - positive;

    // Group by model
    const byModel: Record<string, { positive: number; negative: number; total: number }> = {};
    feedbacks.forEach(f => {
      const model = f.model || "unknown";
      if (!byModel[model]) byModel[model] = { positive: 0, negative: 0, total: 0 };
      byModel[model].total++;
      if (f.rating > 0) byModel[model].positive++;
      else byModel[model].negative++;
    });

    return {
      total,
      positive,
      negative,
      satisfactionRate: total > 0 ? positive / total : 1,
      byModel,
    };
  }

  /**
   * Automated AI Quality Evaluation
   * Measures relevance, correctness, and completeness based on internal heuristics or LLM-as-a-judge.
   */
  async evaluateQuality(messageId: string, criteria: { relevance: number; correctness: number; completeness: number }) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new AppError("Message not found", 404);

    // In a real scenario, this might involve another LLM call to grade the response.
    // For now, we store the evaluation in the metadata.
    const evaluation = {
      ...criteria,
      score: (criteria.relevance + criteria.correctness + criteria.completeness) / 3,
      evaluatedAt: new Date().toISOString(),
    };

    return await prisma.message.update({
      where: { id: messageId },
      data: {
        metadata: {
          ...(message.metadata as any || {}),
          evaluation,
        }
      }
    });
  }
}

export const feedbackService = new FeedbackServiceClass();
