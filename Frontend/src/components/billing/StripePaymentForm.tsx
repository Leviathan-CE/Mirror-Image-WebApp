/**
 * On-site Stripe Payment Element (subscribe or one-time print).
 */

import { useMemo, useState, type ReactNode } from "react"
import type { SubmitEvent } from "react"
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import { loadStripe, type Stripe } from "@stripe/stripe-js"

import { GlitchFx } from "@/components/effects/GlitchFx"
import { cn } from "@/lib/utils"

type StripePaymentFormProps = {
  publishableKey: string
  clientSecret: string
  submitLabel: string
  disabled?: boolean
  onPaid: () => void | Promise<void>
  onError: (message: string) => void
  /** Extra controls rendered on the same row as Pay (e.g. Cancel). */
  actions?: ReactNode
}

type InnerFormProps = {
  submitLabel: string
  disabled?: boolean
  onPaid: () => void | Promise<void>
  onError: (message: string) => void
  actions?: ReactNode
}

function PaymentElementForm({
  submitLabel,
  disabled,
  onPaid,
  onError,
  actions,
}: InnerFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stripe || !elements || busy || disabled) return
    setBusy(true)
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      })
      if (result.error) {
        onError(result.error.message || "Payment failed.")
        return
      }
      await onPaid()
    } catch {
      onError("Payment could not be confirmed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mt-4 space-y-4">
      <div className="border border-cyan-500/20 bg-black/40 p-3">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>
      <p className="font-mono text-[10px] text-cyan-100/45">
        Card details are processed by Stripe on this page; we never see your
        full card number.
      </p>
      <div className="flex flex-row flex-wrap items-stretch gap-2">
        <GlitchFx
          type="submit"
          label={busy ? "PROCESSING…" : submitLabel}
          disabled={busy || disabled || !stripe || !elements}
          fxClassName="block min-w-0 flex-1"
          className={cn(
            "font-buahs93 h-9 w-full rounded-none bg-cyan-700 px-2",
            "text-xs text-white hover:bg-cyan-900",
            "disabled:opacity-60 sm:text-sm"
          )}
        />
        {actions}
      </div>
    </form>
  )
}

const stripeCache = new Map<string, Promise<Stripe | null>>()

function stripePromiseFor(key: string): Promise<Stripe | null> {
  const existing = stripeCache.get(key)
  if (existing) return existing
  const created = loadStripe(key)
  stripeCache.set(key, created)
  return created
}

export function StripePaymentForm({
  publishableKey,
  clientSecret,
  submitLabel,
  disabled,
  onPaid,
  onError,
  actions,
}: StripePaymentFormProps) {
  const stripePromise = useMemo(
    () => stripePromiseFor(publishableKey),
    [publishableKey]
  )

  if (!publishableKey || !clientSecret) {
    return null
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#22d3ee",
            colorBackground: "#05080c",
            colorText: "#e0f2fe",
            borderRadius: "0px",
          },
        },
      }}
    >
      <PaymentElementForm
        submitLabel={submitLabel}
        disabled={disabled}
        onPaid={onPaid}
        onError={onError}
        actions={actions}
      />
    </Elements>
  )
}
