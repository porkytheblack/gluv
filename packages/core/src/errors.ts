/**
 * Base error class for all Gluv errors.
 */
export abstract class GluvError extends Error {
  abstract readonly code: string
  abstract readonly recoverable: boolean
  abstract readonly userMessage: string

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace?.(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      recoverable: this.recoverable,
    }
  }
}

/**
 * Schema validation failed.
 */
export class ValidationError extends GluvError {
  readonly code = 'VALIDATION_ERROR'
  readonly recoverable = true
  readonly userMessage: string

  constructor(
    public readonly field: string,
    public readonly constraint: string,
    public readonly value: unknown
  ) {
    super(`Validation failed for ${field}: ${constraint}`)
    this.userMessage = `Invalid ${field}: ${constraint}`
  }
}

/**
 * Capability not found.
 */
export class CapabilityNotFoundError extends GluvError {
  readonly code = 'CAPABILITY_NOT_FOUND'
  readonly recoverable = false
  readonly userMessage = "I don't know how to do that action."

  constructor(public readonly capabilityName: string) {
    super(`Capability "${capabilityName}" not found`)
  }
}

/**
 * User declined confirmation.
 */
export class ConfirmationDeclinedError extends GluvError {
  readonly code = 'CONFIRMATION_DECLINED'
  readonly recoverable = true
  readonly userMessage = 'Action cancelled.'

  constructor(public readonly actionName: string) {
    super(`User declined confirmation for "${actionName}"`)
  }
}

/**
 * Action execution failed.
 */
export class ExecutionError extends GluvError {
  readonly code = 'EXECUTION_ERROR'
  readonly userMessage: string

  constructor(
    public readonly actionName: string,
    public readonly cause: Error,
    public readonly recoverable: boolean = true
  ) {
    super(`Execution of "${actionName}" failed: ${cause.message}`)
    this.userMessage = `Something went wrong while ${actionName}. ${
      recoverable ? 'Please try again.' : 'Please contact support.'
    }`
  }
}

/**
 * Undo operation failed.
 */
export class UndoError extends GluvError {
  readonly code = 'UNDO_ERROR'
  readonly recoverable = false
  readonly userMessage: string

  constructor(
    public readonly actionName: string,
    public readonly reason: string
  ) {
    super(`Cannot undo "${actionName}": ${reason}`)
    this.userMessage = `Unable to undo that action: ${reason}`
  }
}

/**
 * Circular dependency detected in action plan.
 */
export class CyclicDependencyError extends GluvError {
  readonly code = 'CYCLIC_DEPENDENCY'
  readonly recoverable = false
  readonly userMessage = 'I created an invalid plan. Let me try again.'

  constructor(public readonly cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`)
  }
}

/**
 * Permission denied for capability.
 */
export class PermissionDeniedError extends GluvError {
  readonly code = 'PERMISSION_DENIED'
  readonly recoverable = false
  readonly userMessage = "You don't have permission to perform this action."

  constructor(
    public readonly capabilityName: string,
    public readonly reason: string
  ) {
    super(`Permission denied for "${capabilityName}": ${reason}`)
  }
}

/**
 * Context not available.
 */
export class ContextError extends GluvError {
  readonly code = 'CONTEXT_ERROR'
  readonly recoverable = false
  readonly userMessage = 'Internal configuration error.'

  constructor(message: string) {
    super(message)
  }
}

/**
 * Plan generation failed.
 */
export class PlanningError extends GluvError {
  readonly code = 'PLANNING_ERROR'
  readonly recoverable = true
  readonly userMessage = "I couldn't understand how to help with that. Could you rephrase?"

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
  }
}

/**
 * Timeout exceeded.
 */
export class TimeoutError extends GluvError {
  readonly code = 'TIMEOUT_ERROR'
  readonly recoverable = true
  readonly userMessage = 'The operation took too long. Please try again.'

  constructor(
    public readonly operationName: string,
    public readonly timeoutMs: number
  ) {
    super(`Operation "${operationName}" timed out after ${timeoutMs}ms`)
  }
}

/**
 * Type guard for GluvError.
 */
export function isGluvError(error: unknown): error is GluvError {
  return error instanceof GluvError
}

/**
 * Wrap an unknown error as a GluvError.
 */
export function wrapError(error: unknown, actionName: string): GluvError {
  if (isGluvError(error)) {
    return error
  }

  if (error instanceof Error) {
    return new ExecutionError(actionName, error, true)
  }

  return new ExecutionError(actionName, new Error(String(error)), true)
}
