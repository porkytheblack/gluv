/**
 * Effect-based primitives for Gluv Framework.
 * Provides functional programming patterns using the Effect library.
 */

import { Effect, Context, Layer, pipe, Either, Option } from 'effect'
import type { z } from 'zod'
import type {
  GluvContext,
  ActionResult,
  FoldDefinition,
  UnfoldDefinition,
  ActionPlan,
  GluvAction,
  UndoSnapshot,
  UndoResult,
} from '../types'
import { GluvError, ExecutionError, ValidationError, wrapError } from '../errors'

// ============================================================================
// Effect Context Tags
// ============================================================================

/**
 * Service tag for GluvContext in Effect.
 */
export class GluvContextService extends Context.Tag('GluvContextService')<
  GluvContextService,
  GluvContext
>() {}

/**
 * Service tag for capability execution.
 */
export class CapabilityExecutor extends Context.Tag('CapabilityExecutor')<
  CapabilityExecutor,
  {
    execute: <T>(
      capabilityName: string,
      params: Record<string, unknown>
    ) => Effect.Effect<ActionResult<T>, GluvError>
  }
>() {}

// ============================================================================
// Effect-based Action Types
// ============================================================================

/**
 * An Effect-wrapped action result.
 */
export type ActionEffect<T, E = GluvError> = Effect.Effect<ActionResult<T>, E, GluvContextService>

/**
 * Effect-based fold definition.
 */
export interface EffectFoldDefinition<
  TParams extends z.ZodType,
  TResult extends z.ZodType,
  TUndoData = unknown,
> {
  name: string
  description: string
  type: 'action-constructive' | 'action-destructive' | 'action-idempotent'
  paramsSchema: TParams
  resultSchema: TResult
  requireConfirm?: boolean
  tags?: string[]
  llmVisible?: boolean

  /** Effect-based action implementation */
  do: (params: z.infer<TParams>) => ActionEffect<z.infer<TResult>>

  /** Effect-based undo handler */
  undo?: (snapshot: UndoSnapshot<TUndoData, z.infer<TParams>>) => Effect.Effect<UndoResult, GluvError, GluvContextService>

  /** Effect-based undo data capture */
  captureUndoData?: (params: z.infer<TParams>) => Effect.Effect<TUndoData, GluvError, GluvContextService>
}

// ============================================================================
// Effect Utilities
// ============================================================================

/**
 * Run an Effect with GluvContext.
 */
export function runWithContext<T, E>(
  effect: Effect.Effect<T, E, GluvContextService>,
  context: GluvContext
): Promise<Either.Either<T, E>> {
  const layer = Layer.succeed(GluvContextService, context)
  return Effect.runPromise(
    pipe(
      effect,
      Effect.provide(layer),
      Effect.either
    )
  )
}

/**
 * Get the current GluvContext from Effect.
 */
export const getContext = GluvContextService

/**
 * Create an Effect that accesses the context.
 */
export function withContext<T>(
  fn: (context: GluvContext) => T
): Effect.Effect<T, never, GluvContextService> {
  return Effect.flatMap(GluvContextService, (ctx) => Effect.succeed(fn(ctx)))
}

/**
 * Create an Effect that accesses the context asynchronously.
 */
export function withContextAsync<T, E = GluvError>(
  fn: (context: GluvContext) => Promise<T>
): Effect.Effect<T, E, GluvContextService> {
  return Effect.flatMap(GluvContextService, (ctx) =>
    Effect.tryPromise({
      try: () => fn(ctx),
      catch: (error) => wrapError(error, 'withContextAsync') as E,
    })
  )
}

// ============================================================================
// Action Result Utilities
// ============================================================================

/**
 * Create a successful action result Effect.
 */
export function succeed<T>(data: T, ui?: unknown): ActionEffect<T, never> {
  return Effect.succeed({
    status: 'success' as const,
    data,
    ui,
  })
}

/**
 * Create a failed action result Effect.
 */
export function fail<T = unknown>(
  code: string,
  message: string,
  recoverable: boolean = true
): ActionEffect<T, never> {
  return Effect.succeed({
    status: 'failure' as const,
    error: { code, message, recoverable },
  })
}

/**
 * Create a pending confirmation action result Effect.
 */
export function pendingConfirmation<T = unknown>(): ActionEffect<T, never> {
  return Effect.succeed({
    status: 'pending-confirmation' as const,
  })
}

// ============================================================================
// Schema Validation Effects
// ============================================================================

/**
 * Validate data against a Zod schema using Effect.
 */
export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown,
  fieldName: string = 'input'
): Effect.Effect<z.infer<T>, ValidationError> {
  const result = schema.safeParse(data)
  if (result.success) {
    return Effect.succeed(result.data)
  }
  const firstError = result.error.errors[0]
  return Effect.fail(
    new ValidationError(
      firstError?.path.join('.') || fieldName,
      firstError?.message || 'Validation failed',
      data
    )
  )
}

/**
 * Validate and transform data.
 */
export function validateAndTransform<T extends z.ZodType, R>(
  schema: T,
  data: unknown,
  transform: (validated: z.infer<T>) => R
): Effect.Effect<R, ValidationError> {
  return pipe(
    validate(schema, data),
    Effect.map(transform)
  )
}

// ============================================================================
// Effect-based Fold Conversion
// ============================================================================

/**
 * Convert an Effect-based fold definition to a standard fold definition.
 */
export function effectFold<
  TParams extends z.ZodType,
  TResult extends z.ZodType,
  TUndoData = unknown,
>(
  definition: EffectFoldDefinition<TParams, TResult, TUndoData>
): Omit<FoldDefinition<TParams, TResult, TUndoData>, 'kind'> {
  return {
    ...definition,
    do: async (context: GluvContext, params: z.infer<TParams>) => {
      const result = await runWithContext(definition.do(params), context)
      if (Either.isLeft(result)) {
        const error = result.left as GluvError
        return {
          status: 'failure' as const,
          error: {
            code: error.code,
            message: error.message,
            recoverable: error.recoverable,
          },
        }
      }
      return result.right
    },
    undo: definition.undo
      ? async (context: GluvContext, snapshot: UndoSnapshot<TUndoData, z.infer<TParams>>) => {
          const result = await runWithContext(definition.undo!(snapshot), context)
          if (Either.isLeft(result)) {
            return { success: false, error: (result.left as GluvError).message }
          }
          return result.right
        }
      : undefined,
    captureUndoData: definition.captureUndoData
      ? async (context: GluvContext, params: z.infer<TParams>) => {
          const result = await runWithContext(definition.captureUndoData!(params), context)
          if (Either.isLeft(result)) {
            throw result.left
          }
          return result.right
        }
      : undefined,
  }
}

// ============================================================================
// Combinators
// ============================================================================

/**
 * Sequence multiple action effects.
 */
export function sequence<T>(
  effects: ActionEffect<T>[]
): ActionEffect<T[]> {
  return pipe(
    Effect.all(effects),
    Effect.map((results) => ({
      status: 'success' as const,
      data: results.map((r) => r.data).filter((d): d is T => d !== undefined),
    }))
  )
}

/**
 * Run action effects in parallel.
 */
export function parallel<T>(
  effects: ActionEffect<T>[],
  concurrency: number = 10
): ActionEffect<T[]> {
  return pipe(
    Effect.all(effects, { concurrency }),
    Effect.map((results) => ({
      status: 'success' as const,
      data: results.map((r) => r.data).filter((d): d is T => d !== undefined),
    }))
  )
}

/**
 * Map over an action effect result.
 */
export function mapResult<T, R>(
  effect: ActionEffect<T>,
  fn: (data: T) => R
): ActionEffect<R> {
  return pipe(
    effect,
    Effect.map((result) => ({
      ...result,
      data: result.data !== undefined ? fn(result.data) : undefined,
    }))
  )
}

/**
 * FlatMap over an action effect result.
 */
export function flatMapResult<T, R>(
  effect: ActionEffect<T>,
  fn: (data: T) => ActionEffect<R>
): ActionEffect<R> {
  return pipe(
    effect,
    Effect.flatMap((result) => {
      if (result.status === 'success' && result.data !== undefined) {
        return fn(result.data)
      }
      return Effect.succeed(result as ActionResult<R>)
    })
  )
}

/**
 * Recover from errors with a fallback.
 */
export function recover<T>(
  effect: ActionEffect<T>,
  fallback: (error: GluvError) => ActionEffect<T>
): ActionEffect<T, never> {
  return pipe(
    effect,
    Effect.catchAll(fallback)
  ) as ActionEffect<T, never>
}

/**
 * Add a timeout to an action effect.
 */
export function withTimeout<T>(
  effect: ActionEffect<T>,
  duration: number
): ActionEffect<T> {
  return pipe(
    effect,
    Effect.timeout(`${duration} millis`),
    Effect.flatMap((option) =>
      Option.isSome(option)
        ? Effect.succeed(option.value)
        : fail('TIMEOUT', `Operation timed out after ${duration}ms`)
    )
  ) as ActionEffect<T>
}

// ============================================================================
// Re-exports
// ============================================================================

export { Effect, Context, Layer, pipe, Either, Option }
