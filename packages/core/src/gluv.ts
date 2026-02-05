import type { z } from 'zod'
import type {
  FoldDefinition,
  UnfoldDefinition,
  GluvContext,
  ActionPlan,
  GluvAction,
  ActionResult,
} from './types'
import { CapabilityRegistry, type StoredCapability, type ToolSchema } from './registry'
import {
  ActionCoordinator,
  EventEmitter,
  type GluvEventHandler,
  type CoordinatorConfig,
  type ConfirmationRequest,
} from './coordinator'
import { createContextFactory, type ContextFactoryConfig } from './context'

// ============================================================================
// Gluv Configuration
// ============================================================================

export interface GluvConfig {
  /** Unique identifier for this Gluv instance */
  id?: string

  /** Context factory configuration */
  context?: ContextFactoryConfig

  /** Coordinator configuration */
  coordinator?: Partial<CoordinatorConfig>
}

// ============================================================================
// Process Result
// ============================================================================

export interface ProcessResult {
  /** The generated and executed plan */
  plan: ActionPlan

  /** Final response message to display */
  response: string

  /** Any UI components to render */
  uiComponents: unknown[]
}

export interface UndoProcessResult {
  /** Number of actions successfully undone */
  undoneCount: number

  /** Actions that could not be undone */
  failures: Array<{
    actionName: string
    reason: string
  }>
}

// ============================================================================
// Capability Info
// ============================================================================

export interface CapabilityInfo {
  name: string
  description: string
  kind: 'fold' | 'unfold'
  type: string
  tags?: string[]
  requireConfirm: boolean
  llmVisible: boolean
}

// ============================================================================
// Gluv Instance
// ============================================================================

/**
 * Main Gluv framework instance.
 * Provides a fluent API for registering capabilities and processing requests.
 */
export class Gluv {
  readonly id: string
  private readonly registry: CapabilityRegistry
  private readonly coordinator: ActionCoordinator
  private readonly events: EventEmitter
  private readonly contextFactory: () => Promise<GluvContext>
  private readonly planHistory: ActionPlan[] = []

  constructor(config: GluvConfig = {}) {
    this.id = config.id ?? `gluv_${Date.now()}`
    this.registry = new CapabilityRegistry()
    this.events = new EventEmitter()
    this.coordinator = new ActionCoordinator(
      this.registry,
      this.events,
      config.coordinator
    )
    this.contextFactory = createContextFactory(config.context)
  }

  // ==========================================================================
  // Capability Registration
  // ==========================================================================

  /**
   * Register a fold (agent-invokable action).
   * Returns this instance for chaining.
   */
  fold<TParams extends z.ZodType, TResult extends z.ZodType, TUndoData = unknown>(
    definition: Omit<FoldDefinition<TParams, TResult, TUndoData>, 'kind'>
  ): this {
    this.registry.registerFold(definition)
    return this
  }

  /**
   * Register an unfold (user-input collection).
   * Returns this instance for chaining.
   */
  unfold<TParams extends z.ZodType, TResult extends z.ZodType, TFormValues = z.infer<TResult>>(
    definition: Omit<UnfoldDefinition<TParams, TResult, TFormValues>, 'kind'>
  ): this {
    this.registry.registerUnfold(definition)
    return this
  }

  // ==========================================================================
  // Plan Management
  // ==========================================================================

  /**
   * Create an action plan from a description.
   * This is typically called by the agent/LLM integration layer.
   */
  createPlan(
    userRequest: string,
    reasoning: string,
    actions: Omit<GluvAction, 'id' | 'sequence' | 'status' | 'blocks'>[]
  ): ActionPlan {
    const plan = this.coordinator.createPlan(userRequest, reasoning, actions)
    this.planHistory.push(plan)
    return plan
  }

  /**
   * Execute an action plan.
   */
  async executePlan(plan: ActionPlan): Promise<ProcessResult> {
    const result = await this.coordinator.executePlan(plan, this.contextFactory)

    // Collect UI components from completed actions
    const uiComponents = result.plan.actions
      .filter((a) => a.status === 'completed' && a.result?.ui)
      .map((a) => a.result!.ui)

    // Generate response from completed actions
    const response = this.generateResponse(result.plan)

    return {
      plan: result.plan,
      response,
      uiComponents,
    }
  }

  /**
   * Create and execute a plan in one step.
   */
  async process(
    userRequest: string,
    reasoning: string,
    actions: Omit<GluvAction, 'id' | 'sequence' | 'status' | 'blocks'>[]
  ): Promise<ProcessResult> {
    const plan = this.createPlan(userRequest, reasoning, actions)
    return this.executePlan(plan)
  }

  /**
   * Execute a single action immediately (without creating a full plan).
   */
  async executeAction<TResult = unknown>(
    capabilityName: string,
    params: Record<string, unknown>
  ): Promise<ActionResult<TResult>> {
    const plan = this.createPlan(
      `Execute ${capabilityName}`,
      'Direct action execution',
      [
        {
          title: capabilityName,
          description: `Execute ${capabilityName}`,
          capabilityName,
          params,
          blockedBy: [],
        },
      ]
    )

    const result = await this.executePlan(plan)
    return (result.plan.actions[0]?.result ?? {
      status: 'failure',
      error: { code: 'NO_RESULT', message: 'No result from action', recoverable: false },
    }) as ActionResult<TResult>
  }

  // ==========================================================================
  // Undo Operations
  // ==========================================================================

  /**
   * Undo the last N actions.
   */
  async undo(count: number = 1): Promise<UndoProcessResult> {
    return this.coordinator.undo(count, this.contextFactory)
  }

  /**
   * Get the undo stack.
   */
  getUndoStack(): Array<{ actionName: string; title: string; timestamp: number }> {
    return this.coordinator.getUndoStack().map((item) => ({
      actionName: item.action.capabilityName,
      title: item.action.title,
      timestamp: item.snapshot.timestamp,
    }))
  }

  // ==========================================================================
  // Confirmation Handling
  // ==========================================================================

  /**
   * Get pending confirmation requests.
   */
  getPendingConfirmations(): ConfirmationRequest[] {
    return this.coordinator.getPendingConfirmations()
  }

  /**
   * Respond to a confirmation request.
   */
  confirmAction(planId: string, approved: boolean): void {
    this.coordinator.respondToConfirmation(planId, approved)
  }

  // ==========================================================================
  // Capability Queries
  // ==========================================================================

  /**
   * Get all registered capabilities.
   */
  getCapabilities(): CapabilityInfo[] {
    return this.registry.getAllCapabilities().map((c) => ({
      name: c.definition.name,
      description: c.definition.description,
      kind: c.kind,
      type: c.definition.kind === 'fold' ? c.definition.type : c.definition.type,
      tags: c.definition.tags,
      requireConfirm: c.definition.requireConfirm ?? false,
      llmVisible: c.definition.llmVisible ?? true,
    }))
  }

  /**
   * Get capability by name.
   */
  getCapability(name: string): StoredCapability {
    return this.registry.getCapability(name)
  }

  /**
   * Check if a capability exists.
   */
  hasCapability(name: string): boolean {
    return this.registry.hasCapability(name)
  }

  /**
   * Get tool schemas for LLM.
   */
  getToolSchemas(): ToolSchema[] {
    return this.registry.getToolSchemas()
  }

  /**
   * Get authorized capabilities for a context.
   */
  async getAuthorizedCapabilities(context: GluvContext): Promise<CapabilityInfo[]> {
    const capabilities = await this.registry.getAuthorizedCapabilities(context)
    return capabilities.map((c) => ({
      name: c.definition.name,
      description: c.definition.description,
      kind: c.kind,
      type: c.definition.kind === 'fold' ? c.definition.type : c.definition.type,
      tags: c.definition.tags,
      requireConfirm: c.definition.requireConfirm ?? false,
      llmVisible: c.definition.llmVisible ?? true,
    }))
  }

  // ==========================================================================
  // History
  // ==========================================================================

  /**
   * Get action history for the current session.
   */
  getHistory(): ActionPlan[] {
    return [...this.planHistory]
  }

  /**
   * Clear action history.
   */
  clearHistory(): void {
    this.planHistory.length = 0
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  /**
   * Subscribe to events.
   */
  on<T>(event: string, handler: GluvEventHandler<T>): () => void {
    return this.events.on(event, handler)
  }

  /**
   * Unsubscribe from events.
   */
  off(event: string, handler?: GluvEventHandler): void {
    this.events.off(event, handler)
  }

  // ==========================================================================
  // Context
  // ==========================================================================

  /**
   * Create a new context instance.
   */
  async createContext(): Promise<GluvContext> {
    return this.contextFactory()
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Generate a response message from a completed plan.
   */
  private generateResponse(plan: ActionPlan): string {
    if (plan.status === 'completed') {
      const completedActions = plan.actions.filter((a) => a.status === 'completed')
      if (completedActions.length === 1) {
        return `Completed: ${completedActions[0].title}`
      }
      return `Completed ${completedActions.length} actions successfully.`
    }

    if (plan.status === 'failed') {
      const failedActions = plan.actions.filter((a) => a.status === 'failed')
      if (failedActions.length === 1) {
        const error = failedActions[0].result?.error
        return `Failed: ${failedActions[0].title} - ${error?.message ?? 'Unknown error'}`
      }
      return `${failedActions.length} actions failed.`
    }

    if (plan.status === 'cancelled') {
      return 'Plan was cancelled.'
    }

    return `Plan status: ${plan.status}`
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Gluv instance.
 */
export function createGluv(config: GluvConfig = {}): Gluv {
  return new Gluv(config)
}
