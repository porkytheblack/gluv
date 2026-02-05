import React from 'react'
import type { GluvAction } from '@gluv/core'
import type { ConfirmationDialogProps } from '../types'
import { ActionCard } from './ActionCard'

/**
 * Dialog component for action confirmation.
 *
 * @example
 * ```tsx
 * function MyApp() {
 *   const { pendingConfirmations, confirmAction, rejectAction } = useGluv()
 *
 *   return (
 *     <>
 *       {pendingConfirmations.map((request) => (
 *         <ConfirmationDialog
 *           key={request.planId}
 *           actions={request.actions}
 *           onRespond={(approved) =>
 *             approved
 *               ? confirmAction(request.planId)
 *               : rejectAction(request.planId)
 *           }
 *         />
 *       ))}
 *     </>
 *   )
 * }
 * ```
 */
export function ConfirmationDialog({
  actions,
  onRespond,
  title = 'Confirm Actions',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  className = '',
}: ConfirmationDialogProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={() => onRespond(false)}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div
          className={`relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg ${className}`}
        >
          {/* Header */}
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                <span className="text-xl">⚠️</span>
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  {title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    The following action{actions.length > 1 ? 's' : ''} require
                    {actions.length > 1 ? '' : 's'} your confirmation:
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions list */}
          <div className="px-4 sm:px-6 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {actions.map((action) => (
                <ActionCard key={action.id} action={action} />
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
            <button
              type="button"
              onClick={() => onRespond(true)}
              className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:w-auto"
            >
              {confirmText}
            </button>
            <button
              type="button"
              onClick={() => onRespond(false)}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline confirmation component (not a modal).
 */
export function InlineConfirmation({
  actions,
  onRespond,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  className = '',
}: ConfirmationDialogProps): JSX.Element {
  return (
    <div className={`border rounded-lg p-4 bg-yellow-50 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">Confirmation Required</h4>
          <p className="text-sm text-gray-600 mt-1">
            Please confirm the following action{actions.length > 1 ? 's' : ''}:
          </p>

          <div className="mt-3 space-y-2">
            {actions.map((action) => (
              <div
                key={action.id}
                className="text-sm bg-white p-2 rounded border"
              >
                <strong>{action.title}</strong>
                <p className="text-gray-600">{action.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => onRespond(true)}
              className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
            >
              {confirmText}
            </button>
            <button
              onClick={() => onRespond(false)}
              className="px-3 py-1.5 bg-white text-gray-700 text-sm rounded border hover:bg-gray-50"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
