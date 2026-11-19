/**
 * One-time print PDF purchase via Stripe Payment Element.
 */

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router-dom"

import { StripePaymentForm } from "@/components/billing/StripePaymentForm"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { ApiError } from "@/lib/api/client"
import {
  confirmPrintPayment,
  createPrintIntent,
  fetchBillingConfig,
  fetchPrintQuote,
  type PrintQuote,
} from "@/lib/api/billing"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

type DeckPrintPayPanelProps = {
  token: string
  deckId: number
  open: boolean
  busy: boolean
  onClose: () => void
  onUnlocked: () => void | Promise<void>
}

export function DeckPrintPayPanel({
  token,
  deckId,
  open,
  busy,
  onClose,
  onUnlocked,
}: DeckPrintPayPanelProps) {
  const [quote, setQuote] = useState<PrintQuote | null>(null)
  const [publishableKey, setPublishableKey] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [paymentIntentId, setPaymentIntentId] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState("")
  const onUnlockedRef = useRef(onUnlocked)
  onUnlockedRef.current = onUnlocked

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)
    setErrorText("")
    setClientSecret("")
    setPaymentIntentId("")

    void (async () => {
      try {
        const nextQuote = await fetchPrintQuote(token, deckId)
        if (cancelled) return
        setQuote(nextQuote)
        if (nextQuote.entitled_free) {
          await onUnlockedRef.current()
          return
        }
        const [config, intent] = await Promise.all([
          fetchBillingConfig(),
          createPrintIntent(token, deckId),
        ])
        if (cancelled) return
        if (!config.publishable_key) {
          setErrorText(
            "Add STRIPE_PUBLISHABLE_KEY to the server .env for on-site pay."
          )
          return
        }
        setPublishableKey(config.publishable_key)
        setClientSecret(intent.client_secret)
        setPaymentIntentId(intent.payment_intent_id)
      } catch (error: unknown) {
        if (cancelled) return
        if (error instanceof ApiError) {
          if (error.detail === "print_already_entitled") {
            await onUnlockedRef.current()
            return
          }
          setErrorText(error.detail || "Could not start print checkout.")
        } else {
          setErrorText("Could not reach the server.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, token, deckId])

  if (!open) return null

  async function onPaid() {
    if (!paymentIntentId) return
    setErrorText("")
    try {
      await confirmPrintPayment(token, paymentIntentId)
      await onUnlocked()
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setErrorText(error.detail || "Could not confirm print payment.")
      } else {
        setErrorText("Could not confirm print payment.")
      }
    }
  }

  // Portal to body so fixed positioning is not trapped under the
  // site header stacking context (header is fixed z-40).
  return createPortal(
    <div
      className={cn(
        "mi-scrollbar fixed inset-0 z-[100] flex justify-center",
        "overflow-y-auto overscroll-contain bg-black/70",
        // Clear the fixed header (pt-2 + brand row + fade)
        "px-3 pb-3 pt-20 sm:px-6 sm:pb-6 sm:pt-24"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-print-pay-title"
    >
      <div
        className={cn(
          "mi-scrollbar my-auto w-full max-w-md border",
          "border-cyan-500/30 max-h-[calc(100dvh-6.5rem)]",
          "overflow-y-auto bg-[#05080c] p-4 shadow-xl",
          "sm:max-w-lg sm:p-5 sm:max-h-[calc(100dvh-8rem)]",
          "lg:max-w-xl"
        )}
      >
        <h2
          id="deck-print-pay-title"
          className="font-buahs93 text-sm tracking-wide text-cyan-100"
        >
          PRINT DOWNLOAD
        </h2>
        <p className="mt-2 font-mono text-[11px] text-cyan-100/55">
          Free prints follow your plan (L1: 5/month, L2: 15/month,
          L3: unlimited). Past that, one-time download is 25¢ per card
          ($1.99 minimum under 8 cards).
        </p>
        {quote ? (
          <p className="mt-3 font-mono text-xs text-cyan-50/90">
            {quote.card_count} card
            {quote.card_count === 1 ? "" : "s"} · {quote.amount_display}
          </p>
        ) : null}
        {loading ? (
          <p className="mt-4 font-mono text-[11px] text-cyan-100/50">
            Preparing secure payment…
          </p>
        ) : null}
        {errorText ? (
          <p className="mt-3 font-mono text-[11px] text-red-300" role="alert">
            {errorText}
          </p>
        ) : null}
        {!loading && publishableKey && clientSecret ? (
          <StripePaymentForm
            publishableKey={publishableKey}
            clientSecret={clientSecret}
            submitLabel={
              quote
                ? `PAY ${quote.amount_display.toUpperCase()}`
                : "PAY FOR PRINT"
            }
            disabled={busy}
            onPaid={() => void onPaid()}
            onError={(message) => setErrorText(message)}
            actions={
              <>
                <Link
                  to={ROUTES.PLANS}
                  className={cn(
                    "font-buahs93 inline-flex h-9 flex-1 items-center",
                    "justify-center border border-cyan-500/40",
                    "bg-black/60 px-2 text-center text-[10px]",
                    "text-cyan-100 hover:border-cyan-400/70",
                    "hover:bg-cyan-500/10 sm:text-xs"
                  )}
                >
                  SUBSCRIBE
                </Link>
                <GlitchFx
                  type="button"
                  label="CANCEL"
                  disabled={busy || loading}
                  fxClassName="block w-full sm:w-auto"
                  className={cn(
                    "font-buahs93 h-9 w-full rounded-none border",
                    "border-white/20 bg-transparent px-4",
                    "text-white/80 hover:bg-white/5",
                    "disabled:opacity-60 sm:w-auto"
                  )}
                  onClick={onClose}
                />
              </>
            }
          />
        ) : (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              to={ROUTES.PLANS}
              className={cn(
                "font-buahs93 inline-flex h-9 flex-1 items-center",
                "justify-center border border-cyan-500/40 bg-black/60",
                "px-3 text-center text-xs text-cyan-100",
                "hover:border-cyan-400/70 hover:bg-cyan-500/10"
              )}
            >
              SUBSCRIBE
            </Link>
            <GlitchFx
              type="button"
              label="CANCEL"
              disabled={busy || loading}
              className={cn(
                "font-buahs93 h-9 w-full rounded-none border",
                "border-white/20 bg-transparent px-4 text-white/80",
                "hover:bg-white/5 disabled:opacity-60 sm:w-auto"
              )}
              onClick={onClose}
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
