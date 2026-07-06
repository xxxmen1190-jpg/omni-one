import {
  ChatEngineConfig,
  ChatResponse,
  ExecutionContext,
  ExecutionStage,
  ExecutionStep,
  ChatMessage,
  ChatSession,
} from "../../types/integration";
import { OmniBrain } from "../brain/OmniBrain";
import { KnowledgeEngine } from "../knowledge/KnowledgeEngine";
import { CognitiveLayerOrchestrator } from "../cognitive/CognitiveLayerOrchestrator";
import { RuntimeManager } from "../runtime/RuntimeManager";
import { Logger } from "../system/Logger";

/**
 * Unified Chat Engine - Single interface for entire Omni One system
 * Orchestrates all components into a seamless chat experience
 */

export class UnifiedChatEngine {
  private config: ChatEngineConfig;
  private omniBrain: OmniBrain;
  private knowledgeEngine: KnowledgeEngine;
  private planner: CognitiveLayerOrchestrator;
  private runtime: RuntimeManager;
  private sessions: Map<string, ChatSession> = new Map();
  private sessionIdCounter: number = 0;
  private executionContexts: Map<string, ExecutionContext> = new Map();

  constructor(
    config: Partial<ChatEngineConfig>,
    omniBrain: OmniBrain,
    knowledgeEngine: KnowledgeEngine,
    planner: CognitiveLayerOrchestrator,
    runtime: RuntimeManager
  ) {
    this.config = {
      enableRAG: config.enableRAG !== false,
      enableMemory: config.enableMemory !== false,
      enableReasoning: config.enableReasoning !== false,
      enableAgents: config.enableAgents !== false,
      enableTools: config.enableTools !== false,
      maxContextTokens: config.maxContextTokens || 4000,
      maxResponseTokens: config.maxResponseTokens || 2000,
      responseTimeout: config.responseTimeout || 30000,
      enableLatencyOptimization: config.enableLatencyOptimization !== false,
      enableFailureRecovery: config.enableFailureRecovery !== false,
    };

    this.omniBrain = omniBrain;
    this.knowledgeEngine = knowledgeEngine;
    this.planner = planner;
    this.runtime = runtime;

    Logger.info("UnifiedChatEngine initialized", { config: this.config });
  }

  /**
   * Chat - Main entry point
   */
  async chat(
    userId: string,
    userMessage: string,
    conversationId?: string
  ): Promise<ChatResponse> {
    // Create execution context
    const executionId = this.generateExecutionId();
    const convId = conversationId || this.generateSessionId();

    const context: ExecutionContext = {
      id: executionId,
      userId,
      conversationId: convId,
      userMessage,
      steps: [],
      metadata: {},
      startTime: Date.now(),
      success: false,
    };

    this.executionContexts.set(executionId, context);

    try {
      Logger.info("Chat started", {
        userId,
        conversationId: convId,
        messageLength: userMessage.length,
      });

      // Stage 1: Input Processing
      await this.executeStage(context, "input_processing", async () => {
        // Validate and normalize input
        if (!userMessage || userMessage.trim().length === 0) {
          throw new Error("Empty message");
        }
      });

      // Stage 2: Query Understanding
      const queryAnalysis = await this.executeStage(
        context,
        "query_understanding",
        async () => {
          const analysis = this.knowledgeEngine
            .getQueryUnderstanding()
            .analyzeQuery(userMessage);
          context.metadata.queryAnalysis = analysis;
          return analysis;
        }
      );

      // Stage 3: Planning
      const plan = await this.executeStage(context, "planning", async () => {
        // Use planner to create execution plan
        const plan = await this.planner.orchestrateGoal(userMessage, {
          userId,
          conversationId: convId,
        });
        context.metadata.plan = plan;
        return plan;
      });

      // Stage 4: Knowledge Retrieval (RAG)
      let ragResults = null;
      if (this.config.enableRAG && queryAnalysis.requiresRag) {
        ragResults = await this.executeStage(
          context,
          "knowledge_retrieval",
          async () => {
            const results = await this.knowledgeEngine.retrieveContext(
              userMessage,
              userId,
              convId
            );
            context.metadata.ragResults = results;
            return results;
          }
        );
      } else {
        this.addStep(context, "knowledge_retrieval", "skipped");
      }

      // Stage 5: Memory Injection
      let injectedMemory = null;
      if (this.config.enableMemory) {
        injectedMemory = await this.executeStage(
          context,
          "memory_injection",
          async () => {
            const memoryContext = this.knowledgeEngine
              .getGlobalMemoryFusion()
              .fuseMemoryContext(userMessage, userId, convId);
            context.metadata.memoryContext = memoryContext;
            return memoryContext;
          }
        );
      } else {
        this.addStep(context, "memory_injection", "skipped");
      }

      // Stage 6: Execution
      const executionResult = await this.executeStage(
        context,
        "execution",
        async () => {
          // Execute plan using runtime
          const result = await this.runtime.executeCapability(
            "omni_orchestrator",
            {
              userMessage,
              plan,
              ragResults,
              memoryContext: injectedMemory,
              queryAnalysis,
            }
          );

          context.metadata.toolsUsed = result.toolsUsed || [];
          context.metadata.agentsUsed = result.agentsUsed || [];

          return result;
        }
      );

      // Stage 7: Response Generation
      const finalResponse = await this.executeStage(
        context,
        "response_generation",
        async () => {
          // Use OmniBrain to generate response
          const response = await this.omniBrain.generateResponse({
            userMessage,
            executionResult,
            ragContext: ragResults,
            memoryContext: injectedMemory,
            plan,
          });

          context.finalResponse = response;
          return response;
        }
      );

      // Mark as complete
      context.success = true;
      context.endTime = Date.now();
      context.totalDuration = context.endTime - context.startTime;

      this.addStep(context, "complete", "completed");

      // Store in session
      await this.storeInSession(userId, convId, userMessage, finalResponse);

      Logger.info("Chat completed", {
        userId,
        conversationId: convId,
        duration: context.totalDuration,
        success: true,
      });

      // Create response
      const chatResponse: ChatResponse = {
        id: this.generateMessageId(),
        conversationId: convId,
        content: finalResponse,
        timestamp: Date.now(),
        metadata: {
          sources: this.extractSources(context),
          toolsUsed: context.metadata.toolsUsed || [],
          agentsUsed: context.metadata.agentsUsed || [],
          memoryUsed: injectedMemory !== null,
          ragUsed: ragResults !== null,
          confidence: this.calculateConfidence(context),
        },
        executionContext: context,
      };

      return chatResponse;
    } catch (error: any) {
      context.success = false;
      context.endTime = Date.now();
      context.totalDuration = context.endTime - context.startTime;

      Logger.error("Chat failed", {
        userId,
        conversationId: convId,
        error: error.message,
        duration: context.totalDuration,
      });

      // Attempt recovery
      if (this.config.enableFailureRecovery) {
        return this.handleFailure(context, error);
      }

      throw error;
    }
  }

  /**
   * Execute a stage
   */
  private async executeStage<T>(
    context: ExecutionContext,
    stage: ExecutionStage,
    executor: () => Promise<T>
  ): Promise<T> {
    const step: ExecutionStep = {
      stage,
      startTime: Date.now(),
      status: "running",
    };

    context.steps.push(step);

    try {
      const result = await executor();

      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = "completed";

      Logger.debug("Stage completed", {
        stage,
        duration: step.duration,
      });

      return result;
    } catch (error: any) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = "failed";
      step.error = error.message;

      Logger.error("Stage failed", {
        stage,
        error: error.message,
        duration: step.duration,
      });

      throw error;
    }
  }

  /**
   * Add step to context
   */
  private addStep(
    context: ExecutionContext,
    stage: ExecutionStage,
    status: "pending" | "running" | "completed" | "failed" | "skipped"
  ): void {
    const step: ExecutionStep = {
      stage,
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      status: status as any,
    };

    context.steps.push(step);
  }

  /**
   * Handle failure
   */
  private async handleFailure(
    context: ExecutionContext,
    error: Error
  ): Promise<ChatResponse> {
    Logger.info("Attempting failure recovery", {
      conversationId: context.conversationId,
      failedStage: context.steps[context.steps.length - 1]?.stage,
    });

    // Try simplified response
    const simpleResponse = `I encountered an issue processing your request: "${error.message}". Could you please rephrase your question or try again?`;

    const chatResponse: ChatResponse = {
      id: this.generateMessageId(),
      conversationId: context.conversationId,
      content: simpleResponse,
      timestamp: Date.now(),
      metadata: {
        sources: [],
        toolsUsed: [],
        agentsUsed: [],
        memoryUsed: false,
        ragUsed: false,
        confidence: 0.3,
      },
      executionContext: context,
    };

    return chatResponse;
  }

  /**
   * Store in session
   */
  private async storeInSession(
    userId: string,
    conversationId: string,
    userMessage: string,
    assistantResponse: string
  ): Promise<void> {
    let session = this.sessions.get(conversationId);

    if (!session) {
      session = {
        id: conversationId,
        userId,
        title: userMessage.substring(0, 50),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.sessions.set(conversationId, session);
    }

    // Add messages
    session.messages.push({
      id: this.generateMessageId(),
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    });

    session.messages.push({
      id: this.generateMessageId(),
      role: "assistant",
      content: assistantResponse,
      timestamp: Date.now(),
    });

    session.updatedAt = Date.now();
  }

  /**
   * Extract sources from context
   */
  private extractSources(context: ExecutionContext): string[] {
    const sources: string[] = [];

    if (context.metadata.ragResults) {
      sources.push("RAG");
    }

    if (context.metadata.memoryContext) {
      sources.push("Memory");
    }

    if (context.metadata.toolsUsed && context.metadata.toolsUsed.length > 0) {
      sources.push("Tools");
    }

    if (context.metadata.agentsUsed && context.metadata.agentsUsed.length > 0) {
      sources.push("Agents");
    }

    return sources;
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(context: ExecutionContext): number {
    let confidence = 0.5;

    // Increase confidence if RAG was used
    if (context.metadata.ragResults) {
      confidence += 0.2;
    }

    // Increase confidence if memory was used
    if (context.metadata.memoryContext) {
      confidence += 0.1;
    }

    // Decrease confidence if tools failed
    const failedSteps = context.steps.filter((s) => s.status === "failed");
    confidence -= failedSteps.length * 0.1;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Get session
   */
  getSession(conversationId: string): ChatSession | undefined {
    return this.sessions.get(conversationId);
  }

  /**
   * Get execution context
   */
  getExecutionContext(executionId: string): ExecutionContext | undefined {
    return this.executionContexts.get(executionId);
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    const contexts = Array.from(this.executionContexts.values());
    const successCount = contexts.filter((c) => c.success).length;
    const totalDuration = contexts.reduce((sum, c) => sum + (c.totalDuration || 0), 0);

    return {
      totalExecutions: contexts.length,
      successCount,
      failureCount: contexts.length - successCount,
      successRate: contexts.length > 0 ? successCount / contexts.length : 0,
      averageDuration: contexts.length > 0 ? totalDuration / contexts.length : 0,
      totalSessions: this.sessions.size,
    };
  }

  /**
   * Generate IDs
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${++this.sessionIdCounter}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

export const createUnifiedChatEngine = (
  config: Partial<ChatEngineConfig>,
  omniBrain: OmniBrain,
  knowledgeEngine: KnowledgeEngine,
  planner: CognitiveLayerOrchestrator,
  runtime: RuntimeManager
): UnifiedChatEngine => {
  return new UnifiedChatEngine(config, omniBrain, knowledgeEngine, planner, runtime);
};
