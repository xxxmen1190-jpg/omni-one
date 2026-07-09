/**
 * Tools Index — Production Exports
 *
 * Exports the production tool registry, SDK, native tools, and marketplace.
 * Legacy mock-based tools (WebTools, CodeTools, VisionTools, etc.) are NOT
 * exported from here — they are superseded by the native tool library.
 */

// Core registry and manager
export { ToolRegistry } from "./ToolRegistry";
export { ToolManager } from "./ToolManager";
export type { ToolExecutionResult, ToolExecutionContext } from "./ToolManager";
export { BaseTool } from "./BaseTool";
export { ToolPipeline } from "./ToolPipeline";
export type { PipelineStep, PipelineResult } from "./ToolPipeline";
export { ToolInitializer, initializeToolRegistry } from "./ToolInitializer";

// Phase 12 Universal SDK exports
export * from "./sdk";
export * from "./sdk/CapabilityRegistryIntegration";
export * from "./sdk/PermissionSystem";
export * from "./sdk/ToolPlanner";
export * from "./sdk/ToolResultFusion";

// Native Tools (Phase 12.2 — Production-ready)
export * from "./native";

// Marketplace
export * from "./marketplace";
