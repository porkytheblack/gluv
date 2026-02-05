# RFC: Gluv Framework - Agentic Application Development Framework

## Status
Draft

## Abstract

Gluv Framework is an agentic framework for building AI-powered applications with seamless plug-and-play capabilities for both UI and functionality. It provides a unified interface paradigm where complex application behaviors are exposed through a single conversational input, while maintaining type safety, action reversibility, and secure handling of sensitive operations. This RFC specifies the core primitives (`fold`/`unfold`), the agent coordination loop, UI integration patterns, and the security model for building production-grade agentic applications.

## 1. Introduction

### 1.1 Problem Statement

Modern AI-powered applications face a fundamental tension: they must expose rich, complex functionality through natural language interfaces while maintaining the safety, type-correctness, and reversibility guarantees that traditional applications provide. Current solutions either:

1. **Over-simplify**: Limit AI capabilities to avoid safety issues, resulting in underwhelming user experiences
2. **Over-complicate**: Require extensive boilerplate to connect AI capabilities to application logic
3. **Ignore reversibility**: Provide no mechanism to undo AI-initiated actions when they go wrong
4. **Fragment the interface**: Scatter AI touchpoints across multiple UI surfaces, creating cognitive overhead

Developers need a framework that makes it trivially easy to expose application functionality to AI agents while maintaining full control over confirmation flows, data validation, undo capabilities, and UI rendering.

### 1.2 Goals

1. **G1**: Provide a minimal, intuitive API for registering application capabilities that AI agents can invoke
2. **G2**: Support both agent-initiated actions (`fold`) and user-initiated data collection (`unfold`) with unified semantics
3. **G3**: Enable type-safe parameter and result validation using Zod schemas
4. **G4**: Implement a robust undo/rollback system for action reversibility
5. **G5**: Integrate seamlessly with React-based chat interfaces for inline UI rendering
6. **G6**: Provide a secure model for handling sensitive data (payments, credentials) that limits AI exposure
7. **G7**: Support action coordination with dependency resolution and parallel execution where safe
8. **G8**: Require explicit confirmation for destructive or high-risk operations
9. **G9**: Enable context-based dependency injection for database, auth, and service access

### 1.3 Non-Goals

1. **NG1**: This RFC does not specify the LLM integration layer (model selection, prompt engineering, token management)
2. **NG2**: This RFC does not define the persistence layer for action history (implementers choose their storage)
3. **NG3**: This RFC does not mandate a specific React framework or styling solution
4. **NG4**: This RFC does not cover multi-tenant isolation (assumed to be handled at a higher level)
5. **NG5**: This RFC does not specify real-time collaboration or multi-user scenarios

### 1.4 Success Criteria

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| API Surface Simplicity | Number of core methods to learn | <= 5 |
| Type Safety | Compile-time type errors for schema mismatches | 100% |
| Action Registration | Lines of code to register a typical action | <= 15 |
| Undo Coverage | Percentage of actions with reversibility support | >= 80% for constructive actions |
| Latency Overhead | Framework overhead per action invocation | < 5ms |
| Bundle Size | Gzipped client bundle addition | < 15KB |

## 2. Background

### 2.1 Current State

Building agentic applications today typically involves:

1. Defining tool schemas (often JSON Schema or Zod) for LLM function calling
2. Implementing tool handlers as standalone functions
3. Manually wiring UI components to display tool results
4. Building custom confirmation flows for each sensitive operation
5. Implementing undo logic as an afterthought, often incompletely

This results in scattered, inconsistent implementations where each tool is a one-off integration rather than part of a cohesive system.

### 2.2 Terminology

| Term | Definition |
|------|------------|
| **Fold** | An action primitive that "folds" functionality into the agent's capability set. The agent can invoke folds directly. Metaphorically, the fist emoji represents the agent grasping and executing capability. |
| **Unfold** | A UI primitive that "unfolds" an interface for user input. The agent triggers the unfold, but the user completes it. Metaphorically, the open hand emoji represents presenting options to the user. |
| **Action** | A single unit of work, either a fold or unfold, with defined inputs, outputs, and optional undo behavior. |
| **Capability** | A registered fold or unfold that the agent knows about and can invoke. |
| **Context** | The dependency injection container providing access to databases, services, auth, and other resources. |
| **Action Type** | Classification of an action's effect: `action-constructive`, `action-destructive`, `action-idempotent`, `ui-collect`, `ui-display`. |
| **Confirmation Flow** | The process by which high-risk actions require explicit user approval before execution. |
| **Undo Handler** | A function that reverses the effects of a previously executed action. |
| **Action Plan** | A sequence of actions generated by the agent to accomplish a user goal. |
| **Execution Step** | A group of actions within a plan that can execute in parallel. |

### 2.3 Prior Art

#### 2.3.1 Model Context Protocol (MCP)

Anthropic's MCP provides a standardized way to expose tools to AI models. Gluv builds on this concept but focuses specifically on:
- Tighter UI integration (MCP is transport-agnostic)
- Built-in undo semantics (MCP tools are fire-and-forget)
- Confirmation flows (MCP defers to implementation)

#### 2.3.2 LangChain Tools

LangChain provides tool abstractions for LLM applications. Gluv differs by:
- First-class React UI integration
- Fluent, chainable API design
- Action type classification with semantic meaning

#### 2.3.3 Vercel AI SDK

Vercel's AI SDK provides streaming and UI primitives. Gluv complements this by:
- Adding action reversibility
- Providing structured action coordination
- Enabling agent-driven UI collection flows

## 3. Algorithm Analysis

### 3.1 Candidate Approaches for Action Coordination

#### 3.1.1 Sequential Execution

- **Description**: Execute all actions in strict sequence, one after another
- **Time Complexity**: O(n) where n = number of actions, but with serial latency accumulation
- **Space Complexity**: O(n) for action history
- **Advantages**:
  - Simple to implement and reason about
  - Natural undo ordering (LIFO)
  - No race conditions
- **Disadvantages**:
  - Unnecessarily slow when actions are independent
  - Poor utilization of async capabilities
- **Best Suited For**: Simple applications with few actions

#### 3.1.2 Fully Parallel Execution

- **Description**: Execute all actions simultaneously, collect results
- **Time Complexity**: O(1) wall-clock for independent actions
- **Space Complexity**: O(n) for concurrent action state
- **Advantages**:
  - Maximum throughput
  - Minimal latency for independent operations
- **Disadvantages**:
  - Cannot handle dependencies
  - Undo ordering becomes ambiguous
  - Resource contention issues
- **Best Suited For**: Batch operations with no interdependencies

#### 3.1.3 Dependency-Aware DAG Execution (Recommended)

- **Description**: Model actions as a directed acyclic graph where edges represent dependencies. Execute actions in topological order, parallelizing within each level.
- **Time Complexity**: O(n + e) for DAG construction, O(d) execution levels where d = DAG depth
- **Space Complexity**: O(n + e) for graph representation
- **Advantages**:
  - Optimal parallelization given constraints
  - Clear undo ordering (reverse topological)
  - Explicit dependency modeling
- **Disadvantages**:
  - More complex implementation
  - Requires dependency specification
- **Best Suited For**: Production applications with complex action relationships

### 3.2 Candidate Approaches for Undo Implementation

#### 3.2.1 Command Pattern with Inverse Operations

- **Description**: Each action stores enough information to compute its inverse operation
- **Time Complexity**: O(1) per undo operation
- **Space Complexity**: O(1) additional per action (just parameters)
- **Advantages**:
  - Memory efficient
  - Works for simple CRUD operations
- **Disadvantages**:
  - Cannot handle non-invertible operations
  - Requires careful inverse implementation
- **Best Suited For**: Database CRUD operations

#### 3.2.2 State Snapshotting

- **Description**: Capture full state before each action, restore on undo
- **Time Complexity**: O(s) where s = state size
- **Space Complexity**: O(n * s) for n actions
- **Advantages**:
  - Guaranteed correctness
  - Works for any operation
- **Disadvantages**:
  - Expensive for large state
  - May not capture external side effects
- **Best Suited For**: Applications with small, contained state

#### 3.2.3 Hybrid Approach with Compensation (Recommended)

- **Description**: Use command pattern for invertible operations, explicit compensation handlers for complex cases, and mark truly irreversible actions
- **Time Complexity**: O(1) to O(c) where c = compensation complexity
- **Space Complexity**: O(p) where p = parameters + minimal context
- **Advantages**:
  - Flexible for different action types
  - Memory efficient for simple cases
  - Explicit about irreversibility
- **Disadvantages**:
  - Requires per-action undo implementation
  - Developer must reason about reversibility
- **Best Suited For**: Real-world applications with mixed action types

### 3.3 Recommendation

The Gluv Framework adopts:
1. **Dependency-Aware DAG Execution** for action coordination
2. **Hybrid Compensation-Based Undo** for reversibility

These choices optimize for real-world application complexity while maintaining reasonable implementation burden.

## 4. Detailed Design

### 4.1 Architecture Overview

```
+-------------------------------------------------------------------+
|                         User Interface                             |
|  +-------------------------------------------------------------+  |
|  |                    GluvChatInterface                        |  |
|  |  +-------------------------------------------------------+  |  |
|  |  |  Message Thread  | Inline UI Components | Action Cards |  |  |
|  |  +-------------------------------------------------------+  |  |
|  |  |              Single Input Box                          |  |  |
|  |  +-------------------------------------------------------+  |  |
|  +-------------------------------------------------------------+  |
+-------------------------------------------------------------------+
                                |
                                v
+-------------------------------------------------------------------+
|                      Gluv Runtime Core                             |
|  +-------------------+  +------------------+  +----------------+  |
|  | Capability        |  | Action           |  | UI Renderer    |  |
|  | Registry          |  | Coordinator      |  | Bridge         |  |
|  +-------------------+  +------------------+  +----------------+  |
|  +-------------------+  +------------------+  +----------------+  |
|  | Schema            |  | Undo             |  | Confirmation   |  |
|  | Validator         |  | Manager          |  | Flow           |  |
|  +-------------------+  +------------------+  +----------------+  |
|  +-----------------------------------------------------------+   |
|  |                    Context Provider                        |   |
|  +-----------------------------------------------------------+   |
+-------------------------------------------------------------------+
                                |
                                v
+-------------------------------------------------------------------+
|                     LLM Integration Layer                          |
|  +-------------------+  +------------------+  +----------------+  |
|  | Tool Schema       |  | Agent            |  | Response       |  |
|  | Generator         |  | Loop             |  | Parser         |  |
|  +-------------------+  +------------------+  +----------------+  |
+-------------------------------------------------------------------+
                                |
                                v
+-------------------------------------------------------------------+
|                    Application Services                            |
|  +-------------------+  +------------------+  +----------------+  |
|  | Database          |  | External         |  | Auth           |  |
|  | Adapters          |  | APIs             |  | Provider       |  |
|  +-------------------+  +------------------+  +----------------+  |
+-------------------------------------------------------------------+
```

### 4.2 Data Structures

#### 4.2.1 Capability Definition

```typescript
/**
 * Base interface for all capability definitions.
 * A capability represents a single unit of functionality
 * that can be invoked by the agent or presented to the user.
 */
interface CapabilityBase<
  TParams extends z.ZodType,
  TResult extends z.ZodType
> {
  /** Unique identifier for this capability. Must be valid identifier syntax. */
  name: string;

  /** Human-readable description for LLM context. Should be clear and actionable. */
  description: string;

  /** Zod schema for validating input parameters */
  paramsSchema: TParams;

  /** Zod schema for validating return value */
  resultSchema: TResult;

  /**
   * Whether this action requires explicit user confirmation before execution.
   * Defaults based on action type:
   * - action-destructive: true
   * - action-constructive: false
   * - action-idempotent: false
   * - ui-collect: false (user is already interacting)
   * - ui-display: false
   */
  requireConfirm?: boolean;

  /**
   * Optional tags for filtering and organization.
   * Example: ['cart', 'e-commerce', 'user-facing']
   */
  tags?: string[];

  /**
   * Whether this capability should be visible to the LLM.
   * Set to false for internal-only operations.
   * Default: true
   */
  llmVisible?: boolean;
}
```

#### 4.2.2 Fold Definition (Agent-Invoked Actions)

```typescript
/**
 * Classification of action effects for confirmation and undo behavior.
 */
type FoldActionType =
  | 'action-constructive'  // Creates new data/state (e.g., add to cart)
  | 'action-destructive'   // Removes or significantly modifies data (e.g., delete)
  | 'action-idempotent';   // Safe to repeat, no lasting effect (e.g., fetch)

/**
 * Result returned from a fold execution.
 */
interface FoldResult<T> {
  /** The execution status */
  status: 'success' | 'failure' | 'pending-confirmation';

  /** The result data, validated against resultSchema */
  data?: T;

  /** Error information if status is 'failure' */
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };

  /** Optional UI component to render in chat */
  ui?: React.ReactNode;

  /**
   * How the result should be presented
   * - 'inline': Render directly in message thread
   * - 'card': Render as expandable card
   * - 'modal': Render in overlay modal
   * - 'hidden': Don't render, just return data to agent
   */
  presentation?: 'inline' | 'card' | 'modal' | 'hidden';
}

/**
 * Snapshot captured before action execution for potential undo.
 */
interface UndoSnapshot<T = unknown> {
  /** Timestamp of the original action */
  timestamp: number;

  /** The action that was performed */
  actionName: string;

  /** Parameters passed to the action */
  params: unknown;

  /** Custom data needed to reverse this action */
  undoData: T;

  /** Whether this action can actually be undone */
  reversible: boolean;

  /** Human-readable description of what undo will do */
  undoDescription?: string;
}

/**
 * A Fold is an agent-invokable action that modifies application state.
 */
interface FoldDefinition<
  TParams extends z.ZodType,
  TResult extends z.ZodType,
  TUndoData = unknown
> extends CapabilityBase<TParams, TResult> {
  /** Discriminator for fold vs unfold */
  kind: 'fold';

  /** Classification of this action's effects */
  type: FoldActionType;

  /**
   * The action implementation.
   * @param context - Dependency injection context
   * @param params - Validated parameters
   * @returns Result with optional UI component
   */
  do: (
    context: GluvContext,
    params: z.infer<TParams>
  ) => Promise<FoldResult<z.infer<TResult>>>;

  /**
   * Optional undo handler. If not provided, action is marked as irreversible.
   * @param context - Dependency injection context
   * @param snapshot - Snapshot captured during original execution
   * @returns Success/failure status
   */
  undo?: (
    context: GluvContext,
    snapshot: UndoSnapshot<TUndoData>
  ) => Promise<{ success: boolean; error?: string }>;

  /**
   * Capture data needed for undo before execution.
   * Called immediately before `do` if `undo` is defined.
   * @param context - Dependency injection context
   * @param params - Parameters that will be passed to do
   * @returns Data to store for potential undo
   */
  captureUndoData?: (
    context: GluvContext,
    params: z.infer<TParams>
  ) => Promise<TUndoData>;
}
```

#### 4.2.3 Unfold Definition (User-Input Collection)

```typescript
/**
 * Classification of unfold interaction types.
 */
type UnfoldType =
  | 'ui-collect'   // Collect structured data from user (forms)
  | 'ui-display';  // Display information, optional acknowledgment

/**
 * Visibility configuration for collected data.
 */
interface DataVisibility {
  /** Whether the LLM can see the raw collected data */
  llmCanSeeData: boolean;

  /**
   * If llmCanSeeData is false, what feedback does the LLM get?
   * - 'success-only': Just success/failure boolean
   * - 'summary': Sanitized summary (e.g., "Card ending in 4242")
   * - 'none': No feedback to LLM
   */
  llmFeedback: 'success-only' | 'summary' | 'none';

  /** Fields that should be redacted from logs */
  redactedFields?: string[];
}

/**
 * An Unfold is a user-interaction primitive that collects input.
 */
interface UnfoldDefinition<
  TParams extends z.ZodType,
  TResult extends z.ZodType,
  TFormValues = z.infer<TResult>
> extends CapabilityBase<TParams, TResult> {
  /** Discriminator for fold vs unfold */
  kind: 'unfold';

  /** Classification of this interaction's purpose */
  type: UnfoldType;

  /**
   * React component factory for the collection UI.
   * Receives react-hook-form utilities and context.
   * @param form - react-hook-form form instance
   * @param context - Read-only context for display data
   * @returns JSX to render in the chat interface
   */
  ui: (
    form: UseFormReturn<TFormValues>,
    context: Readonly<GluvContext>
  ) => React.ReactNode;

  /**
   * Configuration for how collected data is handled.
   */
  visibility: DataVisibility;

  /**
   * Process the collected data after form submission.
   * @param context - Dependency injection context
   * @param values - Validated form values
   * @returns Result to pass back to agent or render
   */
  do: (
    context: GluvContext,
    values: TFormValues
  ) => Promise<FoldResult<z.infer<TResult>>>;

  /**
   * Optional undo for unfold actions (rare but possible).
   * Example: Cancel a reservation made during collection.
   */
  undo?: (
    context: GluvContext,
    snapshot: UndoSnapshot
  ) => Promise<{ success: boolean; error?: string }>;

  /**
   * Validation rules beyond schema validation.
   * Runs on form submission before `do`.
   */
  validate?: (values: TFormValues) =>
    | { valid: true }
    | { valid: false; errors: Record<string, string> };
}
```

#### 4.2.4 Action Plan and Coordination

```typescript
/**
 * A single action within an execution plan.
 */
interface GluvAction {
  /** Unique identifier for this action instance */
  id: string;

  /** Sequence number within the plan (for ordering) */
  sequence: number;

  /** Human-readable title for display */
  title: string;

  /**
   * Detailed instruction for this action.
   * May reference data from previous actions.
   */
  description: string;

  /** Name of the capability to invoke */
  capabilityName: string;

  /** Parameters to pass (may include template references) */
  params: Record<string, unknown>;

  /** IDs of actions that must complete before this one starts */
  blockedBy: string[];

  /** IDs of actions that are waiting for this one */
  blocks: string[];

  /** Current execution status */
  status: 'pending' | 'blocked' | 'executing' | 'completed' | 'failed' | 'undone';

  /** Result after execution */
  result?: FoldResult<unknown>;

  /** Undo snapshot if action completed */
  undoSnapshot?: UndoSnapshot;
}

/**
 * A complete execution plan generated by the agent.
 */
interface ActionPlan {
  /** Unique identifier for this plan */
  id: string;

  /** The user request that triggered this plan */
  userRequest: string;

  /** Agent's reasoning for this plan */
  reasoning: string;

  /** All actions in the plan */
  actions: GluvAction[];

  /** Overall plan status */
  status: 'planning' | 'executing' | 'awaiting-confirmation' | 'completed' | 'failed' | 'cancelled';

  /** Timestamp of plan creation */
  createdAt: number;

  /** Timestamp of last status change */
  updatedAt: number;
}
```

#### 4.2.5 Context System

```typescript
/**
 * Read-only authentication information.
 */
interface AuthInfo {
  userId: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
}

/**
 * Database adapter interface (implementation-specific).
 */
interface DatabaseAdapter {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number }>;
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
}

/**
 * Service container for external integrations.
 */
interface ServiceContainer {
  get<T>(serviceName: string): T;
  has(serviceName: string): boolean;
}

/**
 * The dependency injection context provided to all actions.
 */
interface GluvContext {
  /** Current user authentication info */
  auth: AuthInfo;

  /** Database adapter for persistence */
  db: DatabaseAdapter;

  /** External service container */
  services: ServiceContainer;

  /** Current action plan (if executing within one) */
  currentPlan?: Readonly<ActionPlan>;

  /** Current action (if executing within one) */
  currentAction?: Readonly<GluvAction>;

  /**
   * Access result from a previous action in the same plan.
   * @param actionId - ID of the completed action
   * @returns The action's result data
   * @throws If action not found or not completed
   */
  getActionResult<T>(actionId: string): T;

  /**
   * Emit an event for real-time UI updates.
   * @param event - Event name
   * @param data - Event payload
   */
  emit(event: string, data: unknown): void;

  /**
   * Log an audit event (separate from application logs).
   * @param action - Action being audited
   * @param details - Audit details
   */
  audit(action: string, details: Record<string, unknown>): void;
}
```

### 4.3 Algorithm Specification

#### 4.3.1 Capability Registration

```
PROCEDURE registerFold(gluv: GluvInstance, definition: FoldDefinition)
  REQUIRE: definition.name is unique within gluv
  REQUIRE: definition.paramsSchema is valid Zod schema
  REQUIRE: definition.resultSchema is valid Zod schema
  ENSURE: Capability is registered and available for invocation
  ENSURE: LLM tool schema is generated if llmVisible !== false

  1. Validate definition structure
     - Assert name matches /^[a-zA-Z][a-zA-Z0-9_]*$/
     - Assert description is non-empty
     - Compile Zod schemas to verify validity

  2. Set defaults based on action type
     - IF type === 'action-destructive' AND requireConfirm === undefined
       THEN requireConfirm := true
     - IF type === 'action-idempotent' AND requireConfirm === undefined
       THEN requireConfirm := false

  3. Generate LLM tool schema
     - Convert paramsSchema to JSON Schema format
     - Attach description and parameter descriptions
     - Store in registry.toolSchemas[name]

  4. Store capability
     - registry.capabilities[name] := {
         kind: 'fold',
         definition,
         toolSchema: generated schema
       }

  5. Return gluv instance for chaining
```

#### 4.3.2 Action Plan Generation (Agent Loop)

```
PROCEDURE generatePlan(agent: AgentInstance, userRequest: string, context: GluvContext)
  REQUIRE: userRequest is non-empty
  REQUIRE: context.auth is valid
  ENSURE: Returns ActionPlan with dependency-ordered actions

  1. Prepare LLM context
     - Gather available capabilities from registry
     - Filter by context.auth.permissions
     - Format as tool descriptions

  2. Invoke LLM for planning
     - System prompt includes:
       - Available capabilities with schemas
       - Current user context
       - Instructions for dependency specification
     - User message: userRequest
     - Request structured output matching ActionPlan schema

  3. Parse and validate LLM response
     - Extract actions array
     - FOR each action:
       - Validate capabilityName exists
       - Validate params against capability.paramsSchema
       - Validate blockedBy references valid action IDs

  4. Build dependency graph
     - Create adjacency list from blockedBy relationships
     - Detect cycles using DFS
     - IF cycle detected:
       - Log error
       - Return to step 2 with cycle feedback

  5. Compute execution levels
     - Perform topological sort
     - Group actions by level (actions at same level can parallelize)

  6. Construct ActionPlan
     - id := generateUUID()
     - status := 'planning'
     - actions := sorted actions with computed sequence numbers

  7. Return plan
```

#### 4.3.3 Action Execution

```
PROCEDURE executePlan(coordinator: ActionCoordinator, plan: ActionPlan, context: GluvContext)
  REQUIRE: plan.status === 'planning'
  ENSURE: All actions are executed or plan is in terminal state

  1. Initialize execution state
     - plan.status := 'executing'
     - completedActions := Set()
     - failedActions := Set()
     - undoStack := Stack()

  2. Compute initial executable set
     - executableSet := { a | a in plan.actions AND a.blockedBy === [] }

  3. WHILE executableSet is not empty AND failedActions is empty:

     3.1 Check for confirmations
         - confirmNeeded := { a | a in executableSet AND a.capability.requireConfirm }
         - IF confirmNeeded is not empty:
           - plan.status := 'awaiting-confirmation'
           - Emit confirmation request to UI
           - AWAIT user response
           - IF user declines:
             - Mark declined actions as 'cancelled'
             - Continue with remaining

     3.2 Execute actions in parallel
         - results := PARALLEL FOR each action in executableSet:
           - executeAction(action, context)

     3.3 Process results
         - FOR each (action, result) in results:
           - IF result.status === 'success':
             - action.status := 'completed'
             - action.result := result
             - Push action to undoStack if undo defined
             - completedActions.add(action.id)
           - ELSE IF result.status === 'failure':
             - action.status := 'failed'
             - failedActions.add(action.id)

     3.4 Update executable set
         - FOR each action in plan.actions:
           - IF action.status === 'pending':
             - IF all blockedBy are in completedActions:
               - Add action to executableSet

  4. Handle completion
     - IF failedActions is not empty:
       - plan.status := 'failed'
       - OPTIONALLY invoke rollback(undoStack, context)
     - ELSE:
       - plan.status := 'completed'

  5. Return plan with final state

PROCEDURE executeAction(action: GluvAction, context: GluvContext)
  REQUIRE: action.status === 'pending' OR action.status === 'blocked'
  ENSURE: action has result and status updated

  1. Retrieve capability
     - capability := registry.capabilities[action.capabilityName]
     - IF capability is undefined:
       - RETURN failure("Unknown capability")

  2. Validate parameters
     - validationResult := capability.paramsSchema.safeParse(action.params)
     - IF NOT validationResult.success:
       - RETURN failure(validationResult.error)

  3. Prepare context
     - enrichedContext := context with:
       - currentPlan: plan
       - currentAction: action

  4. Capture undo data (if applicable)
     - IF capability.captureUndoData is defined:
       - undoData := AWAIT capability.captureUndoData(enrichedContext, action.params)
     - ELSE:
       - undoData := action.params  // Default: store params

  5. Execute action
     - TRY:
       - action.status := 'executing'
       - result := AWAIT capability.do(enrichedContext, validationResult.data)
       - Validate result against capability.resultSchema
     - CATCH error:
       - RETURN failure(error.message)

  6. Store undo snapshot
     - IF capability.undo is defined:
       - action.undoSnapshot := {
           timestamp: Date.now(),
           actionName: action.capabilityName,
           params: action.params,
           undoData,
           reversible: true
         }

  7. Return result
```

#### 4.3.4 Rollback Procedure

```
PROCEDURE rollback(undoStack: Stack<GluvAction>, context: GluvContext)
  REQUIRE: undoStack contains completed actions
  ENSURE: All reversible actions are undone in reverse order

  1. Initialize rollback state
     - undoneActions := []
     - failedUndos := []

  2. Process undo stack
     - WHILE undoStack is not empty:
       - action := undoStack.pop()
       - capability := registry.capabilities[action.capabilityName]

       - IF capability.undo is undefined:
         - Log warning: "Action {action.name} has no undo handler"
         - CONTINUE

       - IF NOT action.undoSnapshot.reversible:
         - Log warning: "Action {action.name} marked as irreversible"
         - CONTINUE

       - TRY:
         - result := AWAIT capability.undo(context, action.undoSnapshot)
         - IF result.success:
           - action.status := 'undone'
           - undoneActions.push(action)
         - ELSE:
           - failedUndos.push({ action, error: result.error })
       - CATCH error:
         - failedUndos.push({ action, error: error.message })

  3. Report results
     - RETURN {
         undoneCount: undoneActions.length,
         failedCount: failedUndos.length,
         failures: failedUndos
       }
```

### 4.4 Interface Definition

#### 4.4.1 Core Gluv API

```typescript
/**
 * Creates a new Gluv instance with the provided configuration.
 */
function createGluv(config: GluvConfig): GluvInstance;

interface GluvConfig {
  /** Unique identifier for this Gluv instance */
  id?: string;

  /** Context factory - called for each action execution */
  createContext: () => Promise<GluvContext>;

  /** LLM configuration */
  llm: {
    /** Model identifier (e.g., 'gpt-4', 'claude-3-opus') */
    model: string;
    /** API configuration */
    apiKey: string;
    baseUrl?: string;
    /** Maximum tokens for planning responses */
    maxPlanningTokens?: number;
  };

  /** UI configuration */
  ui?: {
    /** Default presentation mode for action results */
    defaultPresentation?: 'inline' | 'card' | 'modal';
    /** Theme overrides */
    theme?: Partial<GluvTheme>;
  };

  /** Confirmation dialog configuration */
  confirmation?: {
    /** How long to wait for confirmation before timeout (ms) */
    timeout?: number;
    /** Default action on timeout */
    timeoutBehavior?: 'cancel' | 'proceed';
  };
}

interface GluvInstance {
  /**
   * Register a fold (agent-invokable action).
   * Returns this instance for chaining.
   */
  fold<TParams extends z.ZodType, TResult extends z.ZodType>(
    definition: FoldDefinition<TParams, TResult>
  ): GluvInstance;

  /**
   * Register an unfold (user-input collection).
   * Returns this instance for chaining.
   */
  unfold<TParams extends z.ZodType, TResult extends z.ZodType>(
    definition: UnfoldDefinition<TParams, TResult>
  ): GluvInstance;

  /**
   * Process a user message and execute resulting actions.
   */
  process(userMessage: string): Promise<ProcessResult>;

  /**
   * Undo the last N actions.
   */
  undo(count?: number): Promise<UndoResult>;

  /**
   * Get all registered capabilities.
   */
  getCapabilities(): CapabilityInfo[];

  /**
   * Get action history for the current session.
   */
  getHistory(): ActionPlan[];

  /**
   * React hook for the chat interface component.
   */
  useChatInterface(): UseChatInterfaceResult;
}

interface ProcessResult {
  /** The generated and executed plan */
  plan: ActionPlan;

  /** Final response message to display */
  response: string;

  /** Any UI components to render */
  uiComponents: React.ReactNode[];
}

interface UndoResult {
  /** Number of actions successfully undone */
  undoneCount: number;

  /** Actions that could not be undone */
  failures: Array<{
    actionName: string;
    reason: string;
  }>;
}
```

#### 4.4.2 React Integration

```typescript
/**
 * Main chat interface component.
 */
interface GluvChatInterfaceProps {
  /** The Gluv instance to use */
  gluv: GluvInstance;

  /** Placeholder text for input */
  placeholder?: string;

  /** Custom header component */
  header?: React.ReactNode;

  /** Custom footer component */
  footer?: React.ReactNode;

  /** Called when a message is sent */
  onMessageSent?: (message: string) => void;

  /** Called when an action completes */
  onActionComplete?: (action: GluvAction) => void;

  /** Custom renderer for action cards */
  renderActionCard?: (action: GluvAction) => React.ReactNode;
}

/**
 * Hook result for custom chat implementations.
 */
interface UseChatInterfaceResult {
  /** Message history */
  messages: ChatMessage[];

  /** Pending actions requiring confirmation */
  pendingConfirmations: GluvAction[];

  /** Currently executing actions */
  executingActions: GluvAction[];

  /** Send a message */
  sendMessage: (content: string) => Promise<void>;

  /** Confirm a pending action */
  confirmAction: (actionId: string) => Promise<void>;

  /** Reject a pending action */
  rejectAction: (actionId: string) => Promise<void>;

  /** Undo last action(s) */
  undo: (count?: number) => Promise<UndoResult>;

  /** Current processing state */
  isProcessing: boolean;

  /** Current error, if any */
  error: Error | null;
}
```

### 4.5 Error Handling

#### 4.5.1 Error Classification

```typescript
/**
 * Base error class for all Gluv errors.
 */
abstract class GluvError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;
  abstract readonly userMessage: string;
}

/**
 * Schema validation failed.
 */
class ValidationError extends GluvError {
  code = 'VALIDATION_ERROR';
  recoverable = true;

  constructor(
    public readonly field: string,
    public readonly constraint: string,
    public readonly value: unknown
  ) {
    super(`Validation failed for ${field}: ${constraint}`);
    this.userMessage = `Invalid ${field}: ${constraint}`;
  }
}

/**
 * Capability not found.
 */
class CapabilityNotFoundError extends GluvError {
  code = 'CAPABILITY_NOT_FOUND';
  recoverable = false;

  constructor(public readonly capabilityName: string) {
    super(`Capability "${capabilityName}" not found`);
    this.userMessage = `I don't know how to do that action.`;
  }
}

/**
 * User declined confirmation.
 */
class ConfirmationDeclinedError extends GluvError {
  code = 'CONFIRMATION_DECLINED';
  recoverable = true;

  constructor(public readonly actionName: string) {
    super(`User declined confirmation for "${actionName}"`);
    this.userMessage = `Action cancelled.`;
  }
}

/**
 * Action execution failed.
 */
class ExecutionError extends GluvError {
  code = 'EXECUTION_ERROR';

  constructor(
    public readonly actionName: string,
    public readonly cause: Error,
    public readonly recoverable: boolean = true
  ) {
    super(`Execution of "${actionName}" failed: ${cause.message}`);
    this.userMessage = `Something went wrong while ${actionName}. ${
      recoverable ? 'Please try again.' : 'Please contact support.'
    }`;
  }
}

/**
 * Undo operation failed.
 */
class UndoError extends GluvError {
  code = 'UNDO_ERROR';
  recoverable = false;

  constructor(
    public readonly actionName: string,
    public readonly reason: string
  ) {
    super(`Cannot undo "${actionName}": ${reason}`);
    this.userMessage = `Unable to undo that action: ${reason}`;
  }
}

/**
 * Circular dependency detected in action plan.
 */
class CyclicDependencyError extends GluvError {
  code = 'CYCLIC_DEPENDENCY';
  recoverable = false;

  constructor(public readonly cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
    this.userMessage = `I created an invalid plan. Let me try again.`;
  }
}
```

#### 4.5.2 Error Handling Strategy

| Error Type | Detection Point | Handling Strategy | User Communication |
|------------|-----------------|-------------------|-------------------|
| ValidationError | Schema parsing | Return to agent for correction | Show field-specific errors |
| CapabilityNotFoundError | Plan validation | Regenerate plan | "I don't know how to do that" |
| ConfirmationDeclinedError | Confirmation flow | Skip action, continue plan | "Action cancelled" |
| ExecutionError (recoverable) | Action execution | Retry up to 3 times | "Trying again..." |
| ExecutionError (fatal) | Action execution | Rollback, abort plan | "Something went wrong" |
| UndoError | Rollback | Log, continue with next | Show partial undo status |
| CyclicDependencyError | Plan validation | Regenerate with feedback | "Let me rethink this" |

### 4.6 Edge Cases

#### 4.6.1 Empty Inputs

| Scenario | Handling |
|----------|----------|
| Empty user message | Return prompt for clarification |
| Empty params object | Validate against schema; may be valid for some actions |
| Empty action plan | Respond conversationally without actions |
| No capabilities registered | Throw configuration error on startup |

#### 4.6.2 Single Action Plans

- Bypass DAG computation overhead
- Direct execution without parallel machinery
- Simplified undo (single item stack)

#### 4.6.3 Maximum Size Inputs

- Action plans limited to 50 actions
- Parameter payload limited to 1MB
- UI component tree depth limited to 10 levels
- Undo stack limited to 100 actions (oldest pruned)

#### 4.6.4 Malformed Inputs

| Input Type | Validation | Response |
|------------|------------|----------|
| Invalid JSON params | Zod schema parsing | ValidationError with details |
| XSS in user message | Sanitization before display | Escaped output |
| SQL injection in params | Parameterized queries in adapters | Query fails safely |
| Oversized payload | Size check before processing | 413 Payload Too Large |

#### 4.6.5 Concurrent Access

- Each GluvInstance maintains isolated state
- Context factory creates request-scoped resources
- Database adapters must handle connection pooling
- Action plans are immutable after creation; new plans for new requests

#### 4.6.6 Resource Exhaustion

| Resource | Limit | Behavior on Exhaustion |
|----------|-------|------------------------|
| LLM tokens | Configurable max | Truncate context, retry |
| Memory (undo stack) | 100 actions | FIFO eviction of oldest |
| Concurrent actions | 10 parallel | Queue excess |
| Execution time | 30s per action | Timeout error, rollback |

## 5. Implementation Guide

### 5.1 Prerequisites

#### 5.1.1 Required Dependencies

```json
{
  "dependencies": {
    "zod": "^3.22.0",
    "react": "^18.2.0",
    "react-hook-form": "^7.48.0",
    "@hookform/resolvers": "^3.3.0"
  },
  "peerDependencies": {
    "openai": "^4.0.0"
  }
}
```

#### 5.1.2 Development Dependencies

```json
{
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "msw": "^2.0.0"
  }
}
```

#### 5.1.3 Required Knowledge

- TypeScript generics and type inference
- Zod schema composition
- React hooks and context
- Async/await and Promise handling
- Basic graph algorithms (for understanding coordinator)

### 5.2 Implementation Order

```
Phase 1: Core Infrastructure (Week 1-2)
├── 1.1 Define all TypeScript interfaces
├── 1.2 Implement Zod schema utilities
│   ├── Schema to JSON Schema converter
│   └── Schema validation wrapper
├── 1.3 Implement CapabilityRegistry
│   ├── Registration methods
│   ├── Lookup methods
│   └── Tool schema generation
└── 1.4 Implement GluvContext factory

Phase 2: Execution Engine (Week 2-3)
├── 2.1 Implement ActionPlan builder
├── 2.2 Implement DAG construction and validation
│   ├── Topological sort
│   └── Cycle detection
├── 2.3 Implement ActionCoordinator
│   ├── Sequential execution
│   ├── Parallel execution
│   └── Mixed execution
└── 2.4 Implement UndoManager
    ├── Snapshot capture
    └── Rollback procedure

Phase 3: LLM Integration (Week 3-4)
├── 3.1 Implement tool schema generation
├── 3.2 Implement planning prompt templates
├── 3.3 Implement response parser
└── 3.4 Implement agent loop

Phase 4: UI Layer (Week 4-5)
├── 4.1 Implement GluvChatInterface component
├── 4.2 Implement message rendering
├── 4.3 Implement inline UI mounting
├── 4.4 Implement confirmation dialogs
└── 4.5 Implement form integration for unfolds

Phase 5: Polish and Testing (Week 5-6)
├── 5.1 Error handling refinement
├── 5.2 Performance optimization
├── 5.3 Documentation
└── 5.4 Example applications
```

### 5.3 Testing Strategy

#### 5.3.1 Unit Tests

```typescript
// Example: Capability registration
describe('CapabilityRegistry', () => {
  it('should register a fold capability', () => {
    const registry = new CapabilityRegistry();
    const fold = {
      name: 'testAction',
      description: 'A test action',
      type: 'action-idempotent',
      paramsSchema: z.object({ id: z.string() }),
      resultSchema: z.object({ success: z.boolean() }),
      do: async () => ({ status: 'success', data: { success: true } })
    };

    registry.registerFold(fold);

    expect(registry.hasCapability('testAction')).toBe(true);
    expect(registry.getCapability('testAction').kind).toBe('fold');
  });

  it('should reject duplicate capability names', () => {
    const registry = new CapabilityRegistry();
    const fold = { name: 'duplicate', /* ... */ };

    registry.registerFold(fold);

    expect(() => registry.registerFold(fold))
      .toThrow('Capability "duplicate" already registered');
  });
});
```

#### 5.3.2 Integration Tests

```typescript
// Example: Action execution with undo
describe('ActionCoordinator', () => {
  it('should execute and undo a constructive action', async () => {
    const gluv = createTestGluv();
    const items: string[] = [];

    gluv.fold({
      name: 'addItem',
      type: 'action-constructive',
      paramsSchema: z.object({ item: z.string() }),
      resultSchema: z.object({ added: z.boolean() }),
      do: async (ctx, { item }) => {
        items.push(item);
        return { status: 'success', data: { added: true } };
      },
      undo: async (ctx, snapshot) => {
        const idx = items.indexOf(snapshot.params.item);
        if (idx >= 0) items.splice(idx, 1);
        return { success: true };
      }
    });

    await gluv.process('Add "test" to items');
    expect(items).toContain('test');

    await gluv.undo();
    expect(items).not.toContain('test');
  });
});
```

#### 5.3.3 Performance Benchmarks

| Benchmark | Target | Methodology |
|-----------|--------|-------------|
| Registration throughput | 1000 capabilities/10ms | Register in loop, measure total |
| Plan generation latency | < 500ms (excluding LLM) | Mock LLM, measure framework overhead |
| Action execution overhead | < 5ms per action | Time wrapper vs direct call |
| Undo stack operations | < 1ms push/pop | Measure at 100-item stack |
| UI render latency | < 16ms (60fps) | React profiler, measure mount time |

### 5.4 Common Pitfalls

#### 5.4.1 Schema Definition Errors

```typescript
// WRONG: Using z.infer in definition (evaluated too early)
fold({
  paramsSchema: z.object({ id: z.string() }),
  do: async (ctx, params: z.infer<typeof paramsSchema>) => { // Error!
    // ...
  }
});

// CORRECT: Let type inference work
fold({
  paramsSchema: z.object({ id: z.string() }),
  do: async (ctx, params) => { // Type is inferred
    // params.id is typed as string
  }
});
```

#### 5.4.2 Undo Data Capture

```typescript
// WRONG: Not capturing original state
fold({
  name: 'updateQuantity',
  do: async (ctx, { itemId, newQuantity }) => {
    await ctx.db.execute('UPDATE cart SET qty = ? WHERE id = ?', [newQuantity, itemId]);
    return { status: 'success', data: { updated: true } };
  },
  undo: async (ctx, snapshot) => {
    // How do we know the old quantity?! This will fail.
    return { success: false };
  }
});

// CORRECT: Capture original state before modification
fold({
  name: 'updateQuantity',
  captureUndoData: async (ctx, { itemId }) => {
    const [item] = await ctx.db.query('SELECT qty FROM cart WHERE id = ?', [itemId]);
    return { originalQuantity: item.qty };
  },
  do: async (ctx, { itemId, newQuantity }) => {
    await ctx.db.execute('UPDATE cart SET qty = ? WHERE id = ?', [newQuantity, itemId]);
    return { status: 'success', data: { updated: true } };
  },
  undo: async (ctx, snapshot) => {
    await ctx.db.execute(
      'UPDATE cart SET qty = ? WHERE id = ?',
      [snapshot.undoData.originalQuantity, snapshot.params.itemId]
    );
    return { success: true };
  }
});
```

#### 5.4.3 Context Scoping

```typescript
// WRONG: Sharing mutable context between actions
const sharedContext = { counter: 0 };
gluv.fold({
  do: async () => {
    sharedContext.counter++; // Race condition!
    return { status: 'success', data: {} };
  }
});

// CORRECT: Use context factory for isolation
createGluv({
  createContext: async () => ({
    // Fresh context per request
    requestId: generateId(),
    // Shared resources are accessed via proper patterns
    db: await getPooledConnection()
  })
});
```

#### 5.4.4 Async/Await in UI Components

```typescript
// WRONG: Async operations in render
unfold({
  ui: async (form) => { // Can't be async!
    const data = await fetchData();
    return <Form data={data} />;
  }
});

// CORRECT: Use hooks for async data
unfold({
  ui: (form, context) => {
    // Data is pre-loaded in context or fetched via hooks
    return <Form data={context.services.get('preloadedData')} />;
  }
});
```

## 6. Performance Characteristics

### 6.1 Complexity Analysis

#### 6.1.1 Capability Registration

- **Time**: O(1) amortized for registration
- **Space**: O(c) where c = number of capabilities
- **Tool Schema Generation**: O(s) where s = schema complexity (number of fields)

#### 6.1.2 Plan Generation

- **DAG Construction**: O(n + e) where n = actions, e = dependencies
- **Cycle Detection**: O(n + e) using DFS
- **Topological Sort**: O(n + e) using Kahn's algorithm
- **Total**: O(n + e), dominated by graph operations

#### 6.1.3 Plan Execution

- **Sequential Execution**: O(n * a) where a = average action time
- **Parallel Execution**: O(d * a) where d = DAG depth
- **Best Case**: O(a) when all actions are independent (depth = 1)
- **Worst Case**: O(n * a) when all actions are sequential (depth = n)

#### 6.1.4 Undo Operations

- **Single Undo**: O(u) where u = undo handler complexity
- **Full Rollback**: O(n * u) for n actions

### 6.2 Benchmarking Methodology

```typescript
// Performance test harness
class GluvBenchmark {
  async measureRegistration(count: number): Promise<number> {
    const start = performance.now();
    const gluv = createGluv(testConfig);

    for (let i = 0; i < count; i++) {
      gluv.fold(generateTestFold(i));
    }

    return performance.now() - start;
  }

  async measureExecution(planSize: number, parallelism: number): Promise<{
    planningTime: number;
    executionTime: number;
    actionsPerSecond: number;
  }> {
    const gluv = createBenchmarkGluv(parallelism);
    const plan = generateTestPlan(planSize, parallelism);

    const planStart = performance.now();
    // ... planning
    const planEnd = performance.now();

    const execStart = performance.now();
    await gluv.executePlan(plan);
    const execEnd = performance.now();

    return {
      planningTime: planEnd - planStart,
      executionTime: execEnd - execStart,
      actionsPerSecond: planSize / ((execEnd - execStart) / 1000)
    };
  }
}
```

### 6.3 Expected Performance

| Scenario | Input Size | Expected Latency | Notes |
|----------|------------|------------------|-------|
| Simple action (no deps) | 1 action | 10-50ms | Dominated by LLM response |
| Small plan | 5 actions, depth 2 | 100-200ms | 2-3 parallel batches |
| Medium plan | 20 actions, depth 5 | 300-500ms | Good parallelization |
| Complex plan | 50 actions, depth 10 | 800-1200ms | Near limit |
| Full undo | 10 actions | 50-100ms | Sequential by nature |

### 6.4 Optimization Opportunities

1. **Schema Caching**: Pre-compile Zod schemas to avoid repeated parsing
2. **Connection Pooling**: Reuse database connections across actions
3. **Lazy Tool Schema**: Generate LLM tool schemas on demand
4. **Undo Stack Pruning**: Compress old undo entries by merging related actions
5. **UI Virtualization**: For long action histories, virtualize the message list
6. **Streaming Results**: Stream action results to UI as they complete

## 7. Security Considerations

### 7.1 Sensitive Data Handling

#### 7.1.1 Payment Information

```typescript
// Payment collection with proper security
gluv.unfold({
  name: 'collectPaymentMethod',
  type: 'ui-collect',
  visibility: {
    llmCanSeeData: false,           // LLM never sees card numbers
    llmFeedback: 'summary',         // "Card ending in 4242 added"
    redactedFields: ['cardNumber', 'cvv', 'expiryDate']
  },
  paramsSchema: z.object({
    amount: z.number(),
    currency: z.string()
  }),
  resultSchema: z.object({
    success: z.boolean(),
    lastFour: z.string().optional()
  }),
  ui: (form) => (
    <SecurePaymentForm form={form} />  // PCI-compliant iframe
  ),
  do: async (ctx, values) => {
    // Values go directly to payment processor
    // Never logged, never sent to LLM
    const token = await ctx.services.get('stripe').createToken(values);
    return {
      status: 'success',
      data: { success: true, lastFour: values.cardNumber.slice(-4) }
    };
  },
  undo: undefined  // Payments cannot be undone through this flow
});
```

#### 7.1.2 Credential Collection

```typescript
// API key collection
gluv.unfold({
  name: 'collectApiKey',
  type: 'ui-collect',
  visibility: {
    llmCanSeeData: false,
    llmFeedback: 'success-only',
    redactedFields: ['apiKey']
  },
  ui: (form) => (
    <div>
      <input
        type="password"
        {...form.register('apiKey')}
        autoComplete="off"
      />
    </div>
  ),
  do: async (ctx, { apiKey }) => {
    // Validate and store encrypted
    const encrypted = await ctx.services.get('crypto').encrypt(apiKey);
    await ctx.db.execute(
      'INSERT INTO api_keys (user_id, encrypted_key) VALUES (?, ?)',
      [ctx.auth.userId, encrypted]
    );
    return { status: 'success', data: { stored: true } };
  }
});
```

### 7.2 Permission Model

```typescript
interface CapabilityPermission {
  /** Required roles to invoke this capability */
  requiredRoles?: string[];

  /** Required permissions to invoke this capability */
  requiredPermissions?: string[];

  /** Custom authorization function */
  authorize?: (context: GluvContext, params: unknown) => Promise<boolean>;
}

// Example: Role-based capability access
gluv.fold({
  name: 'deleteUser',
  type: 'action-destructive',
  requireConfirm: true,
  permissions: {
    requiredRoles: ['admin'],
    authorize: async (ctx, params) => {
      // Admins can't delete themselves
      return params.userId !== ctx.auth.userId;
    }
  },
  // ...
});
```

### 7.3 Input Sanitization

All user inputs are sanitized at multiple levels:

1. **Schema Validation**: Zod schemas enforce type and format constraints
2. **HTML Escaping**: User messages are escaped before rendering
3. **SQL Parameterization**: Database adapters must use parameterized queries
4. **XSS Prevention**: React's default escaping protects rendered content
5. **Audit Logging**: All actions are logged with sanitized parameters

### 7.4 Threat Model

| Threat | Mitigation |
|--------|------------|
| Prompt injection via user input | LLM instructions emphasize ignoring instructions in user content |
| Sensitive data leakage to LLM | Visibility controls, redacted fields |
| Unauthorized action execution | Permission model, confirmation flows |
| Replay attacks | Action IDs are unique, context is request-scoped |
| Undo abuse | Undo limited to user's own actions, audit logged |
| Resource exhaustion | Rate limiting, payload size limits |

## 8. Operational Considerations

### 8.1 Monitoring

#### 8.1.1 Key Metrics

| Metric | Type | Description | Alert Threshold |
|--------|------|-------------|-----------------|
| `gluv.actions.executed` | Counter | Total actions executed | N/A |
| `gluv.actions.failed` | Counter | Failed action count | > 5% of executed |
| `gluv.plans.generated` | Counter | Plans generated | N/A |
| `gluv.plans.execution_time` | Histogram | Plan execution latency | p99 > 5s |
| `gluv.undo.performed` | Counter | Undo operations | Spike detection |
| `gluv.confirmations.declined` | Counter | User-declined confirmations | > 20% of prompts |
| `gluv.llm.tokens_used` | Counter | LLM token consumption | Budget threshold |
| `gluv.errors.by_type` | Counter | Errors by classification | Any spike |

#### 8.1.2 Tracing

```typescript
// Action execution span
{
  traceId: "abc123",
  spanId: "def456",
  name: "gluv.action.execute",
  attributes: {
    "gluv.action.name": "addToCart",
    "gluv.action.type": "action-constructive",
    "gluv.plan.id": "plan_789",
    "gluv.action.sequence": 2,
    "user.id": "user_123"
  },
  duration: 45,  // ms
  status: "OK"
}
```

### 8.2 Alerting

| Condition | Severity | Action |
|-----------|----------|--------|
| Action failure rate > 5% | Warning | Investigate failing actions |
| Plan execution p99 > 5s | Warning | Check LLM latency, action performance |
| Undo rate > 10% | Info | Review action accuracy |
| Confirmation decline > 30% | Warning | Review confirmation UX |
| Any EXECUTION_ERROR (non-recoverable) | Error | Immediate investigation |
| LLM budget > 80% | Warning | Review token usage patterns |

### 8.3 Debugging

#### 8.3.1 Debug Mode

```typescript
const gluv = createGluv({
  debug: {
    enabled: process.env.NODE_ENV === 'development',
    logLevel: 'trace',
    includeStackTraces: true,
    captureSnapshots: true,  // Capture full state at each step
    mockLlm: process.env.MOCK_LLM === 'true'
  }
});
```

#### 8.3.2 Action Replay

```typescript
// Replay a specific action for debugging
const replay = await gluv.debug.replayAction({
  planId: 'plan_123',
  actionId: 'action_456',
  mockContext: {
    // Override context for testing
  }
});

console.log(replay.result);
console.log(replay.timeline);  // Step-by-step execution log
```

#### 8.3.3 Common Issues

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| "Unknown capability" errors | Capability not registered before use | Ensure registration in initialization |
| Schema validation failures | LLM generating incorrect params | Improve parameter descriptions |
| Undo not working | captureUndoData not implemented | Add undo data capture |
| UI not rendering | Result missing ui field | Return ui in FoldResult |
| Slow plan execution | Too many sequential dependencies | Review action dependencies |

## 9. Migration Plan

### 9.1 From Manual Tool Implementation

```typescript
// Before: Manual tool handling
const tools = {
  addToCart: async (params) => {
    // Validation
    if (!params.productId) throw new Error('Missing productId');
    // Execution
    await db.insertToCart(params);
    // No undo, no UI, no confirmation
    return { success: true };
  }
};

// After: Gluv fold
gluv.fold({
  name: 'addToCart',
  description: 'Add a product to the shopping cart',
  type: 'action-constructive',
  paramsSchema: z.object({
    productId: z.string().describe('Product ID to add'),
    quantity: z.number().int().positive().default(1)
  }),
  resultSchema: z.object({
    success: z.boolean(),
    cartItemId: z.string()
  }),
  do: async (ctx, params) => {
    const result = await ctx.db.insertToCart(params);
    return {
      status: 'success',
      data: { success: true, cartItemId: result.id },
      ui: <CartItemAdded item={result} />
    };
  },
  captureUndoData: async (ctx, params) => ({}),
  undo: async (ctx, snapshot) => {
    await ctx.db.removeFromCart(snapshot.params.productId);
    return { success: true };
  }
});
```

### 9.2 Migration Steps

1. **Audit existing tools**: List all current AI-invokable functions
2. **Classify actions**: Assign action types (constructive/destructive/idempotent)
3. **Design schemas**: Convert parameter validation to Zod schemas
4. **Implement folds**: Port each tool to fold format
5. **Add undo handlers**: Implement reversibility where possible
6. **Create unfolds**: Identify user-input collection points
7. **Integrate UI**: Add result UI components
8. **Test thoroughly**: Verify behavior matches original
9. **Gradual rollout**: Enable for subset of users first

## 10. Open Questions

1. **Multi-step transactions**: Should Gluv provide built-in support for database transactions spanning multiple actions, or leave this to the context implementation?

2. **Streaming results**: How should long-running actions stream progress updates to the UI? WebSockets? Server-Sent Events? Polling?

3. **Capability versioning**: How do we handle breaking changes to capability schemas? Version numbers? Migration scripts?

4. **Cross-session undo**: Should undo work across browser sessions if the user returns later? How do we handle stale undo data?

5. **Multi-agent coordination**: If multiple agents are working on the same application state, how do we prevent conflicts?

6. **Partial plan approval**: Should users be able to approve/reject individual actions within a plan, or only the entire plan?

7. **Natural language undo**: Should "undo that" or "cancel the last thing" trigger automatic undo detection, or require explicit undo invocation?

## 11. References

1. **Model Context Protocol (MCP)**: https://modelcontextprotocol.io/
2. **Zod Documentation**: https://zod.dev/
3. **React Hook Form**: https://react-hook-form.com/
4. **Vercel AI SDK**: https://sdk.vercel.ai/docs
5. **LangChain Tools**: https://python.langchain.com/docs/modules/agents/tools/
6. **Command Pattern**: Gamma et al., "Design Patterns", 1994
7. **Saga Pattern for Distributed Transactions**: Garcia-Molina & Salem, 1987

---

## Appendices

### Appendix A: Worked Examples

#### A.1 E-Commerce Cart Flow

**User request**: "Add the blue widget to my cart and apply the SAVE20 coupon"

**Generated plan**:
```json
{
  "id": "plan_abc123",
  "reasoning": "User wants to add a product and apply a discount. The coupon can only be applied after the cart has items, so these must be sequential.",
  "actions": [
    {
      "id": "action_1",
      "sequence": 1,
      "title": "Add Blue Widget to Cart",
      "capabilityName": "addToCart",
      "params": { "productId": "widget_blue_001", "quantity": 1 },
      "blockedBy": [],
      "blocks": ["action_2"]
    },
    {
      "id": "action_2",
      "sequence": 2,
      "title": "Apply SAVE20 Coupon",
      "capabilityName": "applyCoupon",
      "params": { "code": "SAVE20" },
      "blockedBy": ["action_1"],
      "blocks": []
    }
  ]
}
```

**Execution trace**:
```
t=0ms    Plan execution started
t=5ms    action_1: Status -> executing
t=45ms   action_1: addToCart completed successfully
         Result: { cartItemId: "item_xyz", productName: "Blue Widget", price: 29.99 }
         UI: <CartItemCard> rendered in chat
t=50ms   action_2: Status -> executing (no longer blocked)
t=85ms   action_2: applyCoupon completed successfully
         Result: { applied: true, discount: 6.00, newTotal: 23.99 }
         UI: <CouponApplied> rendered in chat
t=90ms   Plan execution completed
```

#### A.2 Payment Collection Flow

**User request**: "I'd like to checkout"

**Generated plan**:
```json
{
  "id": "plan_def456",
  "reasoning": "User wants to checkout. This requires collecting payment information (unfold) and then processing the order.",
  "actions": [
    {
      "id": "action_1",
      "sequence": 1,
      "title": "Collect Payment Information",
      "capabilityName": "collectPaymentMethod",
      "params": { "amount": 23.99, "currency": "USD" },
      "blockedBy": [],
      "blocks": ["action_2"]
    },
    {
      "id": "action_2",
      "sequence": 2,
      "title": "Process Order",
      "capabilityName": "processOrder",
      "params": {},
      "blockedBy": ["action_1"],
      "blocks": []
    }
  ]
}
```

**Execution trace**:
```
t=0ms    Plan execution started
t=5ms    action_1: Status -> executing
         action_1 is an unfold - rendering payment form in chat
t=5ms    Waiting for user to complete payment form...

[User fills in card details in secure iframe]
[User clicks "Pay $23.99"]

t=15000ms action_1: Form submitted, processing payment token
          (Card details never touch Gluv - handled by Stripe iframe)
t=15500ms action_1: collectPaymentMethod completed
          Result: { success: true, lastFour: "4242" }
          LLM receives: "Payment method added successfully"
          (LLM does NOT see card number, CVV, or expiry)
t=15505ms action_2: Status -> executing
t=16000ms action_2: processOrder requires confirmation (destructive action)
          Confirmation dialog: "Process order for $23.99?"

[User clicks "Confirm"]

t=18000ms action_2: Processing order...
t=19000ms action_2: processOrder completed
          Result: { orderId: "order_789", estimatedDelivery: "2024-01-15" }
          UI: <OrderConfirmation> rendered in chat
t=19005ms Plan execution completed
```

### Appendix B: Proof of Correctness

#### B.1 DAG Execution Correctness

**Theorem**: If the action plan forms a valid DAG (no cycles), the dependency-aware execution algorithm will:
1. Execute all actions exactly once
2. Never execute an action before its dependencies complete
3. Complete in finite time

**Proof**:

1. **All actions executed exactly once**:
   - Each action starts in `pending` state
   - Actions are added to `executableSet` only when all `blockedBy` are completed
   - Actions are removed from `executableSet` after execution
   - The loop continues until `executableSet` is empty
   - Since the graph is a DAG, every node is eventually reachable via topological ordering
   - Therefore, every action is eventually executed exactly once

2. **Dependency ordering preserved**:
   - An action enters `executableSet` only when all `blockedBy` actions are in `completedActions`
   - `completedActions` only contains actions that have finished execution
   - Therefore, an action never executes before its dependencies

3. **Finite termination**:
   - Each iteration moves at least one action from `pending` to `completed` or `failed`
   - The number of actions is finite
   - No action can return to `pending` after leaving it
   - Therefore, the loop terminates after at most n iterations (where n = action count)

**QED**

#### B.2 Undo Correctness

**Theorem**: For reversible actions, the rollback procedure restores system state to before the plan execution.

**Proof sketch**:
- Each action's `captureUndoData` captures state before modification
- The undo stack maintains LIFO ordering
- Rollback processes actions in reverse order
- Each undo operation uses captured state to restore previous state
- By induction, after undoing all actions, state matches pre-execution state

**Caveats**:
- External side effects (emails sent, external API calls) may not be reversible
- Actions marked `irreversible` are skipped (by design)
- Concurrent modifications from outside Gluv are not accounted for

### Appendix C: Alternative Approaches Considered

#### C.1 Event Sourcing for Undo

**Description**: Instead of explicit undo handlers, store all state changes as events and replay to any point in time.

**Analysis**:
- Pros: Perfect reversibility, complete audit trail
- Cons: Requires event-sourced architecture throughout the application; significant complexity increase; storage overhead
- Decision: Rejected as too invasive; hybrid approach preferred for flexibility

#### C.2 React Server Components for UI

**Description**: Use React Server Components for capability UI rendering, allowing server-side rendering of results.

**Analysis**:
- Pros: Better initial load performance, reduced client bundle
- Cons: Limited interactivity in results, framework coupling (Next.js), streaming complexity
- Decision: Deferred; may revisit for v2

#### C.3 GraphQL for Action Coordination

**Description**: Model capabilities as GraphQL mutations and use GraphQL for the agent-framework communication.

**Analysis**:
- Pros: Rich type system, built-in schema documentation, existing tooling
- Cons: Overhead for simple actions, additional learning curve, doesn't solve undo
- Decision: Rejected; Zod schemas provide sufficient typing with less overhead

#### C.4 Web Workers for Action Execution

**Description**: Execute actions in Web Workers to prevent blocking the main thread.

**Analysis**:
- Pros: Non-blocking UI, parallelism, crash isolation
- Cons: Serialization overhead, cannot access DOM (for UI), complex communication
- Decision: Deferred; may use for computationally intensive actions in v2
