import type {
  GluvContext,
  AuthInfo,
  DatabaseAdapter,
  ServiceContainer,
} from './types'

// ============================================================================
// Default Implementations
// ============================================================================

/**
 * Create a no-op database adapter.
 */
export function createNoopDatabaseAdapter(): DatabaseAdapter {
  return {
    async query<T>(): Promise<T[]> {
      throw new Error('Database adapter not configured')
    },
    async execute() {
      throw new Error('Database adapter not configured')
    },
    async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
      return fn(this)
    },
  }
}

/**
 * Create a simple in-memory service container.
 */
export function createServiceContainer(): ServiceContainer {
  const services = new Map<string, unknown>()

  return {
    get<T>(serviceName: string): T {
      const service = services.get(serviceName)
      if (service === undefined) {
        throw new Error(`Service "${serviceName}" not found`)
      }
      return service as T
    },
    has(serviceName: string): boolean {
      return services.has(serviceName)
    },
    register<T>(serviceName: string, service: T): void {
      services.set(serviceName, service)
    },
  }
}

/**
 * Create anonymous auth info.
 */
export function createAnonymousAuth(): AuthInfo {
  return {
    userId: 'anonymous',
    sessionId: 'anonymous',
    roles: [],
    permissions: [],
  }
}

// ============================================================================
// Context Factory
// ============================================================================

export interface ContextFactoryConfig {
  auth?: AuthInfo | (() => Promise<AuthInfo>)
  db?: DatabaseAdapter | (() => Promise<DatabaseAdapter>)
  services?: ServiceContainer | (() => Promise<ServiceContainer>)
  audit?: (action: string, details: Record<string, unknown>) => void
  emit?: (event: string, data: unknown) => void
}

/**
 * Create a context factory function.
 */
export function createContextFactory(
  config: ContextFactoryConfig = {}
): () => Promise<GluvContext> {
  return async () => {
    const auth =
      typeof config.auth === 'function'
        ? await config.auth()
        : config.auth ?? createAnonymousAuth()

    const db =
      typeof config.db === 'function'
        ? await config.db()
        : config.db ?? createNoopDatabaseAdapter()

    const services =
      typeof config.services === 'function'
        ? await config.services()
        : config.services ?? createServiceContainer()

    const actionResults = new Map<string, unknown>()

    const context: GluvContext = {
      auth,
      db,
      services,
      getActionResult<T>(actionId: string): T {
        const result = actionResults.get(actionId)
        if (result === undefined) {
          throw new Error(`Action "${actionId}" not found or not completed`)
        }
        return result as T
      },
      emit: config.emit ?? (() => {}),
      audit: config.audit ?? (() => {}),
    }

    return context
  }
}

// ============================================================================
// Context Utilities
// ============================================================================

/**
 * Create a context with additional services.
 */
export function extendContext(
  base: GluvContext,
  extensions: Partial<Omit<GluvContext, 'getActionResult' | 'emit' | 'audit'>>
): GluvContext {
  return {
    ...base,
    ...extensions,
  }
}

/**
 * Create a read-only view of the context.
 */
export function readonlyContext(context: GluvContext): Readonly<GluvContext> {
  return Object.freeze({ ...context })
}
