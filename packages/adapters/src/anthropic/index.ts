/**
 * Anthropic adapter for Gluv Framework.
 *
 * @example
 * ```ts
 * import { createAnthropicAdapter } from '@gluv/adapters/anthropic'
 *
 * const adapter = createAnthropicAdapter({
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 *   model: 'claude-3-opus-20240229',
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
  AdapterConfig,
  PlanGenerationInput,
  PlanGenerationOutput,
  PromptTemplate,
} from '../types'
import {
  defaultPromptTemplate,
  parseJsonResponse,
  createPlanOutput,
} from '../types'

// ============================================================================
// Anthropic Types
// ============================================================================

export interface AnthropicConfig extends AdapterConfig {
  /** Anthropic API key */
  apiKey: string

  /** Base URL (for proxies) */
  baseURL?: string

  /** API version */
  apiVersion?: string
}

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
}

interface AnthropicTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

interface AnthropicResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: AnthropicContentBlock[]
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

// ============================================================================
// Anthropic Adapter
// ============================================================================

export class AnthropicAdapter implements AIAdapter {
  readonly name = 'anthropic'
  private config: AnthropicConfig
  private promptTemplate: PromptTemplate

  constructor(config: AnthropicConfig, promptTemplate?: Partial<PromptTemplate>) {
    this.config = {
      model: 'claude-3-opus-20240229',
      maxTokens: 4096,
      temperature: 0.7,
      apiVersion: '2023-06-01',
      ...config,
    }
    this.promptTemplate = {
      ...defaultPromptTemplate,
      ...promptTemplate,
    }
  }

  isConfigured(): boolean {
    return !!this.config.apiKey
  }

  formatTools(tools: ToolSchema[]): AnthropicTool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }))
  }

  async generatePlan(input: PlanGenerationInput): Promise<PlanGenerationOutput> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic adapter not configured: missing API key')
    }

    const systemPrompt = this.config.systemPrompt ?? this.promptTemplate.planningSystem
    const messages: AnthropicMessage[] = []

    // Add conversation history
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

    // Add current user message
    messages.push({
      role: 'user',
      content: this.promptTemplate.planningUser(input),
    })

    const response = await this.callAPI(systemPrompt, messages)

    // Extract text content
    const textContent = response.content.find((block) => block.type === 'text')
    if (!textContent?.text) {
      throw new Error('No text response from Anthropic')
    }

    try {
      const parsed = parseJsonResponse<{
        reasoning?: string
        response?: string
        actions?: Array<{
          title: string
          description: string
          capabilityName: string
          params: Record<string, unknown>
          blockedBy: string[]
        }>
      }>(textContent.text)

      return createPlanOutput(parsed, response)
    } catch (error) {
      // If JSON parsing fails, treat as conversational response
      return {
        reasoning: 'Conversational response',
        response: textContent.text,
        actions: [],
        rawResponse: response,
      }
    }
  }

  async generatePlanStream(
    input: PlanGenerationInput,
    onChunk: (chunk: Partial<PlanGenerationOutput>) => void
  ): Promise<PlanGenerationOutput> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic adapter not configured: missing API key')
    }

    const systemPrompt = this.config.systemPrompt ?? this.promptTemplate.planningSystem
    const messages: AnthropicMessage[] = []

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

    const fullContent = await this.callAPIStream(systemPrompt, messages, onChunk)

    try {
      const parsed = parseJsonResponse<{
        reasoning?: string
        response?: string
        actions?: Array<{
          title: string
          description: string
          capabilityName: string
          params: Record<string, unknown>
          blockedBy: string[]
        }>
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

  private async callAPI(
    systemPrompt: string,
    messages: AnthropicMessage[]
  ): Promise<AnthropicResponse> {
    const baseURL = this.config.baseURL ?? 'https://api.anthropic.com/v1'

    const response = await fetch(`${baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.apiVersion ?? '2023-06-01',
        ...this.config.headers,
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  private async callAPIStream(
    systemPrompt: string,
    messages: AnthropicMessage[],
    onChunk: (chunk: Partial<PlanGenerationOutput>) => void
  ): Promise<string> {
    const baseURL = this.config.baseURL ?? 'https://api.anthropic.com/v1'

    const response = await fetch(`${baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.apiVersion ?? '2023-06-01',
        ...this.config.headers,
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter((line) => line.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6)

        try {
          const parsed = JSON.parse(data)

          if (parsed.type === 'content_block_delta') {
            const text = parsed.delta?.text
            if (text) {
              fullContent += text
              onChunk({ response: fullContent })
            }
          }
        } catch {
          // Ignore parsing errors for incomplete JSON
        }
      }
    }

    return fullContent
  }
}

/**
 * Create an Anthropic adapter instance.
 */
export function createAnthropicAdapter(
  config: AnthropicConfig,
  promptTemplate?: Partial<PromptTemplate>
): AnthropicAdapter {
  return new AnthropicAdapter(config, promptTemplate)
}

/**
 * Create a plan generator function using Anthropic.
 */
export function createAnthropicPlanGenerator(
  config: AnthropicConfig,
  promptTemplate?: Partial<PromptTemplate>
): (input: PlanGenerationInput) => Promise<PlanGenerationOutput> {
  const adapter = createAnthropicAdapter(config, promptTemplate)
  return (input) => adapter.generatePlan(input)
}
