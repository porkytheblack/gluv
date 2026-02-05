import { useState, useCallback, useMemo, useEffect } from 'react'
import { useForm, type UseFormReturn, type FieldValues, type DefaultValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import type { GluvContext, ActionResult, UnfoldDefinition } from '@gluv/core'
import { useGluvContext } from '../context'

export interface UseUnfoldFormOptions<TFormValues extends FieldValues> {
  /** Capability name */
  capabilityName: string

  /** Initial values (optional, overrides schema defaults) */
  defaultValues?: DefaultValues<TFormValues>

  /** Called when form submission succeeds */
  onSuccess?: (result: ActionResult) => void

  /** Called when form submission fails */
  onError?: (error: Error) => void

  /** Called when form is cancelled */
  onCancel?: () => void

  /** Additional parameters passed to the unfold */
  params?: Record<string, unknown>
}

export interface UseUnfoldFormResult<TFormValues extends FieldValues> {
  /** React Hook Form instance */
  form: UseFormReturn<TFormValues>

  /** Context for UI rendering */
  context: Readonly<GluvContext> | null

  /** Whether the form is submitting */
  isSubmitting: boolean

  /** Whether the form was submitted successfully */
  isSuccess: boolean

  /** Submission result */
  result: ActionResult | null

  /** Submission error */
  error: Error | null

  /** Submit the form */
  submit: () => Promise<void>

  /** Cancel the form */
  cancel: () => void

  /** Reset the form */
  reset: () => void

  /** The UI component from the unfold definition */
  ui: React.ReactNode | null
}

/**
 * Hook for rendering and handling unfold (user-input collection) forms.
 *
 * @example
 * ```tsx
 * function PaymentForm() {
 *   const {
 *     form,
 *     context,
 *     isSubmitting,
 *     submit,
 *     cancel,
 *     ui,
 *   } = useUnfoldForm<PaymentFormValues>({
 *     capabilityName: 'collectPaymentMethod',
 *     params: { amount: 99.99, currency: 'USD' },
 *     onSuccess: () => navigate('/confirmation'),
 *     onError: (err) => toast.error(err.message),
 *   })
 *
 *   // Option 1: Use the UI from the unfold definition
 *   if (ui) return <>{ui}</>
 *
 *   // Option 2: Build your own UI using the form instance
 *   return (
 *     <form onSubmit={form.handleSubmit(submit)}>
 *       <input {...form.register('cardNumber')} />
 *       <input {...form.register('expiryDate')} />
 *       <input {...form.register('cvv')} />
 *       <button type="submit" disabled={isSubmitting}>
 *         {isSubmitting ? 'Processing...' : 'Pay'}
 *       </button>
 *       <button type="button" onClick={cancel}>Cancel</button>
 *     </form>
 *   )
 * }
 * ```
 */
export function useUnfoldForm<TFormValues extends FieldValues>(
  options: UseUnfoldFormOptions<TFormValues>
): UseUnfoldFormResult<TFormValues> {
  const { gluv } = useGluvContext()
  const {
    capabilityName,
    defaultValues,
    onSuccess,
    onError,
    onCancel,
    params = {},
  } = options

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [context, setContext] = useState<Readonly<GluvContext> | null>(null)

  // Get the capability definition
  const capability = useMemo(() => {
    try {
      const stored = gluv.getCapability(capabilityName)
      if (stored.kind !== 'unfold') {
        throw new Error(`Capability "${capabilityName}" is not an unfold`)
      }
      return stored.definition as UnfoldDefinition<z.ZodType, z.ZodType>
    } catch (err) {
      console.error(err)
      return null
    }
  }, [gluv, capabilityName])

  // Create form with Zod resolver
  const form = useForm<TFormValues>({
    resolver: capability ? zodResolver(capability.resultSchema) : undefined,
    defaultValues,
  })

  // Load context on mount
  useEffect(() => {
    let mounted = true

    gluv.createContext().then((ctx) => {
      if (mounted) {
        setContext(Object.freeze(ctx))
      }
    })

    return () => {
      mounted = false
    }
  }, [gluv])

  // Submit handler
  const submit = useCallback(async () => {
    if (!capability) {
      const err = new Error(`Capability "${capabilityName}" not found`)
      setError(err)
      onError?.(err)
      return
    }

    const values = form.getValues()

    // Run custom validation if defined
    if (capability.validate) {
      const validationResult = capability.validate(values)
      if (!validationResult.valid) {
        Object.entries(validationResult.errors).forEach(([field, message]) => {
          form.setError(field as keyof TFormValues as any, { message })
        })
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const ctx = await gluv.createContext()
      const actionResult = await capability.do(ctx, values)

      setResult(actionResult)

      if (actionResult.status === 'success') {
        setIsSuccess(true)
        onSuccess?.(actionResult)
      } else if (actionResult.status === 'failure') {
        const err = new Error(actionResult.error?.message ?? 'Submission failed')
        setError(err)
        onError?.(err)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
    } finally {
      setIsSubmitting(false)
    }
  }, [capability, capabilityName, form, gluv, onSuccess, onError])

  // Cancel handler
  const cancel = useCallback(() => {
    form.reset()
    onCancel?.()
  }, [form, onCancel])

  // Reset handler
  const reset = useCallback(() => {
    form.reset()
    setIsSubmitting(false)
    setIsSuccess(false)
    setResult(null)
    setError(null)
  }, [form])

  // Render UI from capability definition
  const ui = useMemo(() => {
    if (!capability || !context) return null
    return capability.ui(form, context) as React.ReactNode
  }, [capability, form, context])

  return useMemo(
    () => ({
      form,
      context,
      isSubmitting,
      isSuccess,
      result,
      error,
      submit,
      cancel,
      reset,
      ui,
    }),
    [form, context, isSubmitting, isSuccess, result, error, submit, cancel, reset, ui]
  )
}

/**
 * Hook for just getting the unfold UI component.
 * Simpler alternative when you don't need full form control.
 */
export function useUnfoldUI(
  capabilityName: string,
  params: Record<string, unknown> = {}
): {
  ui: React.ReactNode | null
  isLoading: boolean
  error: Error | null
} {
  const { gluv } = useGluvContext()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [ui, setUI] = useState<React.ReactNode | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadUI() {
      try {
        const capability = gluv.getCapability(capabilityName)
        if (capability.kind !== 'unfold') {
          throw new Error(`Capability "${capabilityName}" is not an unfold`)
        }

        const definition = capability.definition as UnfoldDefinition<z.ZodType, z.ZodType>
        const context = await gluv.createContext()

        // Create a minimal form instance for UI rendering
        const dummyForm = {} as UseFormReturn<FieldValues>

        if (mounted) {
          setUI(definition.ui(dummyForm, context) as React.ReactNode)
          setIsLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsLoading(false)
        }
      }
    }

    loadUI()

    return () => {
      mounted = false
    }
  }, [gluv, capabilityName, params])

  return { ui, isLoading, error }
}
