# @gluv/react

React integration for the Gluv Framework - hooks, components, and utilities for building AI-powered UIs.

## Installation

```bash
pnpm add @gluv/core @gluv/react react react-dom react-hook-form @hookform/resolvers zod
```

For TanStack Query integration:
```bash
pnpm add @tanstack/react-query
```

## Quick Start

```tsx
import { createGluv } from '@gluv/core'
import { GluvProvider, useAction, useChatInterface } from '@gluv/react'
import { z } from 'zod'

// Create Gluv instance
const gluv = createGluv()
  .fold({
    name: 'addToCart',
    description: 'Add product to cart',
    type: 'action-constructive',
    paramsSchema: z.object({ productId: z.string() }),
    resultSchema: z.object({ success: z.boolean() }),
    do: async (ctx, params) => ({
      status: 'success',
      data: { success: true },
    }),
  })

// Wrap your app
function App() {
  return (
    <GluvProvider gluv={gluv}>
      <MyComponent />
    </GluvProvider>
  )
}

// Use hooks in components
function AddToCartButton({ productId }) {
  const { execute, isExecuting, result } = useAction('addToCart')

  return (
    <button
      onClick={() => execute({ productId })}
      disabled={isExecuting}
    >
      {isExecuting ? 'Adding...' : 'Add to Cart'}
    </button>
  )
}
```

## Hooks

### useGluv()

Access the Gluv instance and global state.

```tsx
const { gluv, isProcessing, error, clearError, history, currentPlan } = useGluv()
```

### useAction(capabilityName, options?)

Execute a specific capability.

```tsx
const {
  execute,      // (params) => Promise<ActionResult>
  isExecuting,  // boolean
  hasExecuted,  // boolean
  result,       // ActionResult | null
  error,        // Error | null
  reset,        // () => void
} = useAction('addToCart', {
  onSuccess: (result) => toast.success('Added!'),
  onError: (error) => toast.error(error.message),
  onSettled: (result, error) => { ... },
})
```

### useChatInterface(options)

Full chat interface state management.

```tsx
const {
  messages,              // ChatMessage[]
  sendMessage,           // (content: string) => Promise<void>
  pendingConfirmations,  // ConfirmationRequest[]
  executingActions,      // GluvAction[]
  confirmAction,         // (planId: string) => Promise<void>
  rejectAction,          // (planId: string) => Promise<void>
  undo,                  // (count?: number) => Promise<void>
  isProcessing,          // boolean
  error,                 // Error | null
  clearMessages,         // () => void
  addSystemMessage,      // (content: string) => void
} = useChatInterface({
  planGenerator: async (input) => { ... },
  initialMessages: [],
  onMessageSent: (message) => { ... },
  onActionComplete: (action) => { ... },
  onError: (error) => { ... },
  maxMessages: 100,
})
```

### useUnfoldForm(options)

Form handling for unfold capabilities.

```tsx
const {
  form,         // UseFormReturn from react-hook-form
  context,      // Readonly<GluvContext>
  isSubmitting, // boolean
  isSuccess,    // boolean
  result,       // ActionResult | null
  error,        // Error | null
  submit,       // () => Promise<void>
  cancel,       // () => void
  reset,        // () => void
  ui,           // ReactNode - UI from unfold definition
} = useUnfoldForm({
  capabilityName: 'collectPaymentMethod',
  defaultValues: { ... },
  params: { amount: 99.99 },
  onSuccess: (result) => { ... },
  onError: (error) => { ... },
  onCancel: () => { ... },
})
```

### useCapabilities()

Query registered capabilities.

```tsx
const {
  capabilities,     // CapabilityInfo[]
  getCapability,    // (name) => CapabilityInfo | undefined
  hasCapability,    // (name) => boolean
  getByTags,        // (tags) => CapabilityInfo[]
  folds,            // CapabilityInfo[] - fold only
  unfolds,          // CapabilityInfo[] - unfold only
  confirmRequired,  // CapabilityInfo[] - requiring confirmation
} = useCapabilities()
```

### useUndo()

Undo functionality.

```tsx
const {
  canUndo,     // boolean
  undoCount,   // number
  undoStack,   // Array<{ actionName, title, timestamp }>
  undo,        // () => Promise<void>
  undoMany,    // (count) => Promise<void>
  isUndoing,   // boolean
  error,       // Error | null
  clearError,  // () => void
} = useUndo()
```

### useGluvEvent(eventType, callback)

Subscribe to Gluv events.

```tsx
useGluvEvent('action:completed', (event) => {
  console.log('Completed:', event.data.action.title)
})

useGluvEvent('plan:failed', (event) => {
  console.error('Plan failed:', event.data.error)
})
```

## TanStack Query Integration

### useActionMutation(options)

Mutation hook for actions.

```tsx
import { useActionMutation } from '@gluv/react'

const mutation = useActionMutation({
  capabilityName: 'addToCart',
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: ['cart'] })
  },
})

// Usage
mutation.mutate({ productId: '123', quantity: 1 })
```

### useActionQuery(options)

Query hook for idempotent actions.

```tsx
import { useActionQuery } from '@gluv/react'

const { data, isLoading, error } = useActionQuery({
  capabilityName: 'getCart',
  params: {},
  staleTime: 5000,
})
```

## Components

### GluvChatInterface

Complete chat interface component.

```tsx
import { GluvChatInterface } from '@gluv/react'

<GluvChatInterface
  gluv={gluv}
  planGenerator={async (input) => { ... }}
  placeholder="Type a message..."
  header={<Header />}
  footer={<Footer />}
  onMessageSent={(message) => { ... }}
  onActionComplete={(action) => { ... }}
  renderMessage={(message) => <CustomMessage {...message} />}
  renderActionCard={(action) => <CustomActionCard {...action} />}
  renderConfirmation={(request, onRespond) => <CustomDialog {...request} />}
  className="h-full"
  initialMessages={[]}
/>
```

### ActionCard

Display an action.

```tsx
import { ActionCard, ActionStatusBadge } from '@gluv/react'

<ActionCard
  action={action}
  showDetails
  expanded={isExpanded}
  onToggle={() => setExpanded(!isExpanded)}
/>

<ActionStatusBadge status={action.status} />
```

### ConfirmationDialog

Confirmation modal.

```tsx
import { ConfirmationDialog, InlineConfirmation } from '@gluv/react'

<ConfirmationDialog
  actions={pendingActions}
  onRespond={(approved) => { ... }}
  title="Confirm Actions"
  confirmText="Proceed"
  cancelText="Cancel"
/>

<InlineConfirmation
  actions={pendingActions}
  onRespond={(approved) => { ... }}
/>
```

### MessageList

Scrollable message list.

```tsx
import { MessageList, TypingIndicator } from '@gluv/react'

<MessageList
  messages={messages}
  renderMessage={(msg) => <CustomMessage {...msg} />}
  autoScroll
/>

{isProcessing && <TypingIndicator />}
```

### MessageInput

Message input with auto-resize.

```tsx
import { MessageInput, SimpleMessageInput } from '@gluv/react'

<MessageInput
  onSubmit={sendMessage}
  disabled={isProcessing}
  placeholder="Type your message..."
/>

<SimpleMessageInput
  onSubmit={sendMessage}
  disabled={isProcessing}
/>
```

### UndoButton

Pre-built undo button.

```tsx
import { UndoButton, UndoHistory } from '@gluv/react'

<UndoButton showCount />

<UndoHistory maxItems={10} />
```

## Types

```typescript
import type {
  ChatMessage,
  MessageRole,
  MessageStatus,
  PlanGenerator,
  PlanGeneratorInput,
  PlanGeneratorOutput,
  CapabilityInfo,
  GluvChatInterfaceProps,
  ActionCardProps,
  ConfirmationDialogProps,
  MessageListProps,
  MessageInputProps,
} from '@gluv/react'
```

## License

MIT
