/**
 * @gluv/adapters - AI provider adapters for Gluv Framework
 *
 * This package provides adapters for various AI providers,
 * making it easy to integrate Gluv with different LLMs.
 *
 * @example
 * ```ts
 * import { createOpenAIAdapter } from '@gluv/adapters/openai'
 * import { createAnthropicAdapter } from '@gluv/adapters/anthropic'
 * import { createVercelAIAdapter } from '@gluv/adapters/vercel-ai'
 *
 * // Use with OpenAI
 * const openaiAdapter = createOpenAIAdapter({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: 'gpt-4-turbo-preview',
 * })
 *
 * // Use with Anthropic
 * const anthropicAdapter = createAnthropicAdapter({
 *   apiKey: process.env.ANTHROPIC_API_KEY!,
 *   model: 'claude-3-opus-20240229',
 * })
 *
 * // Use with Vercel AI SDK (any provider)
 * import { openai } from '@ai-sdk/openai'
 * const vercelAdapter = createVercelAIAdapter({
 *   model: openai('gpt-4-turbo'),
 * })
 * ```
 */

// Types
export type {
  AIAdapter,
  AdapterConfig,
  PlanGenerationInput,
  PlanGenerationOutput,
  GeneratedAction,
  Message,
  MessageRole,
  ToolCall,
  PromptTemplate,
} from './types'

// Utilities
export {
  defaultPromptTemplate,
  parseJsonResponse,
  createPlanOutput,
} from './types'

// OpenAI
export {
  OpenAIAdapter,
  createOpenAIAdapter,
  createOpenAIPlanGenerator,
  type OpenAIConfig,
} from './openai'

// Anthropic
export {
  AnthropicAdapter,
  createAnthropicAdapter,
  createAnthropicPlanGenerator,
  type AnthropicConfig,
} from './anthropic'

// Vercel AI
export {
  VercelAIAdapter,
  createVercelAIAdapter,
  createVercelAIPlanGenerator,
  createVercelAIChatHandler,
  type VercelAIConfig,
} from './vercel-ai'
