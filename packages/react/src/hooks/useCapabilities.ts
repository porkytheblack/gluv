import { useMemo } from 'react'
import { useGluvContext } from '../context'
import type { CapabilityInfo } from '../types'

export interface UseCapabilitiesResult {
  /** All registered capabilities */
  capabilities: CapabilityInfo[]

  /** Get capability by name */
  getCapability: (name: string) => CapabilityInfo | undefined

  /** Check if capability exists */
  hasCapability: (name: string) => boolean

  /** Get capabilities by tags */
  getByTags: (tags: string[]) => CapabilityInfo[]

  /** Get fold capabilities */
  folds: CapabilityInfo[]

  /** Get unfold capabilities */
  unfolds: CapabilityInfo[]

  /** Get capabilities requiring confirmation */
  confirmRequired: CapabilityInfo[]
}

/**
 * Hook for accessing registered capabilities.
 *
 * @example
 * ```tsx
 * function CapabilityList() {
 *   const { capabilities, folds, unfolds, getByTags } = useCapabilities()
 *
 *   const cartCapabilities = getByTags(['cart'])
 *
 *   return (
 *     <div>
 *       <h2>Available Actions</h2>
 *       <ul>
 *         {folds.map((cap) => (
 *           <li key={cap.name}>
 *             <strong>{cap.name}</strong>: {cap.description}
 *             {cap.requireConfirm && <span> (requires confirmation)</span>}
 *           </li>
 *         ))}
 *       </ul>
 *
 *       <h2>User Inputs</h2>
 *       <ul>
 *         {unfolds.map((cap) => (
 *           <li key={cap.name}>
 *             <strong>{cap.name}</strong>: {cap.description}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 * ```
 */
export function useCapabilities(): UseCapabilitiesResult {
  const { gluv } = useGluvContext()

  return useMemo(() => {
    const capabilities = gluv.getCapabilities()

    const getCapability = (name: string) =>
      capabilities.find((c) => c.name === name)

    const hasCapability = (name: string) =>
      capabilities.some((c) => c.name === name)

    const getByTags = (tags: string[]) =>
      capabilities.filter((c) => c.tags?.some((t) => tags.includes(t)))

    const folds = capabilities.filter((c) => c.kind === 'fold')

    const unfolds = capabilities.filter((c) => c.kind === 'unfold')

    const confirmRequired = capabilities.filter((c) => c.requireConfirm)

    return {
      capabilities,
      getCapability,
      hasCapability,
      getByTags,
      folds,
      unfolds,
      confirmRequired,
    }
  }, [gluv])
}

/**
 * Hook for getting a specific capability.
 */
export function useCapability(name: string): CapabilityInfo | undefined {
  const { capabilities } = useCapabilities()
  return useMemo(
    () => capabilities.find((c) => c.name === name),
    [capabilities, name]
  )
}
