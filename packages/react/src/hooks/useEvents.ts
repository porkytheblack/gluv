import { useEffect, useCallback, useRef } from 'react'
import type { GluvEvent, GluvEventType } from '@gluv/core'
import { useGluvContext } from '../context'

export type GluvEventCallback<T = unknown> = (event: GluvEvent<T>) => void

/**
 * Hook for subscribing to Gluv events.
 *
 * @example
 * ```tsx
 * function ActionNotifications() {
 *   useGluvEvent('action:completed', (event) => {
 *     toast.success(`Completed: ${event.data?.action.title}`)
 *   })
 *
 *   useGluvEvent('action:failed', (event) => {
 *     toast.error(`Failed: ${event.data?.action.title}`)
 *   })
 *
 *   return null
 * }
 * ```
 */
export function useGluvEvent<T = unknown>(
  eventType: GluvEventType | '*',
  callback: GluvEventCallback<T>
): void {
  const { gluv } = useGluvContext()
  const callbackRef = useRef(callback)

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const handler = (event: GluvEvent<T>) => {
      callbackRef.current(event)
    }

    return gluv.on(eventType, handler)
  }, [gluv, eventType])
}

/**
 * Hook for subscribing to multiple Gluv events.
 *
 * @example
 * ```tsx
 * function ActionLogger() {
 *   useGluvEvents({
 *     'action:started': (event) => console.log('Started:', event.actionId),
 *     'action:completed': (event) => console.log('Completed:', event.actionId),
 *     'action:failed': (event) => console.log('Failed:', event.actionId),
 *   })
 *
 *   return null
 * }
 * ```
 */
export function useGluvEvents(
  handlers: Partial<Record<GluvEventType | '*', GluvEventCallback>>
): void {
  const { gluv } = useGluvContext()
  const handlersRef = useRef(handlers)

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    const unsubscribes: Array<() => void> = []

    for (const [eventType, handler] of Object.entries(handlersRef.current)) {
      if (handler) {
        const wrappedHandler = (event: GluvEvent) => {
          handlersRef.current[eventType as GluvEventType]?.(event)
        }
        unsubscribes.push(gluv.on(eventType, wrappedHandler))
      }
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
  }, [gluv, Object.keys(handlers).join(',')])
}

/**
 * Hook for emitting events (useful for testing or custom integrations).
 */
export function useEmitEvent(): (event: string, data?: unknown) => void {
  const { gluv } = useGluvContext()

  return useCallback(
    (event: string, data?: unknown) => {
      // Access the internal event emitter
      // Note: This is a simplified approach; actual implementation might need adjustment
      const context = gluv as unknown as { events?: { emit: (type: string, data?: unknown) => void } }
      context.events?.emit(event, data)
    },
    [gluv]
  )
}
