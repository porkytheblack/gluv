import type { z } from 'zod'
import type {
  CapabilityDefinition,
  FoldDefinition,
  UnfoldDefinition,
  GluvContext,
  CapabilityPermission,
} from './types'
import { CapabilityNotFoundError, PermissionDeniedError } from './errors'

// ============================================================================
// Tool Schema Generation
// ============================================================================

/**
 * JSON Schema representation for LLM tool calling.
 */
export interface ToolSchema {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

/**
 * Stored capability with metadata.
 */
export interface StoredCapability<
  TParams extends z.ZodType = z.ZodType,
  TResult extends z.ZodType = z.ZodType,
> {
  kind: 'fold' | 'unfold'
  definition: CapabilityDefinition<TParams, TResult>
  toolSchema: ToolSchema
  registeredAt: number
}

/**
 * Convert a Zod schema to a JSON Schema for LLM tool calling.
 */
function zodToJsonSchema(schema: z.ZodType): {
  type: string
  properties: Record<string, unknown>
  required: string[]
} {
  // Handle ZodObject specifically
  const typeName = (schema as { _def?: { typeName?: string } })._def?.typeName

  if (typeName === 'ZodObject') {
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape
    const properties: Record<string, unknown> = {}
    const required: string[] = []

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodType
      const fieldDef = fieldSchema._def as {
        typeName?: string
        description?: string
        innerType?: z.ZodType
      }

      // Check if optional
      const isOptional = fieldDef.typeName === 'ZodOptional'
      const innerSchema = isOptional ? fieldDef.innerType : fieldSchema
      const innerDef = (innerSchema as { _def?: { typeName?: string; description?: string } })
        ?._def

      // Get base type
      let jsonType: unknown = { type: 'string' }

      switch (innerDef?.typeName) {
        case 'ZodString':
          jsonType = { type: 'string' }
          break
        case 'ZodNumber':
          jsonType = { type: 'number' }
          break
        case 'ZodBoolean':
          jsonType = { type: 'boolean' }
          break
        case 'ZodArray':
          jsonType = { type: 'array', items: { type: 'string' } }
          break
        case 'ZodEnum': {
          const enumValues = (innerDef as { values?: string[] }).values
          jsonType = { type: 'string', enum: enumValues }
          break
        }
        case 'ZodObject':
          jsonType = zodToJsonSchema(innerSchema as z.ZodType)
          break
        default:
          jsonType = { type: 'string' }
      }

      // Add description if present
      const description = innerDef?.description || fieldDef.description
      if (description) {
        ;(jsonType as Record<string, unknown>).description = description
      }

      properties[key] = jsonType

      if (!isOptional) {
        required.push(key)
      }
    }

    return { type: 'object', properties, required }
  }

  // Default fallback
  return { type: 'object', properties: {}, required: [] }
}

/**
 * Generate tool schema for a capability.
 */
function generateToolSchema(definition: CapabilityDefinition): ToolSchema {
  const { type, properties, required } = zodToJsonSchema(definition.paramsSchema)

  return {
    name: definition.name,
    description: definition.description,
    parameters: {
      type: type as 'object',
      properties,
      required,
    },
  }
}

// ============================================================================
// Capability Registry
// ============================================================================

/**
 * Registry for managing capabilities.
 */
export class CapabilityRegistry {
  private readonly capabilities = new Map<string, StoredCapability>()

  /**
   * Name validation pattern.
   */
  private readonly NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/

  /**
   * Validate capability name.
   */
  private validateName(name: string): void {
    if (!this.NAME_PATTERN.test(name)) {
      throw new Error(
        `Invalid capability name "${name}". Must start with a letter and contain only letters, numbers, and underscores.`
      )
    }
  }

  /**
   * Register a fold capability.
   */
  registerFold<TParams extends z.ZodType, TResult extends z.ZodType>(
    definition: Omit<FoldDefinition<TParams, TResult>, 'kind'>
  ): void {
    this.validateName(definition.name)

    if (this.capabilities.has(definition.name)) {
      throw new Error(`Capability "${definition.name}" already registered`)
    }

    // Set defaults based on action type
    const fullDefinition: FoldDefinition<TParams, TResult> = {
      ...definition,
      kind: 'fold',
      requireConfirm:
        definition.requireConfirm ??
        (definition.type === 'action-destructive' ? true : false),
      llmVisible: definition.llmVisible ?? true,
    }

    const toolSchema = generateToolSchema(fullDefinition)

    this.capabilities.set(definition.name, {
      kind: 'fold',
      definition: fullDefinition,
      toolSchema,
      registeredAt: Date.now(),
    })
  }

  /**
   * Register an unfold capability.
   */
  registerUnfold<TParams extends z.ZodType, TResult extends z.ZodType>(
    definition: Omit<UnfoldDefinition<TParams, TResult>, 'kind'>
  ): void {
    this.validateName(definition.name)

    if (this.capabilities.has(definition.name)) {
      throw new Error(`Capability "${definition.name}" already registered`)
    }

    const fullDefinition: UnfoldDefinition<TParams, TResult> = {
      ...definition,
      kind: 'unfold',
      requireConfirm: definition.requireConfirm ?? false,
      llmVisible: definition.llmVisible ?? true,
    }

    const toolSchema = generateToolSchema(fullDefinition)

    this.capabilities.set(definition.name, {
      kind: 'unfold',
      definition: fullDefinition,
      toolSchema,
      registeredAt: Date.now(),
    })
  }

  /**
   * Check if a capability exists.
   */
  hasCapability(name: string): boolean {
    return this.capabilities.has(name)
  }

  /**
   * Get a capability by name.
   */
  getCapability(name: string): StoredCapability {
    const capability = this.capabilities.get(name)
    if (!capability) {
      throw new CapabilityNotFoundError(name)
    }
    return capability
  }

  /**
   * Get all capabilities.
   */
  getAllCapabilities(): StoredCapability[] {
    return Array.from(this.capabilities.values())
  }

  /**
   * Get all LLM-visible capabilities.
   */
  getLLMVisibleCapabilities(): StoredCapability[] {
    return this.getAllCapabilities().filter((c) => c.definition.llmVisible !== false)
  }

  /**
   * Get capabilities by tags.
   */
  getCapabilitiesByTags(tags: string[]): StoredCapability[] {
    return this.getAllCapabilities().filter(
      (c) => c.definition.tags?.some((t) => tags.includes(t))
    )
  }

  /**
   * Get all tool schemas for LLM.
   */
  getToolSchemas(): ToolSchema[] {
    return this.getLLMVisibleCapabilities().map((c) => c.toolSchema)
  }

  /**
   * Filter capabilities by user permissions.
   */
  async getAuthorizedCapabilities(context: GluvContext): Promise<StoredCapability[]> {
    const authorized: StoredCapability[] = []

    for (const capability of this.getLLMVisibleCapabilities()) {
      const permissions = capability.definition.permissions
      if (await this.checkPermission(context, permissions)) {
        authorized.push(capability)
      }
    }

    return authorized
  }

  /**
   * Check if context has permission for a capability.
   */
  async checkPermission(
    context: GluvContext,
    permissions?: CapabilityPermission,
    params?: unknown
  ): Promise<boolean> {
    if (!permissions) {
      return true
    }

    // Check required roles
    if (permissions.requiredRoles?.length) {
      const hasRole = permissions.requiredRoles.some((role) => context.auth.roles.includes(role))
      if (!hasRole) {
        return false
      }
    }

    // Check required permissions
    if (permissions.requiredPermissions?.length) {
      const hasPermission = permissions.requiredPermissions.every((perm) =>
        context.auth.permissions.includes(perm)
      )
      if (!hasPermission) {
        return false
      }
    }

    // Check custom authorization
    if (permissions.authorize) {
      return permissions.authorize(context, params)
    }

    return true
  }

  /**
   * Authorize and get capability, throwing if not permitted.
   */
  async getAuthorizedCapability(
    name: string,
    context: GluvContext,
    params?: unknown
  ): Promise<StoredCapability> {
    const capability = this.getCapability(name)
    const permissions = capability.definition.permissions

    const authorized = await this.checkPermission(context, permissions, params)
    if (!authorized) {
      throw new PermissionDeniedError(name, 'Insufficient permissions')
    }

    return capability
  }

  /**
   * Remove a capability.
   */
  unregister(name: string): boolean {
    return this.capabilities.delete(name)
  }

  /**
   * Clear all capabilities.
   */
  clear(): void {
    this.capabilities.clear()
  }

  /**
   * Get capability count.
   */
  get size(): number {
    return this.capabilities.size
  }
}
