/**
 * @gluv/react/hooks - React hooks for Gluv Framework
 */

// Core hook
export { useGluv, type UseGluvResult } from './useGluv'

// Action execution
export { useAction, type UseActionResult, type UseActionOptions } from './useAction'
export {
  useActionMutation,
  useActionQuery,
  useCapabilitiesQuery,
  useHistoryQuery,
  type UseActionMutationOptions,
  type UseActionQueryOptions,
} from './useActionQuery'

// Chat interface
export {
  useChatInterface,
  type UseChatInterfaceOptions,
  type UseChatInterfaceResult,
} from './useChatInterface'

// Unfold forms
export {
  useUnfoldForm,
  useUnfoldUI,
  type UseUnfoldFormOptions,
  type UseUnfoldFormResult,
} from './useUnfoldForm'

// Capabilities
export {
  useCapabilities,
  useCapability,
  type UseCapabilitiesResult,
} from './useCapabilities'

// Undo
export { useUndo, type UseUndoResult, type UndoStackItem } from './useUndo'

// Events
export {
  useGluvEvent,
  useGluvEvents,
  useEmitEvent,
  type GluvEventCallback,
} from './useEvents'
