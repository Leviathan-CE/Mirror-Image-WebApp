/**
 * Same GlitchFx shape as other CTAs — Stripe purple / white, text lockup only.
 */

import { GlitchFx } from "@/components/effects/GlitchFx"

type StripeCtaButtonProps = {
  verb: "Subscribe" | "Manage"
  busy?: boolean
  disabled?: boolean
  onClick: () => void
}

export function StripeCtaButton({
  verb,
  busy = false,
  disabled = false,
  onClick,
}: StripeCtaButtonProps) {
  const label = busy ? "REDIRECTING…" : `${verb.toUpperCase()} WITH STRIPE`

  return (
    <GlitchFx
      type="button"
      label={label}
      fxClassName="text-white [--glitch-a:#c4b5fd] [--glitch-b:#ffffff] [--glitch-bg:#635BFF]"
      disabled={disabled || busy}
      className="font-buahs93 h-9 rounded-none bg-[#635BFF] px-5 text-white hover:bg-[#0A2540] disabled:opacity-60"
      onClick={onClick}
    />
  )
}
