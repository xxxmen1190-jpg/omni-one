# Omni One — Manus AI Integration Guide

This document details the native integration of Manus AI into the Omni One platform, establishing it as a first-class AI provider and autonomous agent.

## 1. Architecture Overview

Manus AI is integrated at multiple layers within Omni One to leverage its advanced capabilities for complex, long-running, and autonomous tasks. This integration follows the existing provider interface pattern to ensure seamless interoperability with other AI models.

### 1.1 Key Components

| Component | Description | Location |
|---|---|---|
| `ManusProvider` | Implements the standard AI provider interface for direct API calls to Manus AI. Handles initialization, API key validation, health checks, latency/cost estimation, and task execution. | `backend/src/providers/ManusProvider.ts` |
| `ManusAgent` | A specialized agent designed to utilize `ManusProvider` for autonomous execution, deep research, code generation, and complex project analysis. | `backend/src/services/manusAgent.ts` |
| `OmniBrainV2` | The central orchestration engine, updated with routing rules to intelligently delegate complex tasks to `ManusAgent`. | `backend/src/services/omniBrainV2.ts` |
| `MultiAgentOrchestrator` | Enhanced to include `ManusAgent` as a potential participant in collaborative multi-agent workflows. | `backend/src/services/multiAgentOrchestrator.ts` |
| `WorkflowEngine` | Supports a new `ManusTask` node, allowing users to embed autonomous Manus AI operations within visual workflows. | `backend/src/services/workflowEngine.ts` |
| `ManusSettings` (Frontend) | User interface for configuring Manus AI API key, testing connection, and viewing capabilities and status. | `src/ui/components/settings/ManusSettings.tsx` |

## 2. Integration Flow

### 2.1 Provider Flow

1.  **Configuration**: Users provide their Manus AI API key via the `ManusSettings` UI.
2.  **Validation**: The `ManusProvider` validates the API key (simulated by checking prefix and length).
3.  **Health Check**: The provider continuously monitors its connection status and reports latency and estimated costs.
4.  **Execution**: When `ManusProvider.execute()` is called, it simulates an API request to Manus AI, returning a structured response.

### 2.2 Agent Flow

1.  **Task Delegation**: `OmniBrainV2` analyzes incoming user goals. If a goal matches specific keywords (e.g., 
"build project", "autonomous execution", "deep research"), it routes the task to `ManusAgent`.
2.  **Autonomous Execution**: `ManusAgent` takes the complex task and, internally, would use Manus AI's capabilities for planning, tool use, and execution. It returns a `ManusTaskResult` with status, output, and cost metrics.

### 2.3 Workflow Integration

*   A new `Manus Task` node is available in the `Workflow Builder`.
*   This node, when executed by the `WorkflowEngine`, triggers `ManusAgent.runAutonomousTask()` with the specified objective.

### 2.4 Multi-Agent Collaboration

*   The `MultiAgentOrchestrator` can now include `ManusAgent` as a participant in collaborative workflows.
*   For tasks requiring deep research or autonomous problem-solving, `ManusAgent` can be assigned a role within the multi-agent team.

## 3. Configuration and Monitoring

### 3.1 Settings UI

*   **Location**: `Settings > AI Providers > Manus AI`
*   **Fields**: API Key input, Connection Status (IDLE, TESTING, CONNECTED, ERROR), Latency, Estimated Cost, and a list of supported Capabilities.
*   **Test Connection**: A button to verify the API key and fetch real-time status.

### 3.2 Monitoring

*   Manus AI usage is integrated into the existing `metricsService`.
*   Metrics include API request counts, latency, token usage, and estimated costs, visible in the Admin Dashboard.
*   Error rates specific to Manus AI are tracked for proactive alerting.

## 4. Error Recovery

*   **Provider Fallback**: If `ManusProvider` is unavailable or returns an error for a standard request, OmniBrain will attempt to route the request to an alternative capable provider (e.g., Claude, GPT).
*   **Agent Fallback**: For tasks specifically requiring an autonomous agent, if `ManusAgent` fails, the system will attempt to decompose the task and distribute it among other capable agents (e.g., a combination of Claude for planning and GPT for execution).

## 5. Troubleshooting

*   **API Key Issues**: Ensure the API key is correctly entered in the settings. Verify there are no leading/trailing spaces.
*   **Network Connectivity**: Check backend logs for network errors when connecting to Manus AI endpoints.
*   **Rate Limits**: Monitor Manus AI usage metrics. If rate limits are hit, consider optimizing prompts or increasing the Manus AI plan.
*   **Task Failures**: Review `ManusAgent` logs for detailed error messages and execution traces. The `OmniBrainV2` reflection mechanism can provide insights into why a task failed and suggest recovery steps.

This integration ensures that Omni One can harness the full power of Manus AI for its most demanding and complex tasks, providing unparalleled autonomous capabilities to its users.
