/**
 * @gluv/core - Core runtime for Gluv Framework
 *
 * Gluv is an agentic framework for building AI-powered applications
 * with seamless plug-and-play capabilities for both UI and functionality.
 *
 * @example
 * ```ts
 * import { createGluv } from '@gluv/core'
 * import { z } from 'zod'
 *
 * const gluv = createGluv()
 *   .fold({
 *     name: 'addToCart',
 *     description: 'Add a product to the shopping cart',
 *     type: 'action-constructive',
 *     paramsSchema: z.object({
 *       productId: z.string(),
 *       quantity: z.number().int().positive().default(1),
 *     }),
 *     resultSchema: z.object({
 *       success: z.boolean(),
 *       cartItemId: z.string(),
 *     }),
 *     do: async (ctx, params) => {
 *       const result = await ctx.db.execute(
 *         'INSERT INTO cart (product_id, quantity) VALUES (?, ?)',
 *         [params.productId, params.quantity]
 *       )
 *       return {
 *         status: 'success',
 *         data: { success: true, cartItemId: result.id },
 *       }
 *     },
 *     undo: async (ctx, snapshot) => {
 *       await ctx.db.execute(
 *         'DELETE FROM cart WHERE product_id = ?',
 *         [snapshot.params.productId]
 *       )
 *       return { success: true }
 *     },
 *   })
 * ```
 */

// Types
export type {
  // Action types
  FoldActionType,
  UnfoldType,
  ResultPresentation,
  ActionError,
  ActionResult,
  ActionStatus,
  PlanStatus,

  // Undo types
  UndoSnapshot,
  UndoResult,

  // Context types
  AuthInfo,
  DatabaseAdapter,
  ServiceContainer,
  GluvContext,

  // Visibility
  DataVisibility,

  // Permissions
  CapabilityPermission,

  // Capability definitions
  CapabilityBase,
  FoldDefinition,
  UnfoldDefinition,
  CapabilityDefinition,

  // Plan types
  GluvAction,
  ActionPlan,

  // Event types
  GluvEventType,
  GluvEvent,
} from './types'

// Main Gluv class and factory
export { Gluv, createGluv, type GluvConfig, type ProcessResult, type UndoProcessResult, type CapabilityInfo } from './gluv'

// Registry
export {
  CapabilityRegistry,
  type StoredCapability,
  type ToolSchema,
} from './registry'

// Coordinator
export {
  ActionCoordinator,
  EventEmitter,
  UndoManager,
  type GluvEventHandler,
  type CoordinatorConfig,
  type ConfirmationRequest,
  type ExecutionResult,
  type UndoManagerConfig,
} from './coordinator'

// Context utilities
export {
  createContextFactory,
  createServiceContainer,
  createNoopDatabaseAdapter,
  createAnonymousAuth,
  extendContext,
  readonlyContext,
  type ContextFactoryConfig,
} from './context'

// Errors
export {
  GluvError,
  ValidationError,
  CapabilityNotFoundError,
  ConfirmationDeclinedError,
  ExecutionError,
  UndoError,
  CyclicDependencyError,
  PermissionDeniedError,
  ContextError,
  PlanningError,
  TimeoutError,
  isGluvError,
  wrapError,
} from './errors'
