/**
 * OpenAI adapter for Gluv Framework.
 *
 * @example
 * ```ts
 * import { createOpenAIAdapter } from '@gluv/adapters/openai'
 *
 * const adapter = createOpenAIAdapter({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4-turbo-preview',
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
  Message,
  PromptTemplate,
} from '../types'
import {
  defaultPromptTemplate,
  parseJsonResponse,
  createPlanOutput,
} from '../types'

// ============================================================================
// OpenAI Types
// ============================================================================

export interface OpenAIConfig extends AdapterConfig {
  /** OpenAI API key */
  apiKey: string

  /** Base URL (for Azure or proxies) */
  baseURL?: string

  /** Organization ID */
  organization?: string
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
}

interface OpenAIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required: string[]
    }
  }
}

interface OpenAIResponse {
  id: string
  choices: Array<{
    index: number
    message: OpenAIMessage
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ============================================================================
// OpenAI Adapter
// ============================================================================

export class OpenAIAdapter implements AIAdapter {
  readonly name = 'openai'
  private config: OpenAIConfig
  private promptTemplate: PromptTemplate

  constructor(config: OpenAIConfig, promptTemplate?: Partial<PromptTemplate>) {
    this.config = {
      model: 'gpt-4-turbo-preview',
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
    return !!this.config.apiKey
  }

  formatTools(tools: ToolSchema[]): OpenAITool[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
  }

  async generatePlan(input: PlanGenerationInput): Promise<PlanGenerationOutput> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI adapter not configured: missing API key')
    }

    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: this.config.systemPrompt ?? this.promptTemplate.planningSystem,
      },
    ]

    // Add conversation history
    if (input.messages) {
      for (const msg of input.messages) {
        messages.push({
          role: msg.role as OpenAIMessage['role'],
          content: msg.content,
        })
      }
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: this.promptTemplate.planningUser(input),
    })

    const response = await this.callAPI(messages)

    const assistantMessage = response.choices[0]?.message
    if (!assistantMessage?.content) {
      throw new Error('No response from OpenAI')
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
      }>(assistantMessage.content)

      return createPlanOutput(parsed, response)
    } catch (error) {
      // If JSON parsing fails, treat as conversational response
      return {
        reasoning: 'Conversational response',
        response: assistantMessage.content,
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
      throw new Error('OpenAI adapter not configured: missing API key')
    }

    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: this.config.systemPrompt ?? this.promptTemplate.planningSystem,
      },
    ]

    if (input.messages) {
      for (const msg of input.messages) {
        messages.push({
          role: msg.role as OpenAIMessage['role'],
          content: msg.content,
        })
      }
    }

    messages.push({
      role: 'user',
      content: this.promptTemplate.planningUser(input),
    })

    const response = await this.callAPIStream(messages, onChunk)

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
      }>(response)

      return createPlanOutput(parsed)
    } catch (error) {
      return {
        reasoning: 'Conversational response',
        response,
        actions: [],
      }
    }
  }

  private async callAPI(messages: OpenAIMessage[]): Promise<OpenAIResponse> {
    const baseURL = this.config.baseURL ?? 'https://api.openai.com/v1'

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.organization && {
          'OpenAI-Organization': this.config.organization,
        }),
        ...this.config.headers,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  private async callAPIStream(
    messages: OpenAIMessage[],
    onChunk: (chunk: Partial<PlanGenerationOutput>) => void
  ): Promise<string> {
    const baseURL = this.config.baseURL ?? 'https://api.openai.com/v1'

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.organization && {
          'OpenAI-Organization': this.config.organization,
        }),
        ...this.config.headers,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
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
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content
            onChunk({ response: fullContent })
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
 * Create an OpenAI adapter instance.
 */
export function createOpenAIAdapter(
  config: OpenAIConfig,
  promptTemplate?: Partial<PromptTemplate>
): OpenAIAdapter {
  return new OpenAIAdapter(config, promptTemplate)
}

/**
 * Create a plan generator function using OpenAI.
 */
export function createOpenAIPlanGenerator(
  config: OpenAIConfig,
  promptTemplate?: Partial<PromptTemplate>
): (input: PlanGenerationInput) => Promise<PlanGenerationOutput> {
  const adapter = createOpenAIAdapter(config, promptTemplate)
  return (input) => adapter.generatePlan(input)
}
