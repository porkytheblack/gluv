import { useMutation, useQuery, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query'
import type { ActionResult } from '@gluv/core'
import { useGluvContext } from '../context'

// ============================================================================
// Mutation Hook
// ============================================================================

export interface UseActionMutationOptions<TResult = unknown, TParams = Record<string, unknown>>
  extends Omit<
    UseMutationOptions<ActionResult<TResult>, Error, TParams>,
    'mutationFn' | 'mutationKey'
  > {
  /** Capability name */
  capabilityName: string
}

/**
 * TanStack Query mutation hook for executing actions.
 *
 * @example
 * ```tsx
 * function AddToCartButton({ productId }: { productId: string }) {
 *   const mutation = useActionMutation<{ cartItemId: string }>({
 *     capabilityName: 'addToCart',
 *     onSuccess: (result) => {
 *       if (result.status === 'success') {
 *         queryClient.invalidateQueries({ queryKey: ['cart'] })
 *       }
 *     },
 *   })
 *
 *   return (
 *     <button
 *       onClick={() => mutation.mutate({ productId, quantity: 1 })}
 *       disabled={mutation.isPending}
 *     >
 *       {mutation.isPending ? 'Adding...' : 'Add to Cart'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useActionMutation<TResult = unknown, TParams = Record<string, unknown>>({
  capabilityName,
  ...options
}: UseActionMutationOptions<TResult, TParams>) {
  const { gluv } = useGluvContext()

  return useMutation<ActionResult<TResult>, Error, TParams>({
    mutationKey: ['gluv', 'action', capabilityName],
    mutationFn: async (params: TParams) => {
      return gluv.executeAction<TResult>(capabilityName, params as Record<string, unknown>)
    },
    ...options,
  })
}

// ============================================================================
// Query Hook (for idempotent actions)
// ============================================================================

export interface UseActionQueryOptions<TResult = unknown>
  extends Omit<
    UseQueryOptions<ActionResult<TResult>, Error>,
    'queryFn' | 'queryKey'
  > {
  /** Capability name */
  capabilityName: string

  /** Action parameters */
  params: Record<string, unknown>

  /** Custom query key suffix */
  queryKeySuffix?: string[]
}

/**
 * TanStack Query hook for idempotent actions (fetching data).
 * Use this for 'action-idempotent' capabilities that retrieve data.
 *
 * @example
 * ```tsx
 * function CartSummary() {
 *   const { data, isLoading, error } = useActionQuery<CartData>({
 *     capabilityName: 'getCartSummary',
 *     params: {},
 *   })
 *
 *   if (isLoading) return <Skeleton />
 *   if (error) return <Error error={error} />
 *
 *   return <CartDisplay cart={data?.data} />
 * }
 * ```
 */
export function useActionQuery<TResult = unknown>({
  capabilityName,
  params,
  queryKeySuffix = [],
  ...options
}: UseActionQueryOptions<TResult>) {
  const { gluv } = useGluvContext()

  return useQuery<ActionResult<TResult>, Error>({
    queryKey: ['gluv', 'action', capabilityName, params, ...queryKeySuffix],
    queryFn: async () => {
      return gluv.executeAction<TResult>(capabilityName, params)
    },
    ...options,
  })
}

// ============================================================================
// Capabilities Query
// ============================================================================

/**
 * Hook for fetching capabilities with TanStack Query caching.
 *
 * @example
 * ```tsx
 * function CapabilityList() {
 *   const { data: capabilities } = useCapabilitiesQuery()
 *
 *   return (
 *     <ul>
 *       {capabilities?.map((cap) => (
 *         <li key={cap.name}>{cap.description}</li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useCapabilitiesQuery() {
  const { gluv } = useGluvContext()

  return useQuery({
    queryKey: ['gluv', 'capabilities'],
    queryFn: () => gluv.getCapabilities(),
    staleTime: Infinity, // Capabilities don't change at runtime
  })
}

// ============================================================================
// History Query
// ============================================================================

/**
 * Hook for accessing action history with TanStack Query.
 */
export function useHistoryQuery() {
  const { gluv } = useGluvContext()

  return useQuery({
    queryKey: ['gluv', 'history'],
    queryFn: () => gluv.getHistory(),
    staleTime: 0, // Always refetch
  })
}
