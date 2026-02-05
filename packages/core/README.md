# @gluv/core

Core runtime for the Gluv Framework - an agentic framework for building AI-powered applications.

## Installation

```bash
pnpm add @gluv/core zod
```

## Quick Start

```typescript
import { createGluv } from '@gluv/core'
import { z } from 'zod'

const gluv = createGluv()
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
      // Implementation
      return { status: 'success', data: { success: true, cartItemId: '123' } }
    },
  })
```

## API Reference

### createGluv(config?)

Create a new Gluv instance.

```typescript
const gluv = createGluv({
  id: 'my-app',
  context: {
    auth: { userId: 'user_123', sessionId: 'sess_456', roles: ['user'], permissions: [] },
  },
  coordinator: {
    maxParallelActions: 10,
    actionTimeoutMs: 30000,
  },
})
```

### gluv.fold(definition)

Register an agent-invokable action.

```typescript
gluv.fold({
  name: 'myAction',
  description: 'Description for LLM',
  type: 'action-constructive' | 'action-destructive' | 'action-idempotent',
  paramsSchema: z.object({ ... }),
  resultSchema: z.object({ ... }),
  requireConfirm: boolean,    // Optional, defaults based on type
  tags: ['tag1', 'tag2'],     // Optional
  llmVisible: true,           // Optional, default true
  permissions: { ... },       // Optional
  do: async (ctx, params) => { ... },
  captureUndoData: async (ctx, params) => { ... },  // Optional
  undo: async (ctx, snapshot) => { ... },           // Optional
})
```

### gluv.unfold(definition)

Register a user-input collection capability.

```typescript
gluv.unfold({
  name: 'collectInput',
  description: 'Collect user input',
  type: 'ui-collect' | 'ui-display',
  visibility: {
    llmCanSeeData: false,
    llmFeedback: 'success-only' | 'summary' | 'none',
    redactedFields: ['sensitive'],
  },
  paramsSchema: z.object({ ... }),
  resultSchema: z.object({ ... }),
  ui: (form, ctx) => <MyForm form={form} />,
  do: async (ctx, values) => { ... },
  validate: (values) => { ... },  // Optional
  undo: async (ctx, snapshot) => { ... },  // Optional
})
```

### gluv.createPlan(userRequest, reasoning, actions)

Create an action plan.

```typescript
const plan = gluv.createPlan(
  'Add blue widget to cart',
  'User wants to add a product',
  [
    {
      title: 'Add to Cart',
      description: 'Adding blue widget',
      capabilityName: 'addToCart',
      params: { productId: 'widget-blue', quantity: 1 },
      blockedBy: [],
    },
  ]
)
```

### gluv.executePlan(plan)

Execute an action plan.

```typescript
const result = await gluv.executePlan(plan)
// result.plan - The executed plan with updated statuses
// result.response - Summary response
// result.uiComponents - UI components from completed actions
```

### gluv.executeAction(capabilityName, params)

Execute a single action immediately.

```typescript
const result = await gluv.executeAction('addToCart', { productId: '123', quantity: 1 })
```

### gluv.undo(count?)

Undo the last N actions.

```typescript
const result = await gluv.undo(1)
// result.undoneCount - Number of actions undone
// result.failures - Actions that couldn't be undone
```

### gluv.getCapabilities()

Get all registered capabilities.

```typescript
const capabilities = gluv.getCapabilities()
// [{ name, description, kind, type, tags, requireConfirm, llmVisible }]
```

### gluv.getToolSchemas()

Get LLM tool schemas for all visible capabilities.

```typescript
const tools = gluv.getToolSchemas()
// [{ name, description, parameters: { type, properties, required } }]
```

### gluv.on(event, handler)

Subscribe to events.

```typescript
const unsubscribe = gluv.on('action:completed', (event) => {
  console.log('Action completed:', event.actionId)
})

// Later: unsubscribe()
```

## Context

Actions receive a context object with:

```typescript
interface GluvContext {
  auth: {
    userId: string
    sessionId: string
    roles: string[]
    permissions: string[]
  }
  db: {
    query<T>(sql, params?): Promise<T[]>
    execute(sql, params?): Promise<{ affectedRows: number }>
    transaction<T>(fn): Promise<T>
  }
  services: {
    get<T>(name): T
    has(name): boolean
    register<T>(name, service): void
  }
  currentPlan?: { id, userRequest, status }
  currentAction?: { id, sequence, title, capabilityName, status }
  getActionResult<T>(actionId): T
  emit(event, data): void
  audit(action, details): void
}
```

## Effect Integration

For functional programming patterns:

```typescript
import { effectFold, succeed, fail, withContext } from '@gluv/core/effect'

const definition = effectFold({
  name: 'fetchData',
  type: 'action-idempotent',
  paramsSchema: z.object({ id: z.string() }),
  resultSchema: z.object({ data: z.any() }),
  do: (params) =>
    pipe(
      withContext((ctx) => ctx.db.query('SELECT * FROM data WHERE id = ?', [params.id])),
      Effect.flatMap((rows) =>
        rows.length > 0
          ? succeed({ data: rows[0] })
          : fail('NOT_FOUND', 'Data not found')
      )
    ),
})

gluv.fold(definition)
```

## Errors

```typescript
import {
  GluvError,
  ValidationError,
  CapabilityNotFoundError,
  ExecutionError,
  UndoError,
  CyclicDependencyError,
  PermissionDeniedError,
  isGluvError,
} from '@gluv/core'
```

## License

MIT
