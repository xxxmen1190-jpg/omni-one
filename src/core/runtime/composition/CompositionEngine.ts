import {
  ComposedCapability,
  CompositionWorkflow,
  CompositionStep,
  DataFlowMapping,
} from "../../../types/runtime";
import { EventBus } from "../events/EventBus";
import { CapabilityRegistry } from "../registry/CapabilityRegistry";
import { PluginRuntime } from "../plugins/PluginRuntime";
import { Logger } from "../../system/Logger";

/**
 * Capability Composition Engine - Combines capabilities into new workflows
 * Enables dynamic creation of new capabilities from existing ones
 */

export class CompositionEngine {
  private eventBus: EventBus;
  private registry: CapabilityRegistry;
  private pluginRuntime: PluginRuntime;
  private compositions: Map<string, ComposedCapability> = new Map();
  private compositionIdCounter: number = 0;

  constructor(
    eventBus: EventBus,
    registry: CapabilityRegistry,
    pluginRuntime: PluginRuntime
  ) {
    this.eventBus = eventBus;
    this.registry = registry;
    this.pluginRuntime = pluginRuntime;
    Logger.info("CompositionEngine initialized");
  }

  /**
   * Create a composed capability
   */
  async createComposition(
    name: string,
    description: string,
    components: string[],
    workflow: CompositionWorkflow
  ): Promise<ComposedCapability> {
    try {
      // Validate components
      for (const componentId of components) {
        if (!this.registry.has(componentId)) {
          throw new Error(`Component not found: ${componentId}`);
        }
      }

      // Validate workflow
      this.validateWorkflow(workflow, components);

      // Create composition
      const composition: ComposedCapability = {
        id: this.generateCompositionId(),
        name,
        description,
        components,
        workflow,
        metadata: {},
        createdAt: Date.now(),
        usageCount: 0,
      };

      this.compositions.set(composition.id, composition);

      // Emit event
      await this.eventBus.emit({
        type: "composition:created",
        timestamp: Date.now(),
        source: "CompositionEngine",
        data: {
          compositionId: composition.id,
          name,
          components,
        },
        priority: "normal",
      });

      Logger.info("Composition created", {
        compositionId: composition.id,
        name,
        components: components.length,
      });

      return composition;
    } catch (error: any) {
      Logger.error("Failed to create composition", {
        name,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Execute a composed capability
   */
  async executeComposition(
    compositionId: string,
    input: any
  ): Promise<any> {
    const composition = this.compositions.get(compositionId);
    if (!composition) {
      throw new Error(`Composition not found: ${compositionId}`);
    }

    try {
      Logger.info("Executing composition", { compositionId });

      const context = {
        input,
        output: {},
        state: {} as Record<string, any>,
      };

      // Execute workflow
      for (const step of composition.workflow.steps) {
        try {
          // Check condition
          if (step.condition && !step.condition(context.state)) {
            Logger.debug("Step skipped due to condition", { stepId: step.id });
            continue;
          }

          // Map input
          const stepInput = this.mapInput(step.inputMapping, context);

          // Execute step
          const plugin = this.pluginRuntime.getPlugin(step.pluginId);
          if (!plugin) {
            throw new Error(`Plugin not found: ${step.pluginId}`);
          }

          const stepOutput = await this.pluginRuntime.executePlugin(
            step.pluginId,
            stepInput
          );

          // Map output
          const mappedOutput = this.mapOutput(step.outputMapping, stepOutput);
          context.state = { ...context.state, ...mappedOutput };

          Logger.debug("Step executed", {
            stepId: step.id,
            pluginId: step.pluginId,
          });
        } catch (error: any) {
          // Handle step error
          const errorStrategy = composition.workflow.errorHandling.onStepError;

          if (errorStrategy === "fail") {
            throw error;
          } else if (errorStrategy === "skip") {
            Logger.warn("Step skipped due to error", {
              stepId: step.id,
              error: error.message,
            });
            continue;
          } else if (errorStrategy === "retry") {
            // Retry logic
            Logger.info("Retrying step", { stepId: step.id });
            // Simplified retry - in production, implement exponential backoff
            const stepInput = this.mapInput(step.inputMapping, context);
            const plugin = this.pluginRuntime.getPlugin(step.pluginId);
            if (plugin) {
              const stepOutput = await this.pluginRuntime.executePlugin(
                step.pluginId,
                stepInput
              );
              const mappedOutput = this.mapOutput(step.outputMapping, stepOutput);
              context.state = { ...context.state, ...mappedOutput };
            }
          } else if (errorStrategy === "fallback" && step.fallback) {
            // Use fallback plugin
            Logger.info("Using fallback plugin", {
              stepId: step.id,
              fallback: step.fallback,
            });
            const stepInput = this.mapInput(step.inputMapping, context);
            const fallbackOutput = await this.pluginRuntime.executePlugin(
              step.fallback,
              stepInput
            );
            const mappedOutput = this.mapOutput(step.outputMapping, fallbackOutput);
            context.state = { ...context.state, ...mappedOutput };
          }
        }
      }

      // Apply data flow transformations
      for (const flow of composition.workflow.dataFlow) {
        if (flow.transform) {
          const sourceData = context.state[flow.from] || context.input;
          context.state[flow.to] = flow.transform(sourceData);
        }
      }

      composition.usageCount++;
      context.output = context.state;

      Logger.info("Composition executed", {
        compositionId,
        duration: Date.now(),
      });

      return context.output;
    } catch (error: any) {
      Logger.error("Composition execution failed", {
        compositionId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Validate workflow
   */
  private validateWorkflow(
    workflow: CompositionWorkflow,
    components: string[]
  ): void {
    // Check that all steps reference valid components
    for (const step of workflow.steps) {
      if (!components.includes(step.pluginId)) {
        throw new Error(`Step references unknown component: ${step.pluginId}`);
      }

      // Check fallback if present
      if (step.fallback && !components.includes(step.fallback)) {
        throw new Error(`Fallback references unknown component: ${step.fallback}`);
      }
    }

    // Check for circular dependencies
    this.checkCircularDependencies(workflow.steps);
  }

  /**
   * Check for circular dependencies
   */
  private checkCircularDependencies(steps: CompositionStep[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const visit = (stepId: string): void => {
      visited.add(stepId);
      recursionStack.add(stepId);

      const step = steps.find((s) => s.id === stepId);
      if (!step) return;

      // Check dependencies (simplified - in production, build proper dependency graph)
      if (step.fallback && recursionStack.has(step.fallback)) {
        throw new Error("Circular dependency detected");
      }

      recursionStack.delete(stepId);
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        visit(step.id);
      }
    }
  }

  /**
   * Map input for a step
   */
  private mapInput(
    inputMapping: Record<string, string>,
    context: any
  ): any {
    const mapped: Record<string, any> = {};

    for (const [key, source] of Object.entries(inputMapping)) {
      if (source === "input") {
        mapped[key] = context.input;
      } else if (source.startsWith("state.")) {
        const stateKey = source.substring(6);
        mapped[key] = context.state[stateKey];
      } else {
        mapped[key] = context.state[source];
      }
    }

    return mapped;
  }

  /**
   * Map output from a step
   */
  private mapOutput(
    outputMapping: Record<string, string>,
    output: any
  ): Record<string, any> {
    const mapped: Record<string, any> = {};

    for (const [target, source] of Object.entries(outputMapping)) {
      if (source === "output") {
        mapped[target] = output;
      } else if (Array.isArray(output)) {
        mapped[target] = output[parseInt(source)];
      } else if (typeof output === "object") {
        mapped[target] = output[source];
      }
    }

    return mapped;
  }

  /**
   * Get composition
   */
  getComposition(compositionId: string): ComposedCapability | undefined {
    return this.compositions.get(compositionId);
  }

  /**
   * Get all compositions
   */
  getAllCompositions(): ComposedCapability[] {
    return Array.from(this.compositions.values());
  }

  /**
   * Delete composition
   */
  deleteComposition(compositionId: string): void {
    this.compositions.delete(compositionId);
    Logger.info("Composition deleted", { compositionId });
  }

  /**
   * Get composition statistics
   */
  getStatistics(): Record<string, any> {
    const compositions = Array.from(this.compositions.values());
    const totalUsage = compositions.reduce((sum, c) => sum + c.usageCount, 0);

    return {
      totalCompositions: compositions.length,
      totalUsage,
      averageUsage: compositions.length > 0 ? totalUsage / compositions.length : 0,
      compositions: compositions.map((c) => ({
        id: c.id,
        name: c.name,
        components: c.components.length,
        usageCount: c.usageCount,
      })),
    };
  }

  /**
   * Generate composition ID
   */
  private generateCompositionId(): string {
    return `comp-${Date.now()}-${++this.compositionIdCounter}`;
  }
}

export const createCompositionEngine = (
  eventBus: EventBus,
  registry: CapabilityRegistry,
  pluginRuntime: PluginRuntime
): CompositionEngine => {
  return new CompositionEngine(eventBus, registry, pluginRuntime);
};
