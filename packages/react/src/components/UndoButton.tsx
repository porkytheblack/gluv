import React from 'react'
import { useUndo } from '../hooks/useUndo'

export interface UndoButtonProps {
  /** Button label */
  label?: string

  /** Loading label */
  loadingLabel?: string

  /** Show undo count badge */
  showCount?: boolean

  /** CSS class */
  className?: string

  /** Custom render function */
  children?: (props: {
    canUndo: boolean
    undoCount: number
    isUndoing: boolean
    undo: () => Promise<void>
  }) => React.ReactNode
}

/**
 * Pre-built undo button component.
 *
 * @example
 * ```tsx
 * function Toolbar() {
 *   return (
 *     <div className="flex gap-2">
 *       <UndoButton showCount />
 *     </div>
 *   )
 * }
 * ```
 */
export function UndoButton({
  label = 'Undo',
  loadingLabel = 'Undoing...',
  showCount = false,
  className = '',
  children,
}: UndoButtonProps): JSX.Element {
  const { canUndo, undoCount, isUndoing, undo } = useUndo()

  if (children) {
    return <>{children({ canUndo, undoCount, isUndoing, undo })}</>
  }

  return (
    <button
      onClick={undo}
      disabled={!canUndo || isUndoing}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-4 h-4"
      >
        <path
          fillRule="evenodd"
          d="M9.53 2.47a.75.75 0 010 1.06L4.81 8.25H15a6.75 6.75 0 010 13.5h-3a.75.75 0 010-1.5h3a5.25 5.25 0 100-10.5H4.81l4.72 4.72a.75.75 0 11-1.06 1.06l-6-6a.75.75 0 010-1.06l6-6a.75.75 0 011.06 0z"
          clipRule="evenodd"
        />
      </svg>
      <span>{isUndoing ? loadingLabel : label}</span>
      {showCount && undoCount > 0 && (
        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-gray-200 rounded-full">
          {undoCount}
        </span>
      )}
    </button>
  )
}

/**
 * Undo history list component.
 */
export function UndoHistory({
  className = '',
  maxItems = 10,
}: {
  className?: string
  maxItems?: number
}): JSX.Element {
  const { undoStack, undoMany, isUndoing } = useUndo()

  const displayedItems = undoStack.slice(-maxItems).reverse()

  if (displayedItems.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No actions to undo
      </div>
    )
  }

  return (
    <div className={className}>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Undo History</h4>
      <ul className="space-y-1">
        {displayedItems.map((item, index) => (
          <li
            key={`${item.actionName}-${item.timestamp}`}
            className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
          >
            <div>
              <span className="font-medium">{item.title}</span>
              <span className="text-gray-500 text-xs ml-2">
                {new Date(item.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <button
              onClick={() => undoMany(index + 1)}
              disabled={isUndoing}
              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
            >
              Undo to here
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
