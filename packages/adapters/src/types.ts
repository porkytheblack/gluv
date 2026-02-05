import type { ToolSchema, CapabilityInfo } from '@gluv/core'

// ============================================================================
// Adapter Configuration
// ============================================================================

export interface AdapterConfig {
  /** Model identifier */
  model: string

  /** Maximum tokens for responses */
  maxTokens?: number

  /** Temperature for generation */
  temperature?: number

  /** System prompt prefix */
  systemPrompt?: string

  /** Enable streaming responses */
  streaming?: boolean

  /** Custom headers */
  headers?: Record<string, string>
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface Message {
  role: MessageRole
  content: string
  toolCalls?: ToolCall[]
  toolCallId?: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

// ============================================================================
// Plan Generation Types
// ============================================================================

export interface PlanGenerationInput {
  /** User's message */
  userMessage: string

  /** Available capabilities */
  capabilities: CapabilityInfo[]

  /** Conversation history */
  messages?: Message[]

  /** Additional context */
  context?: Record<string, unknown>
}

export interface PlanGenerationOutput {
  /** Reasoning for the plan */
  reasoning: string

  /** Response message to user */
  response: string

  /** Actions to execute */
  actions: GeneratedAction[]

  /** Raw LLM response (for debugging) */
  rawResponse?: unknown
}

export interface GeneratedAction {
  /** Action title */
  title: string

  /** Action description */
  description: string

  /** Capability to invoke */
  capabilityName: string

  /** Parameters for the action */
  params: Record<string, unknown>

  /** IDs of actions this one depends on */
  blockedBy: string[]
}

// ============================================================================
// Adapter Interface
// ============================================================================

/**
 * Base interface for AI provider adapters.
 */
export interface AIAdapter {
  /** Adapter name */
  readonly name: string

  /**
   * Generate an action plan from user input.
   */
  generatePlan(input: PlanGenerationInput): Promise<PlanGenerationOutput>

  /**
   * Generate a streaming plan (if supported).
   */
  generatePlanStream?(
    input: PlanGenerationInput,
    onChunk: (chunk: Partial<PlanGenerationOutput>) => void
  ): Promise<PlanGenerationOutput>

  /**
   * Convert tool schemas to provider-specific format.
   */
  formatTools(tools: ToolSchema[]): unknown

  /**
   * Check if the adapter is properly configured.
   */
  isConfigured(): boolean
}

// ============================================================================
// Prompt Templates
// ============================================================================

export interface PromptTemplate {
  /** System prompt for planning */
  planningSystem: string

  /** User message format for planning */
  planningUser: (input: PlanGenerationInput) => string

  /** Tool description format */
  toolDescription: (tool: ToolSchema) => string
}

/**
 * Default prompt templates.
 */
export const defaultPromptTemplate: PromptTemplate = {
  planningSystem: `You are an AI assistant that helps users accomplish tasks by invoking available capabilities.

When the user makes a request:
1. Analyze what they want to accomplish
2. Identify which capabilities can help
3. Create a plan with specific actions
4. Consider dependencies between actions

For each action, specify:
- title: A brief human-readable title
- description: What this action will do
- capabilityName: The exact name of the capability to invoke
- params: The parameters to pass
- blockedBy: Array of action indices this depends on (empty if no dependencies)

Respond in this JSON format:
{
  "reasoning": "Your analysis of the request and plan",
  "response": "A friendly message to show the user",
  "actions": [
    {
      "title": "...",
      "description": "...",
      "capabilityName": "...",
      "params": {...},
      "blockedBy": []
    }
  ]
}

If no actions are needed (just a conversational response), return an empty actions array.
Always respond with valid JSON.`,

  planningUser: (input: PlanGenerationInput) => {
    const capabilitiesDesc = input.capabilities
      .map(
        (cap) =>
          `- ${cap.name}: ${cap.description} (${cap.kind}, ${cap.requireConfirm ? 'requires confirmation' : 'no confirmation needed'})`
      )
      .join('\n')

    return `Available capabilities:
${capabilitiesDesc}

User request: ${input.userMessage}`
  },

  toolDescription: (tool: ToolSchema) =>
    `${tool.name}: ${tool.description}`,
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse JSON from LLM response, handling markdown code blocks.
 */
export function parseJsonResponse<T>(response: string): T {
  // Remove markdown code blocks if present
  let cleaned = response.trim()

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }

  cleaned = cleaned.trim()

  return JSON.parse(cleaned) as T
}

/**
 * Create a plan generation output from raw response.
 */
export function createPlanOutput(
  parsed: {
    reasoning?: string
    response?: string
    actions?: GeneratedAction[]
  },
  rawResponse?: unknown
): PlanGenerationOutput {
  return {
    reasoning: parsed.reasoning ?? 'No reasoning provided',
    response: parsed.response ?? 'I have processed your request.',
    actions: (parsed.actions ?? []).map((action, index) => ({
      title: action.title ?? `Action ${index + 1}`,
      description: action.description ?? '',
      capabilityName: action.capabilityName,
      params: action.params ?? {},
      blockedBy: action.blockedBy ?? [],
    })),
    rawResponse,
  }
}
