import React, { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Gluv, ActionPlan, GluvEvent } from '@gluv/core'

// ============================================================================
// Context Definition
// ============================================================================

export interface GluvContextValue {
  gluv: Gluv
}

const GluvReactContext = createContext<GluvContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

export interface GluvProviderProps {
  gluv: Gluv
  children: ReactNode
}

/**
 * Provider component for Gluv instance.
 * Wraps your application to provide Gluv context to all child components.
 *
 * @example
 * ```tsx
 * import { createGluv } from '@gluv/core'
 * import { GluvProvider } from '@gluv/react'
 *
 * const gluv = createGluv()
 *
 * function App() {
 *   return (
 *     <GluvProvider gluv={gluv}>
 *       <MyComponent />
 *     </GluvProvider>
 *   )
 * }
 * ```
 */
export function GluvProvider({ gluv, children }: GluvProviderProps): JSX.Element {
  const value = useMemo<GluvContextValue>(() => ({ gluv }), [gluv])

  return (
    <GluvReactContext.Provider value={value}>
      {children}
    </GluvReactContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the Gluv instance from context.
 * Must be used within a GluvProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { gluv } = useGluvContext()
 *   const capabilities = gluv.getCapabilities()
 *   // ...
 * }
 * ```
 */
export function useGluvContext(): GluvContextValue {
  const context = useContext(GluvReactContext)

  if (!context) {
    throw new Error('useGluvContext must be used within a GluvProvider')
  }

  return context
}

/**
 * Get the Gluv instance, returning null if not in provider.
 * Useful for optional Gluv integration.
 */
export function useOptionalGluvContext(): GluvContextValue | null {
  return useContext(GluvReactContext)
}
