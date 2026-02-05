import type { ReactNode } from 'react'
import type { UseFormReturn, FieldValues } from 'react-hook-form'
import type {
  Gluv,
  GluvContext,
  ActionPlan,
  GluvAction,
  ActionResult,
  GluvEvent,
  ConfirmationRequest,
} from '@gluv/core'

// ============================================================================
// Context Types
// ============================================================================

export interface GluvProviderProps {
  /** Gluv instance to provide */
  gluv: Gluv

  /** Child components */
  children: ReactNode
}

// ============================================================================
// Hook Result Types
// ============================================================================

export interface UseGluvResult {
  /** The Gluv instance */
  gluv: Gluv

  /** Whether a plan is currently being processed */
  isProcessing: boolean

  /** Current error, if any */
  error: Error | null

  /** Clear the current error */
  clearError: () => void

  /** Plan history */
  history: ActionPlan[]

  /** Current plan being executed */
  currentPlan: ActionPlan | null
}

export interface UseChatInterfaceResult {
  /** Message history */
  messages: ChatMessage[]

  /** Pending actions requiring confirmation */
  pendingConfirmations: ConfirmationRequest[]

  /** Currently executing actions */
  executingActions: GluvAction[]

  /** Send a message (triggers plan generation and execution) */
  sendMessage: (content: string) => Promise<void>

  /** Confirm a pending action */
  confirmAction: (planId: string) => Promise<void>

  /** Reject a pending action */
  rejectAction: (planId: string) => Promise<void>

  /** Undo last action(s) */
  undo: (count?: number) => Promise<void>

  /** Current processing state */
  isProcessing: boolean

  /** Current error, if any */
  error: Error | null

  /** Clear messages */
  clearMessages: () => void
}

export interface UseActionResult<TResult = unknown> {
  /** Execute the action */
  execute: (params: Record<string, unknown>) => Promise<ActionResult<TResult>>

  /** Whether the action is currently executing */
  isExecuting: boolean

  /** Last execution result */
  result: ActionResult<TResult> | null

  /** Last error */
  error: Error | null

  /** Reset the state */
  reset: () => void
}

export interface UseCapabilitiesResult {
  /** All registered capabilities */
  capabilities: CapabilityInfo[]

  /** Get capability by name */
  getCapability: (name: string) => CapabilityInfo | undefined

  /** Check if capability exists */
  hasCapability: (name: string) => boolean

  /** Get capabilities by tags */
  getByTags: (tags: string[]) => CapabilityInfo[]
}

export interface CapabilityInfo {
  name: string
  description: string
  kind: 'fold' | 'unfold'
  type: string
  tags?: string[]
  requireConfirm: boolean
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'error'

export interface ChatMessage {
  /** Unique message ID */
  id: string

  /** Message role */
  role: MessageRole

  /** Message content */
  content: string

  /** Message timestamp */
  timestamp: number

  /** Message status */
  status: MessageStatus

  /** Associated plan (if assistant message) */
  plan?: ActionPlan

  /** UI components to render */
  uiComponents?: ReactNode[]

  /** Error if status is error */
  error?: Error
}

// ============================================================================
// Component Props
// ============================================================================

export interface GluvChatInterfaceProps {
  /** The Gluv instance to use */
  gluv: Gluv

  /** Plan generator function (LLM integration) */
  planGenerator: PlanGenerator

  /** Placeholder text for input */
  placeholder?: string

  /** Custom header component */
  header?: ReactNode

  /** Custom footer component */
  footer?: ReactNode

  /** Called when a message is sent */
  onMessageSent?: (message: string) => void

  /** Called when an action completes */
  onActionComplete?: (action: GluvAction) => void

  /** Custom renderer for action cards */
  renderActionCard?: (action: GluvAction) => ReactNode

  /** Custom renderer for messages */
  renderMessage?: (message: ChatMessage) => ReactNode

  /** Custom confirmation dialog */
  renderConfirmation?: (request: ConfirmationRequest, onRespond: (approved: boolean) => void) => ReactNode

  /** CSS class for container */
  className?: string

  /** Initial messages */
  initialMessages?: ChatMessage[]
}

export interface ActionCardProps {
  /** The action to display */
  action: GluvAction

  /** Whether to show details */
  showDetails?: boolean

  /** Whether the card is expanded */
  expanded?: boolean

  /** Toggle expansion */
  onToggle?: () => void

  /** CSS class */
  className?: string
}

export interface ConfirmationDialogProps {
  /** Actions requiring confirmation */
  actions: GluvAction[]

  /** Called when user responds */
  onRespond: (approved: boolean) => void

  /** Dialog title */
  title?: string

  /** Confirm button text */
  confirmText?: string

  /** Cancel button text */
  cancelText?: string

  /** CSS class */
  className?: string
}

export interface MessageListProps {
  /** Messages to display */
  messages: ChatMessage[]

  /** Custom message renderer */
  renderMessage?: (message: ChatMessage) => ReactNode

  /** CSS class */
  className?: string

  /** Scroll to bottom on new messages */
  autoScroll?: boolean
}

export interface MessageInputProps {
  /** Called when message is submitted */
  onSubmit: (content: string) => void

  /** Whether input is disabled */
  disabled?: boolean

  /** Placeholder text */
  placeholder?: string

  /** CSS class */
  className?: string
}

// ============================================================================
// Unfold Form Types
// ============================================================================

export interface UnfoldFormProps<TFormValues extends FieldValues = FieldValues> {
  /** Form instance from react-hook-form */
  form: UseFormReturn<TFormValues>

  /** Context for data access */
  context: Readonly<GluvContext>

  /** Called when form is submitted */
  onSubmit: (values: TFormValues) => void

  /** Called when form is cancelled */
  onCancel?: () => void

  /** Whether the form is submitting */
  isSubmitting?: boolean

  /** CSS class */
  className?: string
}

export interface UnfoldRendererProps {
  /** Capability name */
  capabilityName: string

  /** Initial parameters */
  params: Record<string, unknown>

  /** Called when collection is complete */
  onComplete: (result: ActionResult) => void

  /** Called when collection is cancelled */
  onCancel?: () => void

  /** CSS class */
  className?: string
}

// ============================================================================
// Plan Generator
// ============================================================================

export interface PlanGeneratorInput {
  /** User's message */
  userMessage: string

  /** Available capabilities */
  capabilities: CapabilityInfo[]

  /** Conversation history */
  history?: ChatMessage[]

  /** Additional context */
  context?: Record<string, unknown>
}

export interface PlanGeneratorOutput {
  /** Reasoning for the plan */
  reasoning: string

  /** Response message */
  response: string

  /** Actions to execute */
  actions: Array<{
    title: string
    description: string
    capabilityName: string
    params: Record<string, unknown>
    blockedBy: string[]
  }>
}

export type PlanGenerator = (input: PlanGeneratorInput) => Promise<PlanGeneratorOutput>

// ============================================================================
// Event Types
// ============================================================================

export type GluvEventCallback<T = unknown> = (event: GluvEvent<T>) => void
