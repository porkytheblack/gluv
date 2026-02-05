import { nanoid } from 'nanoid'
import type {
  ActionPlan,
  GluvAction,
  ActionStatus,
  PlanStatus,
  GluvContext,
  ActionResult,
  UndoSnapshot,
  UndoResult,
  GluvEvent,
} from './types'
import type { CapabilityRegistry, StoredCapability } from './registry'
import {
  ExecutionError,
  CyclicDependencyError,
  ConfirmationDeclinedError,
  UndoError,
  wrapError,
} from './errors'

// ============================================================================
// Event Emitter
// ============================================================================

export type GluvEventHandler<T = unknown> = (event: GluvEvent<T>) => void

export class EventEmitter {
  private handlers = new Map<string, Set<GluvEventHandler>>()

  on<T>(type: string, handler: GluvEventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler as GluvEventHandler)

    return () => {
      this.handlers.get(type)?.delete(handler as GluvEventHandler)
    }
  }

  emit<T>(type: string, data?: T, planId?: string, actionId?: string): void {
    const event: GluvEvent<T> = {
      type: type as GluvEvent['type'],
      timestamp: Date.now(),
      planId,
      actionId,
      data,
    }

    this.handlers.get(type)?.forEach((handler) => handler(event))
    this.handlers.get('*')?.forEach((handler) => handler(event))
  }

  off(type: string, handler?: GluvEventHandler): void {
    if (handler) {
      this.handlers.get(type)?.delete(handler)
    } else {
      this.handlers.delete(type)
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}

// ============================================================================
// DAG Utilities
// ============================================================================

/**
 * Detect cycles in the action dependency graph.
 */
function detectCycles(actions: GluvAction[]): string[] | null {
  const actionMap = new Map(actions.map((a) => [a.id, a]))
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfs(actionId: string): string[] | null {
    visited.add(actionId)
    recursionStack.add(actionId)
    path.push(actionId)

    const action = actionMap.get(actionId)
    if (!action) return null

    for (const blockedById of action.blockedBy) {
      if (!visited.has(blockedById)) {
        const cycle = dfs(blockedById)
        if (cycle) return cycle
      } else if (recursionStack.has(blockedById)) {
        // Found a cycle
        const cycleStart = path.indexOf(blockedById)
        return [...path.slice(cycleStart), blockedById]
      }
    }

    path.pop()
    recursionStack.delete(actionId)
    return null
  }

  for (const action of actions) {
    if (!visited.has(action.id)) {
      const cycle = dfs(action.id)
      if (cycle) return cycle
    }
  }

  return null
}

/**
 * Topologically sort actions by dependencies.
 */
function topologicalSort(actions: GluvAction[]): GluvAction[] {
  const actionMap = new Map(actions.map((a) => [a.id, a]))
  const inDegree = new Map<string, number>()
  const sorted: GluvAction[] = []

  // Initialize in-degrees
  for (const action of actions) {
    inDegree.set(action.id, action.blockedBy.length)
  }

  // Find all actions with no dependencies
  const queue = actions.filter((a) => a.blockedBy.length === 0)

  let sequence = 1
  while (queue.length > 0) {
    const action = queue.shift()!
    action.sequence = sequence++
    sorted.push(action)

    // Reduce in-degree for dependent actions
    for (const dependentId of action.blocks) {
      const newDegree = (inDegree.get(dependentId) ?? 0) - 1
      inDegree.set(dependentId, newDegree)

      if (newDegree === 0) {
        const dependent = actionMap.get(dependentId)
        if (dependent) queue.push(dependent)
      }
    }
  }

  return sorted
}

/**
 * Compute execution levels for parallel execution.
 */
function computeExecutionLevels(actions: GluvAction[]): Map<number, GluvAction[]> {
  const levels = new Map<number, GluvAction[]>()
  const actionLevels = new Map<string, number>()

  function getLevel(action: GluvAction): number {
    if (actionLevels.has(action.id)) {
      return actionLevels.get(action.id)!
    }

    if (action.blockedBy.length === 0) {
      actionLevels.set(action.id, 0)
      return 0
    }

    const maxBlockerLevel = Math.max(
      ...action.blockedBy.map((id) => {
        const blocker = actions.find((a) => a.id === id)
        return blocker ? getLevel(blocker) : 0
      })
    )

    const level = maxBlockerLevel + 1
    actionLevels.set(action.id, level)
    return level
  }

  for (const action of actions) {
    const level = getLevel(action)
    if (!levels.has(level)) {
      levels.set(level, [])
    }
    levels.get(level)!.push(action)
  }

  return levels
}

// ============================================================================
// Undo Manager
// ============================================================================

export interface UndoManagerConfig {
  maxStackSize: number
}

export class UndoManager {
  private stack: Array<{ action: GluvAction; snapshot: UndoSnapshot }> = []
  private config: UndoManagerConfig

  constructor(config: Partial<UndoManagerConfig> = {}) {
    this.config = {
      maxStackSize: config.maxStackSize ?? 100,
    }
  }

  push(action: GluvAction, snapshot: UndoSnapshot): void {
    this.stack.push({ action, snapshot })

    // Prune if over limit
    if (this.stack.length > this.config.maxStackSize) {
      this.stack.shift()
    }
  }

  pop(): { action: GluvAction; snapshot: UndoSnapshot } | undefined {
    return this.stack.pop()
  }

  peek(): { action: GluvAction; snapshot: UndoSnapshot } | undefined {
    return this.stack[this.stack.length - 1]
  }

  get size(): number {
    return this.stack.length
  }

  clear(): void {
    this.stack = []
  }

  getAll(): Array<{ action: GluvAction; snapshot: UndoSnapshot }> {
    return [...this.stack]
  }
}

// ============================================================================
// Action Coordinator
// ============================================================================

export interface CoordinatorConfig {
  maxParallelActions: number
  actionTimeoutMs: number
  maxRetries: number
  confirmationTimeoutMs: number
}

export interface ConfirmationRequest {
  planId: string
  actions: GluvAction[]
  resolve: (approved: boolean) => void
}

export interface ExecutionResult {
  plan: ActionPlan
  undoneCount: number
  failedCount: number
}

export class ActionCoordinator {
  private config: CoordinatorConfig
  private registry: CapabilityRegistry
  private undoManager: UndoManager
  private events: EventEmitter
  private pendingConfirmations = new Map<string, ConfirmationRequest>()
  private actionResults = new Map<string, ActionResult>()

  constructor(
    registry: CapabilityRegistry,
    events: EventEmitter,
    config: Partial<CoordinatorConfig> = {}
  ) {
    this.registry = registry
    this.events = events
    this.config = {
      maxParallelActions: config.maxParallelActions ?? 10,
      actionTimeoutMs: config.actionTimeoutMs ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      confirmationTimeoutMs: config.confirmationTimeoutMs ?? 60000,
    }
    this.undoManager = new UndoManager()
  }

  /**
   * Create a new action plan.
   */
  createPlan(
    userRequest: string,
    reasoning: string,
    actions: Omit<GluvAction, 'id' | 'sequence' | 'status' | 'blocks'>[]
  ): ActionPlan {
    const planId = nanoid()

    // Generate IDs and build blocks relationships
    const actionsWithIds = actions.map((a) => ({
      ...a,
      id: nanoid(),
      sequence: 0,
      status: 'pending' as ActionStatus,
      blocks: [] as string[],
    }))

    // Build reverse dependency map (blocks)
    const idMap = new Map(
      actionsWithIds.map((a, i) => [actions[i]?.blockedBy ?? [], a.id])
    )

    for (const action of actionsWithIds) {
      for (const blockerId of action.blockedBy) {
        const blocker = actionsWithIds.find((a) => a.id === blockerId)
        if (blocker) {
          blocker.blocks.push(action.id)
        }
      }
    }

    // Detect cycles
    const cycle = detectCycles(actionsWithIds)
    if (cycle) {
      throw new CyclicDependencyError(cycle)
    }

    // Sort and assign sequence numbers
    const sortedActions = topologicalSort(actionsWithIds)

    const plan: ActionPlan = {
      id: planId,
      userRequest,
      reasoning,
      actions: sortedActions,
      status: 'planning',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.events.emit('plan:created', plan, planId)

    return plan
  }

  /**
   * Execute an action plan.
   */
  async executePlan(
    plan: ActionPlan,
    contextFactory: () => Promise<GluvContext>
  ): Promise<ExecutionResult> {
    plan.status = 'executing'
    plan.updatedAt = Date.now()
    this.events.emit('plan:started', plan, plan.id)

    const completedActions = new Set<string>()
    const failedActions = new Set<string>()
    this.actionResults.clear()

    try {
      // Compute execution levels
      const levels = computeExecutionLevels(plan.actions)
      const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b)

      for (const level of sortedLevels) {
        const levelActions = levels.get(level)!

        // Check for actions requiring confirmation
        const confirmNeeded = levelActions.filter((a) => {
          const capability = this.registry.getCapability(a.capabilityName)
          return capability.definition.requireConfirm
        })

        if (confirmNeeded.length > 0) {
          plan.status = 'awaiting-confirmation'
          plan.updatedAt = Date.now()

          const approved = await this.requestConfirmation(plan.id, confirmNeeded)
          if (!approved) {
            // Mark declined actions as cancelled
            for (const action of confirmNeeded) {
              action.status = 'cancelled'
              this.events.emit('confirmation:declined', action, plan.id, action.id)
            }
            // Continue with non-declined actions
            const remaining = levelActions.filter((a) => a.status !== 'cancelled')
            if (remaining.length === 0) continue
          } else {
            this.events.emit('confirmation:approved', confirmNeeded, plan.id)
          }
        }

        // Execute actions at this level in parallel
        const executableActions = levelActions.filter(
          (a) => a.status === 'pending' && !failedActions.size
        )

        const results = await Promise.all(
          executableActions.map((action) =>
            this.executeAction(action, plan, contextFactory)
          )
        )

        // Process results
        for (let i = 0; i < results.length; i++) {
          const action = executableActions[i]
          const result = results[i]

          if (result.status === 'success') {
            action.status = 'completed'
            action.result = result
            completedActions.add(action.id)
            this.actionResults.set(action.id, result)
            this.events.emit('action:completed', { action, result }, plan.id, action.id)
          } else {
            action.status = 'failed'
            action.result = result
            failedActions.add(action.id)
            this.events.emit('action:failed', { action, result }, plan.id, action.id)
          }
        }

        // Stop if any action failed
        if (failedActions.size > 0) {
          break
        }

        plan.status = 'executing'
        plan.updatedAt = Date.now()
      }

      // Handle completion
      if (failedActions.size > 0) {
        plan.status = 'failed'
        this.events.emit('plan:failed', { plan, failedActions: Array.from(failedActions) }, plan.id)
      } else {
        plan.status = 'completed'
        this.events.emit('plan:completed', plan, plan.id)
      }
    } catch (error) {
      plan.status = 'failed'
      plan.updatedAt = Date.now()
      this.events.emit('plan:failed', { plan, error }, plan.id)
      throw error
    }

    plan.updatedAt = Date.now()

    return {
      plan,
      undoneCount: 0,
      failedCount: failedActions.size,
    }
  }

  /**
   * Execute a single action.
   */
  private async executeAction(
    action: GluvAction,
    plan: ActionPlan,
    contextFactory: () => Promise<GluvContext>
  ): Promise<ActionResult> {
    action.status = 'executing'
    this.events.emit('action:started', action, plan.id, action.id)

    const capability = this.registry.getCapability(action.capabilityName)
    const definition = capability.definition

    try {
      // Validate parameters
      const parseResult = definition.paramsSchema.safeParse(action.params)
      if (!parseResult.success) {
        return {
          status: 'failure',
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.message,
            recoverable: true,
          },
        }
      }

      // Create context
      const baseContext = await contextFactory()
      const context: GluvContext = {
        ...baseContext,
        currentPlan: {
          id: plan.id,
          userRequest: plan.userRequest,
          status: plan.status,
        },
        currentAction: {
          id: action.id,
          sequence: action.sequence,
          title: action.title,
          capabilityName: action.capabilityName,
          status: action.status,
        },
        getActionResult: <T>(actionId: string): T => {
          const result = this.actionResults.get(actionId)
          if (!result) {
            throw new Error(`Action "${actionId}" not found or not completed`)
          }
          return result.data as T
        },
      }

      // Capture undo data if undo is defined
      let undoData: unknown = action.params
      if (definition.kind === 'fold' && definition.captureUndoData) {
        undoData = await definition.captureUndoData(context, parseResult.data)
      }

      // Execute the action
      const result = await Promise.race([
        definition.do(context, parseResult.data),
        this.timeout(this.config.actionTimeoutMs, action.capabilityName),
      ])

      // Validate result
      if (result.status === 'success' && result.data !== undefined) {
        const resultParseResult = definition.resultSchema.safeParse(result.data)
        if (!resultParseResult.success) {
          return {
            status: 'failure',
            error: {
              code: 'RESULT_VALIDATION_ERROR',
              message: `Result validation failed: ${resultParseResult.error.message}`,
              recoverable: false,
            },
          }
        }
      }

      // Store undo snapshot
      if (result.status === 'success' && definition.kind === 'fold' && definition.undo) {
        const snapshot: UndoSnapshot = {
          timestamp: Date.now(),
          actionName: action.capabilityName,
          params: action.params,
          undoData,
          reversible: true,
          undoDescription: `Undo ${action.title}`,
        }
        action.undoSnapshot = snapshot
        this.undoManager.push(action, snapshot)
      }

      return result
    } catch (error) {
      const gluvError = wrapError(error, action.capabilityName)
      return {
        status: 'failure',
        error: {
          code: gluvError.code,
          message: gluvError.message,
          recoverable: gluvError.recoverable,
        },
      }
    }
  }

  /**
   * Request confirmation for actions.
   */
  private requestConfirmation(planId: string, actions: GluvAction[]): Promise<boolean> {
    return new Promise((resolve) => {
      const request: ConfirmationRequest = {
        planId,
        actions,
        resolve,
      }

      this.pendingConfirmations.set(planId, request)
      this.events.emit('confirmation:requested', { actions }, planId)

      // Timeout handler
      setTimeout(() => {
        if (this.pendingConfirmations.has(planId)) {
          this.pendingConfirmations.delete(planId)
          resolve(false)
        }
      }, this.config.confirmationTimeoutMs)
    })
  }

  /**
   * Respond to a confirmation request.
   */
  respondToConfirmation(planId: string, approved: boolean): void {
    const request = this.pendingConfirmations.get(planId)
    if (request) {
      this.pendingConfirmations.delete(planId)
      request.resolve(approved)
    }
  }

  /**
   * Undo the last N actions.
   */
  async undo(
    count: number = 1,
    contextFactory: () => Promise<GluvContext>
  ): Promise<{ undoneCount: number; failures: Array<{ actionName: string; reason: string }> }> {
    const undone: string[] = []
    const failures: Array<{ actionName: string; reason: string }> = []

    for (let i = 0; i < count && this.undoManager.size > 0; i++) {
      const item = this.undoManager.pop()
      if (!item) break

      const { action, snapshot } = item

      if (!snapshot.reversible) {
        failures.push({
          actionName: action.capabilityName,
          reason: 'Action is marked as irreversible',
        })
        continue
      }

      const capability = this.registry.getCapability(action.capabilityName)
      const definition = capability.definition

      if (definition.kind !== 'fold' || !definition.undo) {
        failures.push({
          actionName: action.capabilityName,
          reason: 'No undo handler defined',
        })
        continue
      }

      try {
        const context = await contextFactory()
        const result = await definition.undo(context, snapshot)

        if (result.success) {
          action.status = 'undone'
          undone.push(action.id)
          this.events.emit('action:undone', action, action.undoSnapshot?.actionName, action.id)
        } else {
          failures.push({
            actionName: action.capabilityName,
            reason: result.error ?? 'Unknown error',
          })
        }
      } catch (error) {
        failures.push({
          actionName: action.capabilityName,
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      undoneCount: undone.length,
      failures,
    }
  }

  /**
   * Get pending confirmation requests.
   */
  getPendingConfirmations(): ConfirmationRequest[] {
    return Array.from(this.pendingConfirmations.values())
  }

  /**
   * Get undo stack.
   */
  getUndoStack(): Array<{ action: GluvAction; snapshot: UndoSnapshot }> {
    return this.undoManager.getAll()
  }

  /**
   * Create a timeout promise.
   */
  private timeout(ms: number, operationName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation "${operationName}" timed out after ${ms}ms`))
      }, ms)
    })
  }
}
