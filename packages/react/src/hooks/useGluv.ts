import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Gluv, ActionPlan, GluvEvent } from '@gluv/core'
import { useGluvContext } from '../context'

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

/**
 * Main hook for accessing Gluv functionality.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { gluv, isProcessing, history, error, clearError } = useGluv()
 *
 *   const handleAction = async () => {
 *     await gluv.executeAction('addToCart', { productId: '123' })
 *   }
 *
 *   return (
 *     <div>
 *       {isProcessing && <Spinner />}
 *       {error && <ErrorMessage error={error} onDismiss={clearError} />}
 *       <button onClick={handleAction}>Add to Cart</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useGluv(): UseGluvResult {
  const { gluv } = useGluvContext()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [currentPlan, setCurrentPlan] = useState<ActionPlan | null>(null)
  const [history, setHistory] = useState<ActionPlan[]>(() => gluv.getHistory())

  useEffect(() => {
    // Subscribe to events
    const unsubscribes: Array<() => void> = []

    unsubscribes.push(
      gluv.on('plan:started', (event: GluvEvent<ActionPlan>) => {
        setIsProcessing(true)
        setCurrentPlan(event.data ?? null)
        setError(null)
      })
    )

    unsubscribes.push(
      gluv.on('plan:completed', (event: GluvEvent<ActionPlan>) => {
        setIsProcessing(false)
        setCurrentPlan(null)
        setHistory(gluv.getHistory())
      })
    )

    unsubscribes.push(
      gluv.on('plan:failed', (event: GluvEvent<{ plan: ActionPlan; error?: Error }>) => {
        setIsProcessing(false)
        setCurrentPlan(null)
        if (event.data?.error) {
          setError(event.data.error)
        }
        setHistory(gluv.getHistory())
      })
    )

    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
  }, [gluv])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return useMemo(
    () => ({
      gluv,
      isProcessing,
      error,
      clearError,
      history,
      currentPlan,
    }),
    [gluv, isProcessing, error, clearError, history, currentPlan]
  )
}
