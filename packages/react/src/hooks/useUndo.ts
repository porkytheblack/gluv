import { useState, useCallback, useMemo, useEffect } from 'react'
import type { UndoSnapshot } from '@gluv/core'
import { useGluvContext } from '../context'

export interface UndoStackItem {
  actionName: string
  title: string
  timestamp: number
}

export interface UseUndoResult {
  /** Whether undo is available */
  canUndo: boolean

  /** Number of actions that can be undone */
  undoCount: number

  /** The undo stack */
  undoStack: UndoStackItem[]

  /** Undo the last action */
  undo: () => Promise<void>

  /** Undo multiple actions */
  undoMany: (count: number) => Promise<void>

  /** Whether an undo operation is in progress */
  isUndoing: boolean

  /** Last undo error */
  error: Error | null

  /** Clear the error */
  clearError: () => void
}

/**
 * Hook for undo functionality.
 *
 * @example
 * ```tsx
 * function UndoButton() {
 *   const { canUndo, undo, isUndoing, undoStack } = useUndo()
 *
 *   return (
 *     <div>
 *       <button
 *         onClick={undo}
 *         disabled={!canUndo || isUndoing}
 *       >
 *         {isUndoing ? 'Undoing...' : 'Undo'}
 *       </button>
 *
 *       {undoStack.length > 0 && (
 *         <div>
 *           Last action: {undoStack[undoStack.length - 1].title}
 *         </div>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useUndo(): UseUndoResult {
  const { gluv } = useGluvContext()
  const [isUndoing, setIsUndoing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [undoStack, setUndoStack] = useState<UndoStackItem[]>(() => gluv.getUndoStack())

  // Refresh undo stack on action completion
  useEffect(() => {
    const unsubscribes: Array<() => void> = []

    unsubscribes.push(
      gluv.on('action:completed', () => {
        setUndoStack(gluv.getUndoStack())
      })
    )

    unsubscribes.push(
      gluv.on('action:undone', () => {
        setUndoStack(gluv.getUndoStack())
      })
    )

    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
  }, [gluv])

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return

    setIsUndoing(true)
    setError(null)

    try {
      const result = await gluv.undo(1)
      setUndoStack(gluv.getUndoStack())

      if (result.failures.length > 0) {
        setError(new Error(result.failures[0].reason))
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsUndoing(false)
    }
  }, [gluv, undoStack])

  const undoMany = useCallback(
    async (count: number) => {
      if (undoStack.length === 0 || count <= 0) return

      setIsUndoing(true)
      setError(null)

      try {
        const result = await gluv.undo(count)
        setUndoStack(gluv.getUndoStack())

        if (result.failures.length > 0) {
          const messages = result.failures.map((f) => `${f.actionName}: ${f.reason}`).join('; ')
          setError(new Error(messages))
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsUndoing(false)
      }
    },
    [gluv, undoStack]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return useMemo(
    () => ({
      canUndo: undoStack.length > 0,
      undoCount: undoStack.length,
      undoStack,
      undo,
      undoMany,
      isUndoing,
      error,
      clearError,
    }),
    [undoStack, undo, undoMany, isUndoing, error, clearError]
  )
}
