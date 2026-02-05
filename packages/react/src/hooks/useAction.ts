import { useState, useCallback, useMemo } from 'react'
import type { ActionResult } from '@gluv/core'
import { useGluvContext } from '../context'

export interface UseActionOptions {
  /** Called when action succeeds */
  onSuccess?: (result: ActionResult) => void

  /** Called when action fails */
  onError?: (error: Error) => void

  /** Called when action completes (success or failure) */
  onSettled?: (result: ActionResult | null, error: Error | null) => void
}

export interface UseActionResult<TResult = unknown> {
  /** Execute the action */
  execute: (params: Record<string, unknown>) => Promise<ActionResult<TResult>>

  /** Whether the action is currently executing */
  isExecuting: boolean

  /** Whether the action has been executed at least once */
  hasExecuted: boolean

  /** Last execution result */
  result: ActionResult<TResult> | null

  /** Last error */
  error: Error | null

  /** Reset the state */
  reset: () => void
}

/**
 * Hook for executing a specific capability action.
 *
 * @example
 * ```tsx
 * function AddToCartButton({ productId }: { productId: string }) {
 *   const { execute, isExecuting, result, error } = useAction('addToCart', {
 *     onSuccess: () => toast.success('Added to cart!'),
 *     onError: (err) => toast.error(err.message),
 *   })
 *
 *   return (
 *     <button
 *       onClick={() => execute({ productId, quantity: 1 })}
 *       disabled={isExecuting}
 *     >
 *       {isExecuting ? 'Adding...' : 'Add to Cart'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useAction<TResult = unknown>(
  capabilityName: string,
  options: UseActionOptions = {}
): UseActionResult<TResult> {
  const { gluv } = useGluvContext()
  const [isExecuting, setIsExecuting] = useState(false)
  const [hasExecuted, setHasExecuted] = useState(false)
  const [result, setResult] = useState<ActionResult<TResult> | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(
    async (params: Record<string, unknown>): Promise<ActionResult<TResult>> => {
      setIsExecuting(true)
      setError(null)

      try {
        const actionResult = await gluv.executeAction<TResult>(capabilityName, params)
        setResult(actionResult)
        setHasExecuted(true)

        if (actionResult.status === 'success') {
          options.onSuccess?.(actionResult)
        } else if (actionResult.status === 'failure') {
          const err = new Error(actionResult.error?.message ?? 'Action failed')
          setError(err)
          options.onError?.(err)
        }

        options.onSettled?.(actionResult, null)
        return actionResult
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        setHasExecuted(true)
        options.onError?.(error)
        options.onSettled?.(null, error)
        throw error
      } finally {
        setIsExecuting(false)
      }
    },
    [gluv, capabilityName, options]
  )

  const reset = useCallback(() => {
    setIsExecuting(false)
    setHasExecuted(false)
    setResult(null)
    setError(null)
  }, [])

  return useMemo(
    () => ({
      execute,
      isExecuting,
      hasExecuted,
      result,
      error,
      reset,
    }),
    [execute, isExecuting, hasExecuted, result, error, reset]
  )
}

/**
 * Hook for executing an action with TanStack Query integration.
 * Requires @tanstack/react-query to be installed and QueryClientProvider to be set up.
 */
export { useActionQuery } from './useActionQuery'
