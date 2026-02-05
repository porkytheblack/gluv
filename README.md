# Gluv Framework

**Gluv** is an agentic framework for building AI-powered applications with seamless plug-and-play capabilities for both UI and functionality.

> "feels simple in your hands, and fits your agents abilities like a gluv"

## Features

- **🤜 Fold**: Agent-invokable actions that modify application state
- **🫴 Unfold**: User-interaction primitives for collecting input with custom UI
- **⏪ Undo**: Built-in action reversibility with hybrid compensation approach
- **🔒 Type Safety**: Full TypeScript support with Zod schema validation
- **⚡ Effect-based**: Functional programming patterns with Effect library
- **🎨 React Integration**: Hooks, components, and chat interface
- **🤖 Multi-Provider**: Adapters for OpenAI, Anthropic, Vercel AI SDK
- **📦 Monorepo**: Separation of concerns with modular packages

## Packages

| Package | Description |
|---------|-------------|
| `@gluv/core` | Core runtime, capability registry, action coordinator |
| `@gluv/react` | React hooks, components, and chat interface |
| `@gluv/adapters` | AI provider adapters (OpenAI, Anthropic, Vercel AI) |

## Quick Start

### Installation

```bash
# Using pnpm (recommended)
pnpm add @gluv/core @gluv/react zod

# Using npm
npm install @gluv/core @gluv/react zod

# Using yarn
yarn add @gluv/core @gluv/react zod
```

### Basic Usage

```typescript
import { createGluv } from '@gluv/core'
import { GluvProvider, useChatInterface } from '@gluv/react'
import { z } from 'zod'

// Create a Gluv instance with capabilities
const gluv = createGluv()
  // 🤜 Fold: Agent-invokable action
  .fold({
    name: 'addToCart',
    description: 'Add a product to the shopping cart',
    type: 'action-constructive',
    paramsSchema: z.object({
      productId: z.string(),
      quantity: z.number().int().positive().default(1),
    }),
    resultSchema: z.object({
      success: z.boolean(),
      cartItemId: z.string(),
    }),
    do: async (ctx, params) => {
      // Your implementation
      const result = await ctx.db.execute(
        'INSERT INTO cart (product_id, qty) VALUES (?, ?)',
        [params.productId, params.quantity]
      )
      return {
        status: 'success',
        data: { success: true, cartItemId: result.id },
      }
    },
    // Optional: undo support
    captureUndoData: async (ctx, params) => {
      return { wasNewItem: true }
    },
    undo: async (ctx, snapshot) => {
      await ctx.db.execute(
        'DELETE FROM cart WHERE product_id = ?',
        [snapshot.params.productId]
      )
      return { success: true }
    },
  })
  // Destructive actions require confirmation by default
  .fold({
    name: 'removeFromCart',
    description: 'Remove an item from the cart',
    type: 'action-destructive',
    requireConfirm: true, // Set automatically for destructive actions
    paramsSchema: z.object({ productId: z.string() }),
    resultSchema: z.object({ success: z.boolean() }),
    do: async (ctx, params) => {
      await ctx.db.execute('DELETE FROM cart WHERE product_id = ?', [params.productId])
      return { status: 'success', data: { success: true } }
    },
  })
  // 🫴 Unfold: User input collection with custom UI
  .unfold({
    name: 'collectPaymentMethod',
    description: 'Collect payment information from user',
    type: 'ui-collect',
    visibility: {
      llmCanSeeData: false,  // Card data hidden from LLM
      llmFeedback: 'summary', // LLM only sees "Card ending in 4242"
      redactedFields: ['cardNumber', 'cvv'],
    },
    paramsSchema: z.object({ amount: z.number() }),
    resultSchema: z.object({ success: z.boolean(), lastFour: z.string() }),
    ui: (form, ctx) => (
      <PaymentForm form={form} amount={ctx.services.get('amount')} />
    ),
    do: async (ctx, values) => {
      const token = await ctx.services.get('stripe').createToken(values)
      return {
        status: 'success',
        data: { success: true, lastFour: values.cardNumber.slice(-4) },
      }
    },
  })

// Use in React
function App() {
  return (
    <GluvProvider gluv={gluv}>
      <ChatInterface />
    </GluvProvider>
  )
}

function ChatInterface() {
  const { messages, sendMessage, isProcessing } = useChatInterface({
    planGenerator: async (input) => {
      // Call your LLM to generate a plan
      return await generatePlanWithLLM(input)
    },
  })

  return (
    <div>
      {messages.map(msg => <Message key={msg.id} {...msg} />)}
      <Input onSend={sendMessage} disabled={isProcessing} />
    </div>
  )
}
```

## Action Types

### Fold Actions

| Type | Description | Default Confirm |
|------|-------------|-----------------|
| `action-constructive` | Creates new data/state (add to cart, create post) | No |
| `action-destructive` | Removes or modifies data (delete, clear) | Yes |
| `action-idempotent` | Safe to repeat, no lasting effect (search, fetch) | No |

### Unfold Types

| Type | Description |
|------|-------------|
| `ui-collect` | Collect structured data from user (forms) |
| `ui-display` | Display information, optional acknowledgment |

## Core Concepts

### The Gluv Loop

1. **User Request** → Natural language input
2. **Plan Generation** → LLM creates action plan with dependencies
3. **Confirmation** → User confirms destructive/high-risk actions
4. **Execution** → DAG-based parallel/sequential execution
5. **Undo Stack** → Actions pushed to reversibility stack
6. **UI Render** → Results displayed in chat interface

### Capability Registration

```typescript
// Fluent API for registering capabilities
const gluv = createGluv()
  .fold({ name: 'action1', ... })
  .fold({ name: 'action2', ... })
  .unfold({ name: 'form1', ... })
```

### Context System

Actions receive a context with dependency injection:

```typescript
interface GluvContext {
  auth: AuthInfo           // User info, roles, permissions
  db: DatabaseAdapter      // Database access
  services: ServiceContainer // External services
  getActionResult<T>(id)   // Access previous action results
  emit(event, data)        // Real-time UI updates
  audit(action, details)   // Audit logging
}
```

### Undo System

```typescript
.fold({
  name: 'updateQuantity',
  type: 'action-constructive',
  // Capture state before action
  captureUndoData: async (ctx, params) => {
    const current = await ctx.db.query('SELECT qty FROM cart WHERE id = ?', [params.id])
    return { previousQuantity: current[0].qty }
  },
  // Execute action
  do: async (ctx, params) => {
    await ctx.db.execute('UPDATE cart SET qty = ? WHERE id = ?', [params.quantity, params.id])
    return { status: 'success', data: { updated: true } }
  },
  // Reverse the action
  undo: async (ctx, snapshot) => {
    await ctx.db.execute(
      'UPDATE cart SET qty = ? WHERE id = ?',
      [snapshot.undoData.previousQuantity, snapshot.params.id]
    )
    return { success: true }
  },
})
```

## React Hooks

### useGluv

Main hook for accessing Gluv functionality:

```typescript
const { gluv, isProcessing, error, history, currentPlan } = useGluv()
```

### useAction

Execute a specific capability:

```typescript
const { execute, isExecuting, result, error, reset } = useAction('addToCart')

// Usage
await execute({ productId: '123', quantity: 2 })
```

### useChatInterface

Full chat interface state management:

```typescript
const {
  messages,
  sendMessage,
  pendingConfirmations,
  confirmAction,
  rejectAction,
  undo,
  isProcessing,
} = useChatInterface({ planGenerator })
```

### useUnfoldForm

Form handling for unfold capabilities:

```typescript
const { form, submit, isSubmitting, ui } = useUnfoldForm({
  capabilityName: 'collectPaymentMethod',
  onSuccess: () => navigate('/success'),
})
```

### useUndo

Undo functionality:

```typescript
const { canUndo, undoCount, undo, undoMany, undoStack } = useUndo()
```

### useCapabilities

Query registered capabilities:

```typescript
const { capabilities, folds, unfolds, getByTags } = useCapabilities()
```

## AI Provider Adapters

### OpenAI

```typescript
import { createOpenAIAdapter } from '@gluv/adapters/openai'

const adapter = createOpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-turbo-preview',
})

const plan = await adapter.generatePlan({
  userMessage: 'Add the blue widget to my cart',
  capabilities: gluv.getCapabilities(),
})
```

### Anthropic

```typescript
import { createAnthropicAdapter } from '@gluv/adapters/anthropic'

const adapter = createAnthropicAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229',
})
```

### Vercel AI SDK

```typescript
import { createVercelAIAdapter } from '@gluv/adapters/vercel-ai'
import { openai } from '@ai-sdk/openai'

const adapter = createVercelAIAdapter({
  model: openai('gpt-4-turbo'),
})
```

## Effect Integration

Use Effect for functional programming patterns:

```typescript
import { effectFold, succeed, fail, withContext } from '@gluv/core/effect'

const definition = effectFold({
  name: 'fetchUserData',
  type: 'action-idempotent',
  paramsSchema: z.object({ userId: z.string() }),
  resultSchema: z.object({ user: UserSchema }),
  do: (params) =>
    pipe(
      withContext((ctx) => ctx.db.query('SELECT * FROM users WHERE id = ?', [params.userId])),
      Effect.flatMap((users) =>
        users.length > 0
          ? succeed({ user: users[0] })
          : fail('USER_NOT_FOUND', 'User not found')
      )
    ),
})

// Convert to regular fold
gluv.fold(definition)
```

## Examples

See the `/examples` directory for complete examples:

- **nextjs-ecommerce**: E-commerce app with cart, wishlist, coupons

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT

---

Built with ❤️ by the Gluv team
