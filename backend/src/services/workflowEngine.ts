/**
 * Workflow Engine — Omni One Backend
 * 
 * Executes visual node-based workflows with triggers, conditions, and loops.
 */

import { prisma } from "../database/prisma.js";
import { AppError } from "../types/index.js";
import { logger } from "../utils/logger.js";

export interface WorkflowNode {
  id: string;
  type: string; // "trigger" | "action" | "condition" | "loop"
  action: string; // "search" | "read_file" | "summarize" | "email" | "save_memory"
  params: any;
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

class WorkflowEngineClass {
  /**
   * Create a new workflow.
   */
  async createWorkflow(userId: string, data: { name: string; description?: string; definition: any }) {
    return await prisma.workflow.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        definition: data.definition,
      },
    });
  }

  /**
   * Execute a workflow.
   */
  async executeWorkflow(userId: string, workflowId: string, input: any = {}) {
    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new AppError("Workflow not found", 404);

    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId,
        userId,
        status: "RUNNING",
        input,
        startedAt: new Date(),
      },
    });

    try {
      const definition = workflow.definition as any;
      const nodes = definition.nodes as WorkflowNode[];
      const edges = definition.edges as WorkflowEdge[];
      
      // Simple linear execution logic for now
      let currentNode = nodes.find(n => n.type === "trigger");
      const results: any = { trigger: input };

      while (currentNode) {
        logger.info({ workflowId, nodeId: currentNode.id }, "Executing workflow node");
        
        // Execute node action
        const result = await this.executeNodeAction(currentNode, results);
        results[currentNode.id] = result;

        // Find next node
        const edge = edges.find(e => e.from === currentNode?.id);
        currentNode = edge ? nodes.find(n => n.id === edge.to) : undefined;
      }

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: "COMPLETED",
          output: results,
          finishedAt: new Date(),
        },
      });

      return results;
    } catch (error) {
      logger.error({ workflowId, executionId: execution.id, error }, "Workflow execution failed");
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: "FAILED",
          logs: { error: (error as Error).message },
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async executeNodeAction(node: WorkflowNode, context: any) {
    switch (node.action) {
      case "search": return { results: ["Result 1", "Result 2"] };
      case "summarize": return { summary: "This is a summary of the input." };
      case "save_memory": return { status: "saved" };
      default: return { status: "ok" };
    }
  }
}

export const workflowEngine = new WorkflowEngineClass();
