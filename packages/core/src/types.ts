import type { z } from 'zod'

// ============================================================================
// Action Types
// ============================================================================

/**
 * Classification of fold action effects for confirmation and undo behavior.
 */
export type FoldActionType =
  | 'action-constructive' // Creates new data/state (e.g., add to cart)
  | 'action-destructive' // Removes or significantly modifies data (e.g., delete)
  | 'action-idempotent' // Safe to repeat, no lasting effect (e.g., fetch)

/**
 * Classification of unfold interaction types.
 */
export type UnfoldType =
  | 'ui-collect' // Collect structured data from user (forms)
  | 'ui-display' // Display information, optional acknowledgment

// ============================================================================
// Result Types
// ============================================================================

/**
 * How the result should be presented in the UI.
 */
export type ResultPresentation = 'inline' | 'card' | 'modal' | 'hidden'

/**
 * Error information for failed actions.
 */
export interface ActionError {
  code: string
  message: string
  recoverable: boolean
  details?: Record<string, unknown>
}

/**
 * Result returned from a fold or unfold execution.
 */
export interface ActionResult<T = unknown> {
  /** The execution status */
  status: 'success' | 'failure' | 'pending-confirmation'

  /** The result data, validated against resultSchema */
  data?: T

  /** Error information if status is 'failure' */
  error?: ActionError

  /** Optional UI component to render in chat (React element or component factory) */
  ui?: unknown

  /** How the result should be presented */
  presentation?: ResultPresentation
}

// ============================================================================
// Undo System
// ============================================================================

/**
 * Snapshot captured before action execution for potential undo.
 */
export interface UndoSnapshot<TUndoData = unknown, TParams = unknown> {
  /** Timestamp of the original action */
  timestamp: number

  /** The action that was performed */
  actionName: string

  /** Parameters passed to the action */
  params: TParams

  /** Custom data needed to reverse this action */
  undoData: TUndoData

  /** Whether this action can actually be undone */
  reversible: boolean

  /** Human-readable description of what undo will do */
  undoDescription?: string
}

/**
 * Result of an undo operation.
 */
export interface UndoResult {
  success: boolean
  error?: string
}

// ============================================================================
// Context System
// ============================================================================

/**
 * Read-only authentication information.
 */
export interface AuthInfo {
  userId: string
  sessionId: string
  roles: string[]
  permissions: string[]
  metadata?: Record<string, unknown>
}

/**
 * Database adapter interface for persistence operations.
 */
export interface DatabaseAdapter {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number }>
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>
}

/**
 * Service container for external integrations.
 */
export interface ServiceContainer {
  get<T>(serviceName: string): T
  has(serviceName: string): boolean
  register<T>(serviceName: string, service: T): void
}

/**
 * Forward declaration for ActionPlan (defined in coordinator).
 */
export interface ActionPlanRef {
  id: string
  userRequest: string
  status: string
}

/**
 * Forward declaration for GluvAction (defined in coordinator).
 */
export interface GluvActionRef {
  id: string
  sequence: number
  title: string
  capabilityName: string
  status: string
}

/**
 * The dependency injection context provided to all actions.
 */
export interface GluvContext {
  /** Current user authentication info */
  auth: AuthInfo

  /** Database adapter for persistence */
  db: DatabaseAdapter

  /** External service container */
  services: ServiceContainer

  /** Current action plan (if executing within one) */
  currentPlan?: Readonly<ActionPlanRef>

  /** Current action (if executing within one) */
  currentAction?: Readonly<GluvActionRef>

  /**
   * Access result from a previous action in the same plan.
   * @param actionId - ID of the completed action
   * @returns The action's result data
   * @throws If action not found or not completed
   */
  getActionResult<T>(actionId: string): T

  /**
   * Emit an event for real-time UI updates.
   * @param event - Event name
   * @param data - Event payload
   */
  emit(event: string, data: unknown): void

  /**
   * Log an audit event (separate from application logs).
   * @param action - Action being audited
   * @param details - Audit details
   */
  audit(action: string, details: Record<string, unknown>): void
}

// ============================================================================
// Visibility Configuration
// ============================================================================

/**
 * Visibility configuration for collected data in unfolds.
 */
export interface DataVisibility {
  /** Whether the LLM can see the raw collected data */
  llmCanSeeData: boolean

  /**
   * If llmCanSeeData is false, what feedback does the LLM get?
   */
  llmFeedback: 'success-only' | 'summary' | 'none'

  /** Fields that should be redacted from logs */
  redactedFields?: string[]
}

// ============================================================================
// Permission Model
// ============================================================================

/**
 * Permission configuration for capabilities.
 */
export interface CapabilityPermission {
  /** Required roles to invoke this capability */
  requiredRoles?: string[]

  /** Required permissions to invoke this capability */
  requiredPermissions?: string[]

  /** Custom authorization function */
  authorize?: (context: GluvContext, params: unknown) => Promise<boolean>
}

// ============================================================================
// Capability Definitions
// ============================================================================

/**
 * Base interface for all capability definitions.
 */
export interface CapabilityBase<TParams extends z.ZodType, TResult extends z.ZodType> {
  /** Unique identifier for this capability. Must be valid identifier syntax. */
  name: string

  /** Human-readable description for LLM context. Should be clear and actionable. */
  description: string

  /** Zod schema for validating input parameters */
  paramsSchema: TParams

  /** Zod schema for validating return value */
  resultSchema: TResult

  /**
   * Whether this action requires explicit user confirmation before execution.
   * Defaults based on action type.
   */
  requireConfirm?: boolean

  /** Optional tags for filtering and organization. */
  tags?: string[]

  /** Whether this capability should be visible to the LLM. Default: true */
  llmVisible?: boolean

  /** Permission configuration */
  permissions?: CapabilityPermission
}

/**
 * A Fold is an agent-invokable action that modifies application state.
 */
export interface FoldDefinition<
  TParams extends z.ZodType,
  TResult extends z.ZodType,
  TUndoData = unknown,
> extends CapabilityBase<TParams, TResult> {
  /** Discriminator for fold vs unfold */
  kind: 'fold'

  /** Classification of this action's effects */
  type: FoldActionType

  /**
   * The action implementation.
   */
  do: (context: GluvContext, params: z.infer<TParams>) => Promise<ActionResult<z.infer<TResult>>>

  /**
   * Optional undo handler. If not provided, action is marked as irreversible.
   */
  undo?: (
    context: GluvContext,
    snapshot: UndoSnapshot<TUndoData, z.infer<TParams>>
  ) => Promise<UndoResult>

  /**
   * Capture data needed for undo before execution.
   */
  captureUndoData?: (context: GluvContext, params: z.infer<TParams>) => Promise<TUndoData>
}

/**
 * An Unfold is a user-interaction primitive that collects input.
 */
export interface UnfoldDefinition<
  TParams extends z.ZodType,
  TResult extends z.ZodType,
  TFormValues = z.infer<TResult>,
> extends CapabilityBase<TParams, TResult> {
  /** Discriminator for fold vs unfold */
  kind: 'unfold'

  /** Classification of this interaction's purpose */
  type: UnfoldType

  /**
   * React component factory for the collection UI.
   * The actual component is framework-specific (React, etc.)
   */
  ui: (form: unknown, context: Readonly<GluvContext>) => unknown

  /** Configuration for how collected data is handled. */
  visibility: DataVisibility

  /**
   * Process the collected data after form submission.
   */
  do: (context: GluvContext, values: TFormValues) => Promise<ActionResult<z.infer<TResult>>>

  /**
   * Optional undo for unfold actions.
   */
  undo?: (context: GluvContext, snapshot: UndoSnapshot) => Promise<UndoResult>

  /**
   * Validation rules beyond schema validation.
   */
  validate?: (values: TFormValues) =>
    | { valid: true }
    | {
        valid: false
        errors: Record<string, string>
      }
}

/**
 * Union type for any capability definition.
 */
export type CapabilityDefinition<
  TParams extends z.ZodType = z.ZodType,
  TResult extends z.ZodType = z.ZodType,
> = FoldDefinition<TParams, TResult> | UnfoldDefinition<TParams, TResult>

// ============================================================================
// Action Plan Types
// ============================================================================

export type ActionStatus =
  | 'pending'
  | 'blocked'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'undone'
  | 'cancelled'

export type PlanStatus =
  | 'planning'
  | 'executing'
  | 'awaiting-confirmation'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * A single action within an execution plan.
 */
export interface GluvAction {
  /** Unique identifier for this action instance */
  id: string

  /** Sequence number within the plan (for ordering) */
  sequence: number

  /** Human-readable title for display */
  title: string

  /** Detailed instruction for this action */
  description: string

  /** Name of the capability to invoke */
  capabilityName: string

  /** Parameters to pass */
  params: Record<string, unknown>

  /** IDs of actions that must complete before this one starts */
  blockedBy: string[]

  /** IDs of actions that are waiting for this one */
  blocks: string[]

  /** Current execution status */
  status: ActionStatus

  /** Result after execution */
  result?: ActionResult<unknown>

  /** Undo snapshot if action completed */
  undoSnapshot?: UndoSnapshot
}

/**
 * A complete execution plan generated by the agent.
 */
export interface ActionPlan {
  /** Unique identifier for this plan */
  id: string

  /** The user request that triggered this plan */
  userRequest: string

  /** Agent's reasoning for this plan */
  reasoning: string

  /** All actions in the plan */
  actions: GluvAction[]

  /** Overall plan status */
  status: PlanStatus

  /** Timestamp of plan creation */
  createdAt: number

  /** Timestamp of last status change */
  updatedAt: number
}

// ============================================================================
// Event Types
// ============================================================================

export type GluvEventType =
  | 'plan:created'
  | 'plan:started'
  | 'plan:completed'
  | 'plan:failed'
  | 'action:started'
  | 'action:completed'
  | 'action:failed'
  | 'action:undone'
  | 'confirmation:requested'
  | 'confirmation:approved'
  | 'confirmation:declined'
  | 'ui:mounted'
  | 'ui:unmounted'

export interface GluvEvent<T = unknown> {
  type: GluvEventType
  timestamp: number
  planId?: string
  actionId?: string
  data?: T
}
