# @gluv/adapters

AI provider adapters for the Gluv Framework - connect to OpenAI, Anthropic, Vercel AI SDK, and more.

## Installation

```bash
# Base package
pnpm add @gluv/adapters

# Provider SDKs (install the ones you need)
pnpm add openai          # For OpenAI
pnpm add @anthropic-ai/sdk  # For Anthropic
pnpm add ai              # For Vercel AI SDK
```

## OpenAI Adapter

```typescript
import { createOpenAIAdapter, createOpenAIPlanGenerator } from '@gluv/adapters/openai'

// Create adapter
const adapter = createOpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4-turbo-preview',
  maxTokens: 4096,
  temperature: 0.7,
  // Optional: custom base URL (for Azure or proxies)
  baseURL: 'https://your-proxy.com/v1',
  organization: 'org-xxx',
})

// Generate a plan
const plan = await adapter.generatePlan({
  userMessage: 'Add the blue widget to my cart',
  capabilities: gluv.getCapabilities(),
  messages: conversationHistory,
})

// Or create a plan generator function
const planGenerator = createOpenAIPlanGenerator({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4-turbo-preview',
})

// Use with useChatInterface
const { sendMessage } = useChatInterface({ planGenerator })
```

### Streaming

```typescript
const plan = await adapter.generatePlanStream(
  {
    userMessage: 'Search for gadgets',
    capabilities: gluv.getCapabilities(),
  },
  (chunk) => {
    // Update UI with partial response
    setResponse(chunk.response)
  }
)
```

## Anthropic Adapter

```typescript
import { createAnthropicAdapter, createAnthropicPlanGenerator } from '@gluv/adapters/anthropic'

const adapter = createAnthropicAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-3-opus-20240229',
  maxTokens: 4096,
  temperature: 0.7,
})

const plan = await adapter.generatePlan({
  userMessage: 'Add the blue widget to my cart',
  capabilities: gluv.getCapabilities(),
})

// Streaming
const plan = await adapter.generatePlanStream(input, (chunk) => {
  setResponse(chunk.response)
})
```

## Vercel AI SDK Adapter

The Vercel AI adapter works with any provider supported by the AI SDK.

```typescript
import { createVercelAIAdapter, createVercelAIPlanGenerator } from '@gluv/adapters/vercel-ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { groq } from '@ai-sdk/groq'

// With OpenAI
const openaiAdapter = createVercelAIAdapter({
  model: openai('gpt-4-turbo'),
})

// With Anthropic
const anthropicAdapter = createVercelAIAdapter({
  model: anthropic('claude-3-opus-20240229'),
})

// With Groq
const groqAdapter = createVercelAIAdapter({
  model: groq('mixtral-8x7b-32768'),
})
```

### Next.js API Route

```typescript
// app/api/chat/route.ts
import { createVercelAIChatHandler } from '@gluv/adapters/vercel-ai'
import { openai } from '@ai-sdk/openai'
import { gluv } from '@/lib/gluv'

export const { POST } = createVercelAIChatHandler({
  model: openai('gpt-4-turbo'),
  capabilities: gluv.getCapabilities(),
  systemPrompt: 'You are a helpful shopping assistant.',
  maxTokens: 4096,
})
```

```tsx
// In your component
import { useChat } from 'ai/react'

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  })

  return (
    <form onSubmit={handleSubmit}>
      {messages.map((m) => (
        <div key={m.id}>{m.content}</div>
      ))}
      <input value={input} onChange={handleInputChange} />
    </form>
  )
}
```

## Custom Prompt Templates

Customize the prompts sent to the LLM:

```typescript
import { createOpenAIAdapter, defaultPromptTemplate } from '@gluv/adapters'

const adapter = createOpenAIAdapter(
  { apiKey: '...', model: 'gpt-4-turbo' },
  {
    // Override the system prompt
    planningSystem: `You are a specialized e-commerce assistant.

When helping users:
1. Always confirm quantities before adding to cart
2. Suggest related products when appropriate
3. Apply coupons automatically when available

${defaultPromptTemplate.planningSystem}`,

    // Override user message formatting
    planningUser: (input) => {
      const caps = input.capabilities
        .map((c) => `- ${c.name}: ${c.description}`)
        .join('\n')

      return `Available tools:
${caps}

Customer request: ${input.userMessage}

Remember to be helpful and suggest alternatives if items are out of stock.`
    },
  }
)
```

## Types

```typescript
import type {
  AIAdapter,
  AdapterConfig,
  PlanGenerationInput,
  PlanGenerationOutput,
  GeneratedAction,
  Message,
  MessageRole,
  ToolCall,
  PromptTemplate,
  OpenAIConfig,
  AnthropicConfig,
  VercelAIConfig,
} from '@gluv/adapters'
```

## Creating Custom Adapters

Implement the `AIAdapter` interface:

```typescript
import type { AIAdapter, PlanGenerationInput, PlanGenerationOutput, ToolSchema } from '@gluv/adapters'

class MyCustomAdapter implements AIAdapter {
  readonly name = 'my-custom'

  isConfigured(): boolean {
    return true
  }

  formatTools(tools: ToolSchema[]): unknown[] {
    // Convert to your provider's format
    return tools.map((t) => ({ ... }))
  }

  async generatePlan(input: PlanGenerationInput): Promise<PlanGenerationOutput> {
    // Call your LLM
    const response = await myLLM.chat(...)

    return {
      reasoning: '...',
      response: '...',
      actions: [...],
    }
  }
}
```

## License

MIT
