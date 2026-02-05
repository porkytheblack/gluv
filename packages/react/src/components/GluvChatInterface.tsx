import React, { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import type { GluvAction, ConfirmationRequest } from '@gluv/core'
import { GluvProvider } from '../context'
import { useChatInterface } from '../hooks/useChatInterface'
import type {
  GluvChatInterfaceProps,
  ChatMessage,
  PlanGenerator,
} from '../types'

// ============================================================================
// Default Renderers
// ============================================================================

function DefaultMessageRenderer({ message }: { message: ChatMessage }) {
  const roleStyles: Record<string, string> = {
    user: 'bg-blue-100 ml-auto',
    assistant: 'bg-gray-100',
    system: 'bg-yellow-50 text-center text-sm',
  }

  return (
    <div
      className={`max-w-[80%] p-3 rounded-lg mb-2 ${roleStyles[message.role] ?? ''}`}
    >
      <div className="text-sm font-medium mb-1 capitalize">{message.role}</div>
      <div className="whitespace-pre-wrap">{message.content}</div>
      {message.status === 'error' && (
        <div className="text-red-500 text-sm mt-1">
          Error: {message.error?.message}
        </div>
      )}
      {message.uiComponents?.map((ui, i) => (
        <div key={i} className="mt-2">
          {ui}
        </div>
      ))}
    </div>
  )
}

function DefaultActionCard({ action }: { action: GluvAction }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-gray-200',
    executing: 'bg-blue-200 animate-pulse',
    completed: 'bg-green-200',
    failed: 'bg-red-200',
    cancelled: 'bg-yellow-200',
    undone: 'bg-orange-200',
  }

  return (
    <div className={`p-2 rounded border ${statusColors[action.status] ?? 'bg-gray-100'}`}>
      <div className="font-medium">{action.title}</div>
      <div className="text-sm text-gray-600">{action.description}</div>
      <div className="text-xs text-gray-500 mt-1">
        Status: {action.status}
      </div>
    </div>
  )
}

function DefaultConfirmationDialog({
  request,
  onRespond,
}: {
  request: ConfirmationRequest
  onRespond: (approved: boolean) => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md">
        <h3 className="text-lg font-semibold mb-4">Confirm Actions</h3>
        <p className="mb-4">The following actions require your confirmation:</p>
        <ul className="list-disc pl-5 mb-4">
          {request.actions.map((action) => (
            <li key={action.id} className="mb-1">
              <strong>{action.title}</strong>: {action.description}
            </li>
          ))}
        </ul>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onRespond(false)}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onRespond(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component (Inner)
// ============================================================================

interface ChatInterfaceInnerProps extends Omit<GluvChatInterfaceProps, 'gluv'> {
  planGenerator: PlanGenerator
}

function ChatInterfaceInner({
  planGenerator,
  placeholder = 'Type a message...',
  header,
  footer,
  onMessageSent,
  onActionComplete,
  renderActionCard = (action) => <DefaultActionCard action={action} />,
  renderMessage = (message) => <DefaultMessageRenderer message={message} />,
  renderConfirmation,
  className = '',
  initialMessages = [],
}: ChatInterfaceInnerProps) {
  const {
    messages,
    pendingConfirmations,
    executingActions,
    sendMessage,
    confirmAction,
    rejectAction,
    isProcessing,
    error,
  } = useChatInterface({
    planGenerator,
    initialMessages,
    onMessageSent,
    onActionComplete,
  })

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle form submission
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isProcessing) {
      sendMessage(input.trim())
      setInput('')
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      {header && <div className="border-b p-4">{header}</div>}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id}>{renderMessage(message)}</div>
        ))}

        {/* Executing actions */}
        {executingActions.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-gray-500 mb-2">Executing:</div>
            <div className="space-y-2">
              {executingActions.map((action) => (
                <div key={action.id}>{renderActionCard(action)}</div>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-100 text-red-700 text-sm">
          {error.message}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isProcessing}
            className="flex-1 resize-none border rounded-lg p-2 min-h-[44px] max-h-32"
            rows={1}
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>

      {/* Footer */}
      {footer && <div className="border-t p-4">{footer}</div>}

      {/* Confirmation dialogs */}
      {pendingConfirmations.map((request) =>
        renderConfirmation ? (
          <div key={request.planId}>
            {renderConfirmation(request, (approved) =>
              approved ? confirmAction(request.planId) : rejectAction(request.planId)
            )}
          </div>
        ) : (
          <DefaultConfirmationDialog
            key={request.planId}
            request={request}
            onRespond={(approved) =>
              approved ? confirmAction(request.planId) : rejectAction(request.planId)
            }
          />
        )
      )}
    </div>
  )
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Complete chat interface component for Gluv.
 *
 * @example
 * ```tsx
 * import { createGluv } from '@gluv/core'
 * import { GluvChatInterface } from '@gluv/react'
 *
 * const gluv = createGluv()
 *   .fold({ ... })
 *   .unfold({ ... })
 *
 * function App() {
 *   return (
 *     <GluvChatInterface
 *       gluv={gluv}
 *       planGenerator={async (input) => {
 *         // Call your LLM API here to generate a plan
 *         const response = await fetch('/api/chat', {
 *           method: 'POST',
 *           body: JSON.stringify(input),
 *         })
 *         return response.json()
 *       }}
 *     />
 *   )
 * }
 * ```
 */
export function GluvChatInterface({
  gluv,
  ...props
}: GluvChatInterfaceProps): JSX.Element {
  return (
    <GluvProvider gluv={gluv}>
      <ChatInterfaceInner {...props} />
    </GluvProvider>
  )
}
