import { ReasoningTrace, ReasoningStep } from "../../types/ux";
import { ExecutionContext } from "../../types/integration";
import { Logger } from "../system/Logger";

/**
 * Reasoning Trace Generator - Creates human-readable reasoning traces
 */

export class ReasoningTraceGenerator {
  constructor() {
    Logger.info("ReasoningTraceGenerator initialized");
  }

  /**
   * Generate reasoning trace from execution context
   */
  generateTrace(executionContext: any): ReasoningTrace {
    const steps: ReasoningStep[] = [];

    // Step 1: Query Understanding
    if (executionContext.metadata.queryAnalysis) {
      steps.push(this.generateQueryUnderstandingStep(executionContext.metadata.queryAnalysis));
    }

    // Step 2: Planning
    if (executionContext.metadata.plan) {
      steps.push(this.generatePlanningStep(executionContext.metadata.plan));
    }

    // Step 3: Knowledge Retrieval Decision
    if (executionContext.metadata.ragResults) {
      steps.push(this.generateRAGStep(executionContext.metadata.ragResults));
    }

    // Step 4: Memory Injection Decision
    if (executionContext.metadata.memoryContext) {
      steps.push(this.generateMemoryStep(executionContext.metadata.memoryContext));
    }

    // Step 5: Execution Strategy
    if (executionContext.metadata.toolsUsed || executionContext.metadata.agentsUsed) {
      steps.push(this.generateExecutionStep(executionContext.metadata));
    }

    // Final conclusion
    const conclusion = this.generateConclusion(steps, executionContext);

    return {
      enabled: true,
      steps,
      finalConclusion: conclusion,
      totalSteps: steps.length,
    };
  }

  /**
   * Generate query understanding step
   */
  private generateQueryUnderstandingStep(queryAnalysis: any): ReasoningStep {
    const intentMap: Record<string, string> = {
      search: "You're asking for information",
      reasoning: "You're asking for analysis or reasoning",
      memory: "You're asking me to recall something",
      composition: "You're asking for a combination of capabilities",
      unknown: "Your intent is unclear",
    };

    return {
      step: 1,
      title: "Understanding Your Query",
      description: `Analyzed your message to understand what you're asking for`,
      reasoning: `Intent detected: ${intentMap[queryAnalysis.intent] || "unknown"}. Complexity: ${queryAnalysis.complexity}. Keywords: ${queryAnalysis.keywords.join(", ")}`,
      decision: `Determined that this query requires ${[
        queryAnalysis.requiresRag ? "knowledge retrieval" : null,
        queryAnalysis.requiresMemory ? "memory access" : null,
        queryAnalysis.requiresReasoning ? "reasoning" : null,
      ]
        .filter(Boolean)
        .join(", ") || "direct response"}`,
      alternatives: [
        "Treat as simple question",
        "Treat as complex reasoning task",
        "Treat as memory recall",
      ],
      selectedAlternative: queryAnalysis.intent,
      confidence: queryAnalysis.confidence,
    };
  }

  /**
   * Generate planning step
   */
  private generatePlanningStep(plan: any): ReasoningStep {
    const taskCount = plan.tasks?.length || 0;
    const parallelizable = plan.parallelizableTasks?.length || 0;

    return {
      step: 2,
      title: "Creating Execution Plan",
      description: `Broke down your request into ${taskCount} executable tasks`,
      reasoning: `Analyzed task dependencies and identified ${parallelizable} tasks that can run in parallel. Total estimated time: ${plan.estimatedTime || "unknown"}ms`,
      decision: `Selected ${plan.strategy || "sequential"} execution strategy for optimal performance`,
      alternatives: [
        "Sequential execution",
        "Parallel execution",
        "Hybrid execution with dependencies",
      ],
      selectedAlternative: plan.strategy || "sequential",
      confidence: plan.confidence || 0.8,
    };
  }

  /**
   * Generate RAG step
   */
  private generateRAGStep(ragResults: any): ReasoningStep {
    const itemCount = ragResults.context?.chunks?.length || 0;
    const relevanceScore = ragResults.context?.confidence || 0;

    return {
      step: 3,
      title: "Retrieving Knowledge",
      description: `Searched knowledge base and found ${itemCount} relevant items`,
      reasoning: `Retrieved documents with average relevance score of ${(relevanceScore * 100).toFixed(0)}%. These sources will be used to ground the response in factual information.`,
      decision: `Including ${itemCount} knowledge items in context window for response generation`,
      alternatives: [
        "Use only memory",
        "Use only reasoning",
        "Skip knowledge retrieval",
      ],
      selectedAlternative: "Include knowledge retrieval",
      confidence: relevanceScore,
    };
  }

  /**
   * Generate memory step
   */
  private generateMemoryStep(memoryContext: any): ReasoningStep {
    const factCount = memoryContext.context?.userFacts?.length || 0;
    const prefCount = Object.keys(memoryContext.context?.userPreferences || {}).length;

    return {
      step: 4,
      title: "Accessing Memory",
      description: `Retrieved ${factCount} facts and ${prefCount} preferences about you`,
      reasoning: `Loaded user memory to personalize response. This includes previous decisions, preferences, and relevant facts that should inform the answer.`,
      decision: `Using memory context to tailor response to your specific situation`,
      alternatives: [
        "Ignore user memory",
        "Use only recent memory",
        "Use only long-term memory",
      ],
      selectedAlternative: "Use full memory context",
      confidence: 0.85,
    };
  }

  /**
   * Generate execution step
   */
  private generateExecutionStep(metadata: any): ReasoningStep {
    const toolCount = metadata.toolsUsed?.length || 0;
    const agentCount = metadata.agentsUsed?.length || 0;

    return {
      step: 5,
      title: "Executing Tools & Agents",
      description: `Executed ${toolCount} tools and ${agentCount} agents to complete tasks`,
      reasoning: `Selected tools and agents based on task requirements. Tools provide specific capabilities, agents provide autonomous execution. Total execution time: ${metadata.executionTime || "unknown"}ms`,
      decision: `Used combination of tools and agents for optimal task completion`,
      alternatives: [
        "Use only tools",
        "Use only agents",
        "Skip execution and use cached results",
      ],
      selectedAlternative: "Use tools and agents",
      confidence: 0.9,
    };
  }

  /**
   * Generate conclusion
   */
  private generateConclusion(steps: ReasoningStep[], context: any): string {
    const parts: string[] = [
      "Based on the above reasoning:",
      `I analyzed your query (${context.metadata?.queryAnalysis?.intent || "unknown"} intent),`,
      `created a plan with ${context.metadata?.plan?.tasks?.length || 1} tasks,`,
    ];

    if (context.metadata?.ragResults) {
      parts.push(`retrieved ${context.metadata.ragResults.context?.chunks?.length || 0} knowledge items,`);
    }

    if (context.metadata?.memoryContext) {
      parts.push(`accessed your memory and preferences,`);
    }

    if (context.metadata?.toolsUsed?.length) {
      parts.push(`executed ${context.metadata.toolsUsed.length} tools,`);
    }

    parts.push(`and generated a response with ${context.metadata?.confidence || 0.8} confidence.`);

    return parts.join(" ");
  }

  /**
   * Generate simple reasoning
   */
  generateSimpleReasoning(title: string, reasoning: string): ReasoningTrace {
    return {
      enabled: true,
      steps: [
        {
          step: 1,
          title,
          description: reasoning,
          reasoning: reasoning,
          decision: "Proceeded with response generation",
          confidence: 0.7,
        },
      ],
      finalConclusion: reasoning,
      totalSteps: 1,
    };
  }

  /**
   * Get reasoning summary
   */
  getReasoningSummary(trace: ReasoningTrace): string {
    if (trace.steps.length === 0) {
      return "No reasoning available";
    }

    const decisions = trace.steps.map((s) => s.decision).join(" → ");
    return `${decisions}`;
  }

  /**
   * Export reasoning as markdown
   */
  exportAsMarkdown(trace: ReasoningTrace): string {
    const lines: string[] = ["# Reasoning Trace\n"];

    for (const step of trace.steps) {
      lines.push(`## Step ${step.step}: ${step.title}\n`);
      lines.push(`**Description:** ${step.description}\n`);
      lines.push(`**Reasoning:** ${step.reasoning}\n`);
      lines.push(`**Decision:** ${step.decision}\n`);

      if (step.alternatives && step.alternatives.length > 0) {
        lines.push(`**Alternatives considered:**`);
        for (const alt of step.alternatives) {
          lines.push(`- ${alt}`);
        }
        lines.push("");
      }

      lines.push(`**Confidence:** ${(step.confidence * 100).toFixed(0)}%\n`);
    }

    lines.push(`## Conclusion\n`);
    lines.push(trace.finalConclusion);

    return lines.join("\n");
  }

  /**
   * Get statistics
   */
  getStatistics(trace: ReasoningTrace): Record<string, any> {
    const confidences = trace.steps.map((s) => s.confidence);
    const avgConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b) / confidences.length : 0;

    return {
      totalSteps: trace.steps.length,
      averageConfidence: avgConfidence,
      minConfidence: Math.min(...confidences, 1),
      maxConfidence: Math.max(...confidences, 0),
      highConfidenceSteps: trace.steps.filter((s) => s.confidence >= 0.8).length,
    };
  }
}

export const createReasoningTraceGenerator = (): ReasoningTraceGenerator => {
  return new ReasoningTraceGenerator();
};
