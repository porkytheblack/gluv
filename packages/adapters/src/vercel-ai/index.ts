/**
 * Vercel AI SDK adapter for Gluv Framework.
 *
 * This adapter integrates with Vercel's AI SDK, allowing you to use
 * any provider supported by the SDK (OpenAI, Anthropic, Groq, etc.).
 *
 * @example
 * ```ts
 * import { createVercelAIAdapter } from '@gluv/adapters/vercel-ai'
 * import { openai } from '@ai-sdk/openai'
 *
 * const adapter = createVercelAIAdapter({
 *   model: openai('gpt-4-turbo'),
 * })
 *
 * const plan = await adapter.generatePlan({
 *   userMessage: 'Add the blue widget to my cart',
 *   capabilities: gluv.getCapabilities(),
 * })
 * ```
 */

import type { ToolSchema } from '@gluv/core'
import type {
  AIAdapter,
  PlanGenerationInput,
  PlanGenerationOutput,
  PromptTemplate,
  GeneratedAction,
} from '../types'
import {
  defaultPromptTemplate,
  parseJsonResponse,
  createPlanOutput,
} from '../types'

// ============================================================================
// Vercel AI Types
// ============================================================================

/**
 * Configuration for Vercel AI adapter.
 */
export interface VercelAIConfig {
  /**
   * The AI model to use. This should be a model instance from @ai-sdk/openai,
   * @ai-sdk/anthropic, or any other compatible provider.
   */
  model: unknown

  /** Maximum tokens for responses */
  maxTokens?: number

  /** Temperature for generation */
  temperature?: number

  /** System prompt override */
  systemPrompt?: string
}

// ============================================================================
// Vercel AI Adapter
// ============================================================================

export class VercelAIAdapter implements AIAdapter {
  readonly name = 'vercel-ai'
  private config: VercelAIConfig
  private promptTemplate: PromptTemplate

  constructor(config: VercelAIConfig, promptTemplate?: Partial<PromptTemplate>) {
    this.config = {
      maxTokens: 4096,
      temperature: 0.7,
      ...config,
    }
    this.promptTemplate = {
      ...defaultPromptTemplate,
      ...promptTemplate,
    }
  }

  isConfigured(): boolean {
    return !!this.config.model
  }

  formatTools(tools: ToolSchema[]): unknown[] {
    // Vercel AI SDK uses its own tool format
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }))
  }

  async generatePlan(input: PlanGenerationInput): Promise<PlanGenerationOutput> {
    if (!this.isConfigured()) {
      throw new Error('Vercel AI adapter not configured: missing model')
    }

    // Dynamic import to avoid bundling issues
    const { generateText } = await import('ai')

    const systemPrompt = this.config.systemPrompt ?? this.promptTemplate.planningSystem

    // Build messages
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    if (input.messages) {
      for (const msg of input.messages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content,
          })
        }
      }
    }

    messages.push({
      role: 'user',
      content: this.promptTemplate.planningUser(input),
    })

    const result = await generateText({
      model: this.config.model as Parameters<typeof generateText>[0]['model'],
      system: systemPrompt,
      messages,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    })

    try {
      const parsed = parseJsonResponse<{
        reasoning?: string
        response?: string
        actions?: GeneratedAction[]
      }>(result.text)

      return createPlanOutput(parsed, result)
    } catch (error) {
      return {
        reasoning: 'Conversational response',
        response: result.text,
        actions: [],
        rawResponse: result,
      }
    }
  }

  async generatePlanStream(
    input: PlanGenerationInput,
    onChunk: (chunk: Partial<PlanGenerationOutput>) => void
  ): Promise<PlanGenerationOutput> {
    if (!this.isConfigured()) {
      throw new Error('Vercel AI adapter not configured: missing model')
    }

    const { streamText } = await import('ai')

    const systemPrompt = this.config.systemPrompt ?? this.promptTemplate.planningSystem

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    if (input.messages) {
      for (const msg of input.messages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content,
          })
        }
      }
    }

    messages.push({
      role: 'user',
      content: this.promptTemplate.planningUser(input),
    })

    const result = await streamText({
      model: this.config.model as Parameters<typeof streamText>[0]['model'],
      system: systemPrompt,
      messages,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    })

    let fullContent = ''

    for await (const chunk of result.textStream) {
      fullContent += chunk
      onChunk({ response: fullContent })
    }

    try {
      const parsed = parseJsonResponse<{
        reasoning?: string
        response?: string
        actions?: GeneratedAction[]
      }>(fullContent)

      return createPlanOutput(parsed)
    } catch (error) {
      return {
        reasoning: 'Conversational response',
        response: fullContent,
        actions: [],
      }
    }
  }
}

/**
 * Create a Vercel AI adapter instance.
 */
export function createVercelAIAdapter(
  config: VercelAIConfig,
  promptTemplate?: Partial<PromptTemplate>
): VercelAIAdapter {
  return new VercelAIAdapter(config, promptTemplate)
}

/**
 * Create a plan generator function using Vercel AI SDK.
 */
export function createVercelAIPlanGenerator(
  config: VercelAIConfig,
  promptTemplate?: Partial<PromptTemplate>
): (input: PlanGenerationInput) => Promise<PlanGenerationOutput> {
  const adapter = createVercelAIAdapter(config, promptTemplate)
  return (input) => adapter.generatePlan(input)
}

// ============================================================================
// React Integration (for use with useChat)
// ============================================================================

/**
 * Create handlers for Vercel AI's useChat hook.
 * This enables real-time streaming in React applications.
 *
 * @example
 * ```tsx
 * // In your API route (app/api/chat/route.ts)
 * import { createVercelAIChatHandler } from '@gluv/adapters/vercel-ai'
 * import { openai } from '@ai-sdk/openai'
 *
 * export const { POST } = createVercelAIChatHandler({
 *   model: openai('gpt-4-turbo'),
 *   capabilities: gluv.getCapabilities(),
 * })
 *
 * // In your component
 * import { useChat } from 'ai/react'
 *
 * function Chat() {
 *   const { messages, input, handleInputChange, handleSubmit } = useChat()
 *   // ...
 * }
 * ```
 */
export function createVercelAIChatHandler(config: {
  model: unknown
  capabilities: Array<{ name: string; description: string }>
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}) {
  return {
    POST: async (request: Request) => {
      const { streamText } = await import('ai')

      const { messages } = await request.json()

      const systemPrompt =
        config.systemPrompt ??
        defaultPromptTemplate.planningSystem +
          '\n\nAvailable capabilities:\n' +
          config.capabilities
            .map((c) => `- ${c.name}: ${c.description}`)
            .join('\n')

      const result = await streamText({
        model: config.model as Parameters<typeof streamText>[0]['model'],
        system: systemPrompt,
        messages,
        maxTokens: config.maxTokens ?? 4096,
        temperature: config.temperature ?? 0.7,
      })

      return result.toDataStreamResponse()
    },
  }
}
