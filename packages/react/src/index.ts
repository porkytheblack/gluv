/**
 * @gluv/react - React integration for Gluv Framework
 *
 * Provides React hooks, components, and utilities for building
 * AI-powered applications with Gluv.
 *
 * @example
 * ```tsx
 * import { createGluv } from '@gluv/core'
 * import { GluvProvider, useGluv, useAction, GluvChatInterface } from '@gluv/react'
 * import { z } from 'zod'
 *
 * // Create Gluv instance
 * const gluv = createGluv()
 *   .fold({
 *     name: 'addToCart',
 *     description: 'Add a product to cart',
 *     type: 'action-constructive',
 *     paramsSchema: z.object({ productId: z.string() }),
 *     resultSchema: z.object({ success: z.boolean() }),
 *     do: async (ctx, params) => {
 *       // Implementation
 *       return { status: 'success', data: { success: true } }
 *     },
 *   })
 *
 * // Use in a component
 * function AddToCartButton({ productId }: { productId: string }) {
 *   const { execute, isExecuting } = useAction('addToCart')
 *
 *   return (
 *     <button
 *       onClick={() => execute({ productId })}
 *       disabled={isExecuting}
 *     >
 *       {isExecuting ? 'Adding...' : 'Add to Cart'}
 *     </button>
 *   )
 * }
 *
 * // Wrap with provider
 * function App() {
 *   return (
 *     <GluvProvider gluv={gluv}>
 *       <AddToCartButton productId="123" />
 *     </GluvProvider>
 *   )
 * }
 * ```
 */

// Context and Provider
export { GluvProvider, useGluvContext, useOptionalGluvContext } from './context'

// Hooks
export {
  // Core
  useGluv,
  type UseGluvResult,

  // Actions
  useAction,
  type UseActionResult,
  type UseActionOptions,
  useActionMutation,
  useActionQuery,
  useCapabilitiesQuery,
  useHistoryQuery,
  type UseActionMutationOptions,
  type UseActionQueryOptions,

  // Chat
  useChatInterface,
  type UseChatInterfaceOptions,
  type UseChatInterfaceResult,

  // Forms
  useUnfoldForm,
  useUnfoldUI,
  type UseUnfoldFormOptions,
  type UseUnfoldFormResult,

  // Capabilities
  useCapabilities,
  useCapability,
  type UseCapabilitiesResult,

  // Undo
  useUndo,
  type UseUndoResult,
  type UndoStackItem,

  // Events
  useGluvEvent,
  useGluvEvents,
  useEmitEvent,
  type GluvEventCallback,
} from './hooks'

// Components
export {
  GluvChatInterface,
  ActionCard,
  ActionStatusBadge,
  ConfirmationDialog,
  InlineConfirmation,
  MessageList,
  TypingIndicator,
  MessageTimestamp,
  MessageInput,
  SimpleMessageInput,
  UndoButton,
  UndoHistory,
} from './components'

// Types
export type {
  ChatMessage,
  MessageRole,
  MessageStatus,
  CapabilityInfo,
  GluvChatInterfaceProps,
  ActionCardProps,
  ConfirmationDialogProps,
  MessageListProps,
  MessageInputProps,
  UnfoldFormProps,
  UnfoldRendererProps,
  PlanGenerator,
  PlanGeneratorInput,
  PlanGeneratorOutput,
} from './types'
