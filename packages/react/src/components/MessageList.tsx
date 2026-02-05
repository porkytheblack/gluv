import React, { useRef, useEffect } from 'react'
import type { MessageListProps, ChatMessage } from '../types'

/**
 * Default message bubble component.
 */
function DefaultMessageBubble({ message }: { message: ChatMessage }) {
  const roleStyles: Record<string, string> = {
    user: 'bg-blue-500 text-white ml-auto',
    assistant: 'bg-gray-100 text-gray-900',
    system: 'bg-yellow-50 text-gray-600 text-center text-sm mx-auto',
  }

  const statusIndicator: Record<string, React.ReactNode> = {
    pending: <span className="animate-pulse">...</span>,
    streaming: <span className="animate-pulse">●</span>,
    completed: null,
    error: <span className="text-red-500 text-xs">Error</span>,
  }

  return (
    <div
      className={`max-w-[80%] p-3 rounded-lg ${roleStyles[message.role] ?? ''}`}
    >
      {message.role !== 'system' && (
        <div className="text-xs opacity-70 mb-1 flex items-center gap-2">
          <span className="capitalize">{message.role}</span>
          {statusIndicator[message.status]}
        </div>
      )}
      <div className="whitespace-pre-wrap">{message.content}</div>
      {message.status === 'error' && message.error && (
        <div className="mt-2 p-2 bg-red-100 text-red-700 text-sm rounded">
          {message.error.message}
        </div>
      )}
      {message.uiComponents && message.uiComponents.length > 0 && (
        <div className="mt-3 space-y-2">
          {message.uiComponents.map((ui, index) => (
            <div key={index}>{ui}</div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Scrollable message list component.
 *
 * @example
 * ```tsx
 * function Chat() {
 *   const { messages } = useChatInterface({ ... })
 *
 *   return (
 *     <MessageList
 *       messages={messages}
 *       autoScroll
 *     />
 *   )
 * }
 * ```
 */
export function MessageList({
  messages,
  renderMessage,
  className = '',
  autoScroll = true,
}: MessageListProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, autoScroll])

  const renderer = renderMessage ?? ((msg) => <DefaultMessageBubble message={msg} />)

  return (
    <div ref={containerRef} className={`overflow-y-auto ${className}`}>
      <div className="space-y-3 p-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {renderer(message)}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}

/**
 * Typing indicator component.
 */
export function TypingIndicator({
  className = '',
}: {
  className?: string
}): JSX.Element {
  return (
    <div className={`flex items-center gap-1 p-3 ${className}`}>
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm text-gray-500 ml-2">Thinking...</span>
    </div>
  )
}

/**
 * Message timestamp component.
 */
export function MessageTimestamp({
  timestamp,
  className = '',
}: {
  timestamp: number
  className?: string
}): JSX.Element {
  const date = new Date(timestamp)
  const formatted = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <span className={`text-xs text-gray-400 ${className}`}>{formatted}</span>
  )
}
