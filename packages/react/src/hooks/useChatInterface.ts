import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { nanoid } from 'nanoid'
import type { ActionPlan, GluvAction, GluvEvent, ConfirmationRequest } from '@gluv/core'
import { useGluvContext } from '../context'
import type {
  ChatMessage,
  MessageRole,
  MessageStatus,
  PlanGenerator,
  PlanGeneratorInput,
} from '../types'

export interface UseChatInterfaceOptions {
  /** Plan generator function (LLM integration) */
  planGenerator: PlanGenerator

  /** Initial messages */
  initialMessages?: ChatMessage[]

  /** Called when a message is sent */
  onMessageSent?: (message: string) => void

  /** Called when an action completes */
  onActionComplete?: (action: GluvAction) => void

  /** Called when an error occurs */
  onError?: (error: Error) => void

  /** Maximum messages to keep in history */
  maxMessages?: number
}

export interface UseChatInterfaceResult {
  /** Message history */
  messages: ChatMessage[]

  /** Pending actions requiring confirmation */
  pendingConfirmations: ConfirmationRequest[]

  /** Currently executing actions */
  executingActions: GluvAction[]

  /** Send a message */
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

  /** Add a system message */
  addSystemMessage: (content: string) => void
}

/**
 * Hook for building chat interfaces with Gluv.
 *
 * @example
 * ```tsx
 * function ChatInterface() {
 *   const {
 *     messages,
 *     sendMessage,
 *     isProcessing,
 *     pendingConfirmations,
 *     confirmAction,
 *     rejectAction,
 *   } = useChatInterface({
 *     planGenerator: async (input) => {
 *       // Call your LLM API here
 *       return await generatePlan(input)
 *     },
 *   })
 *
 *   return (
 *     <div>
 *       <MessageList messages={messages} />
 *       {pendingConfirmations.map((conf) => (
 *         <ConfirmationDialog
 *           key={conf.planId}
 *           actions={conf.actions}
 *           onConfirm={() => confirmAction(conf.planId)}
 *           onReject={() => rejectAction(conf.planId)}
 *         />
 *       ))}
 *       <MessageInput onSubmit={sendMessage} disabled={isProcessing} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useChatInterface(options: UseChatInterfaceOptions): UseChatInterfaceResult {
  const { gluv } = useGluvContext()
  const {
    planGenerator,
    initialMessages = [],
    onMessageSent,
    onActionComplete,
    onError,
    maxMessages = 100,
  } = options

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [pendingConfirmations, setPendingConfirmations] = useState<ConfirmationRequest[]>([])
  const [executingActions, setExecutingActions] = useState<GluvAction[]>([])

  // Keep track of current plan for updates
  const currentPlanRef = useRef<ActionPlan | null>(null)

  // Create a user message
  const createMessage = useCallback(
    (role: MessageRole, content: string, status: MessageStatus = 'completed'): ChatMessage => ({
      id: nanoid(),
      role,
      content,
      timestamp: Date.now(),
      status,
    }),
    []
  )

  // Add a message to history
  const addMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => {
        const updated = [...prev, message]
        // Trim if over max
        if (updated.length > maxMessages) {
          return updated.slice(-maxMessages)
        }
        return updated
      })
    },
    [maxMessages]
  )

  // Update a message by ID
  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    )
  }, [])

  // Subscribe to Gluv events
  useEffect(() => {
    const unsubscribes: Array<() => void> = []

    unsubscribes.push(
      gluv.on('action:started', (event: GluvEvent<GluvAction>) => {
        if (event.data) {
          setExecutingActions((prev) => [...prev, event.data!])
        }
      })
    )

    unsubscribes.push(
      gluv.on('action:completed', (event: GluvEvent<{ action: GluvAction }>) => {
        if (event.data?.action) {
          setExecutingActions((prev) => prev.filter((a) => a.id !== event.data!.action.id))
          onActionComplete?.(event.data.action)
        }
      })
    )

    unsubscribes.push(
      gluv.on('action:failed', (event: GluvEvent<{ action: GluvAction }>) => {
        if (event.data?.action) {
          setExecutingActions((prev) => prev.filter((a) => a.id !== event.data!.action.id))
        }
      })
    )

    unsubscribes.push(
      gluv.on('confirmation:requested', (event: GluvEvent<{ actions: GluvAction[] }>) => {
        if (event.planId && event.data?.actions) {
          const request: ConfirmationRequest = {
            planId: event.planId,
            actions: event.data.actions,
            resolve: (approved: boolean) => {
              gluv.confirmAction(event.planId!, approved)
            },
          }
          setPendingConfirmations((prev) => [...prev, request])
        }
      })
    )

    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
  }, [gluv, onActionComplete])

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isProcessing) return

      setIsProcessing(true)
      setError(null)

      // Add user message
      const userMessage = createMessage('user', content)
      addMessage(userMessage)
      onMessageSent?.(content)

      // Create assistant message placeholder
      const assistantMessageId = nanoid()
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'pending',
      }
      addMessage(assistantMessage)

      try {
        // Generate plan using provided function
        const capabilities = gluv.getCapabilities()
        const input: PlanGeneratorInput = {
          userMessage: content,
          capabilities,
          history: messages,
        }

        const planOutput = await planGenerator(input)

        // Update assistant message with response
        updateMessage(assistantMessageId, {
          content: planOutput.response,
          status: 'streaming',
        })

        // If there are actions, create and execute plan
        if (planOutput.actions.length > 0) {
          const plan = gluv.createPlan(content, planOutput.reasoning, planOutput.actions)
          currentPlanRef.current = plan

          const result = await gluv.executePlan(plan)

          // Update message with final result
          updateMessage(assistantMessageId, {
            status: 'completed',
            plan: result.plan,
            uiComponents: result.uiComponents as React.ReactNode[],
          })
        } else {
          // No actions, just a conversational response
          updateMessage(assistantMessageId, {
            status: 'completed',
          })
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        onError?.(error)

        updateMessage(assistantMessageId, {
          content: `Sorry, I encountered an error: ${error.message}`,
          status: 'error',
          error,
        })
      } finally {
        setIsProcessing(false)
        currentPlanRef.current = null
      }
    },
    [
      gluv,
      isProcessing,
      messages,
      createMessage,
      addMessage,
      updateMessage,
      planGenerator,
      onMessageSent,
      onError,
    ]
  )

  // Confirm a pending action
  const confirmAction = useCallback(
    async (planId: string) => {
      gluv.confirmAction(planId, true)
      setPendingConfirmations((prev) => prev.filter((c) => c.planId !== planId))
    },
    [gluv]
  )

  // Reject a pending action
  const rejectAction = useCallback(
    async (planId: string) => {
      gluv.confirmAction(planId, false)
      setPendingConfirmations((prev) => prev.filter((c) => c.planId !== planId))
    },
    [gluv]
  )

  // Undo actions
  const undo = useCallback(
    async (count: number = 1) => {
      try {
        const result = await gluv.undo(count)
        if (result.undoneCount > 0) {
          addMessage(
            createMessage('system', `Undone ${result.undoneCount} action(s).`)
          )
        }
        if (result.failures.length > 0) {
          const failureMessages = result.failures
            .map((f) => `${f.actionName}: ${f.reason}`)
            .join(', ')
          addMessage(createMessage('system', `Could not undo: ${failureMessages}`))
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        onError?.(error)
      }
    },
    [gluv, addMessage, createMessage, onError]
  )

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  // Add a system message
  const addSystemMessage = useCallback(
    (content: string) => {
      addMessage(createMessage('system', content))
    },
    [addMessage, createMessage]
  )

  return useMemo(
    () => ({
      messages,
      pendingConfirmations,
      executingActions,
      sendMessage,
      confirmAction,
      rejectAction,
      undo,
      isProcessing,
      error,
      clearMessages,
      addSystemMessage,
    }),
    [
      messages,
      pendingConfirmations,
      executingActions,
      sendMessage,
      confirmAction,
      rejectAction,
      undo,
      isProcessing,
      error,
      clearMessages,
      addSystemMessage,
    ]
  )
}
