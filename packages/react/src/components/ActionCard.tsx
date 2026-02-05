import React, { useState } from 'react'
import type { GluvAction } from '@gluv/core'
import type { ActionCardProps } from '../types'

/**
 * Display component for an action within a plan.
 *
 * @example
 * ```tsx
 * function ActionList({ actions }: { actions: GluvAction[] }) {
 *   return (
 *     <div>
 *       {actions.map((action) => (
 *         <ActionCard
 *           key={action.id}
 *           action={action}
 *           showDetails
 *         />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function ActionCard({
  action,
  showDetails = false,
  expanded: controlledExpanded,
  onToggle,
  className = '',
}: ActionCardProps): JSX.Element {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = controlledExpanded ?? internalExpanded

  const handleToggle = () => {
    if (onToggle) {
      onToggle()
    } else {
      setInternalExpanded(!internalExpanded)
    }
  }

  const statusConfig: Record<
    string,
    { bg: string; text: string; icon: string }
  > = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '⏳' },
    blocked: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '🚫' },
    executing: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '⚡' },
    completed: { bg: 'bg-green-100', text: 'text-green-700', icon: '✓' },
    failed: { bg: 'bg-red-100', text: 'text-red-700', icon: '✗' },
    undone: { bg: 'bg-orange-100', text: 'text-orange-700', icon: '↩' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', icon: '⊘' },
  }

  const config = statusConfig[action.status] ?? statusConfig.pending

  return (
    <div
      className={`border rounded-lg overflow-hidden ${config.bg} ${className}`}
    >
      {/* Header */}
      <div
        className={`p-3 flex items-center gap-2 cursor-pointer ${showDetails ? 'hover:bg-black/5' : ''}`}
        onClick={showDetails ? handleToggle : undefined}
      >
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1">
          <div className={`font-medium ${config.text}`}>{action.title}</div>
          <div className="text-sm text-gray-600">{action.capabilityName}</div>
        </div>
        <div
          className={`text-xs px-2 py-1 rounded-full ${config.bg} ${config.text} border`}
        >
          {action.status}
        </div>
        {showDetails && (
          <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
        )}
      </div>

      {/* Expanded details */}
      {showDetails && expanded && (
        <div className="border-t p-3 bg-white/50">
          <div className="space-y-2">
            <div>
              <div className="text-xs text-gray-500 uppercase">Description</div>
              <div className="text-sm">{action.description}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500 uppercase">Parameters</div>
              <pre className="text-xs bg-black/5 p-2 rounded overflow-auto">
                {JSON.stringify(action.params, null, 2)}
              </pre>
            </div>

            {action.blockedBy.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase">Blocked By</div>
                <div className="text-sm">{action.blockedBy.join(', ')}</div>
              </div>
            )}

            {action.result && (
              <div>
                <div className="text-xs text-gray-500 uppercase">Result</div>
                <pre className="text-xs bg-black/5 p-2 rounded overflow-auto">
                  {JSON.stringify(action.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result UI */}
      {action.result?.ui && (
        <div className="border-t p-3">{action.result.ui as React.ReactNode}</div>
      )}
    </div>
  )
}

/**
 * Compact action status indicator.
 */
export function ActionStatusBadge({
  status,
  className = '',
}: {
  status: GluvAction['status']
  className?: string
}): JSX.Element {
  const config: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'bg-gray-200', text: 'text-gray-700' },
    blocked: { bg: 'bg-yellow-200', text: 'text-yellow-800' },
    executing: { bg: 'bg-blue-200', text: 'text-blue-800' },
    completed: { bg: 'bg-green-200', text: 'text-green-800' },
    failed: { bg: 'bg-red-200', text: 'text-red-800' },
    undone: { bg: 'bg-orange-200', text: 'text-orange-800' },
    cancelled: { bg: 'bg-gray-200', text: 'text-gray-500' },
  }

  const { bg, text } = config[status] ?? config.pending

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text} ${className}`}
    >
      {status}
    </span>
  )
}
