/**
 * Stripe wordmark for checkout CTAs.
 * Color #635BFF is Stripe's brand purple. Use white on cyan/dark fills.
 */

import { cn } from "@/lib/utils"

const STRIPE_WORDMARK_PATH =
  "M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.05 0 .45-.03 1.07-.07 1.93m-5.92-5.62c-1.21 0-2.54.74-2.54 3.15 0 .1 0 .2.02.3h4.48c-.02-1.95-.8-3.45-1.96-3.45m-17.78 10.18c-2.08 0-3.44-1.5-3.44-3.88 0-2.19 1.12-3.9 3.32-4.59l2.43-.73v-.51c0-.96-.54-1.54-1.56-1.54-1.1 0-1.87.5-2.17 1.37l-3.61-1.43c.7-1.86 2.78-3.37 5.96-3.37 3.13 0 5.39 1.74 5.39 4.96v8.02h-3.54v-1.65c-.8 1.22-2.19 1.92-3.76 1.92zm2.43-5.01v-.54l-1.87.57c-.83.25-1.29.74-1.29 1.48 0 .8.6 1.32 1.49 1.32 1.2 0 2.67-.77 2.67-2.25zM27.8 22.81c-2.97 0-4.59-1.46-4.59-1.46l1.92-2.96s1.46 1.13 3.1 1.13c1.08 0 1.84-.46 1.84-1.38 0-2.76-7.57-.69-7.57-6.16 0-2.87 2.37-5.04 5.89-5.04 2.08 0 4.01.72 4.01.72l-1.69 3.06s-1.34-.79-2.7-.79c-1.13 0-1.62.5-1.62 1.16 0 2.72 7.63.66 7.63 6.24.01 3.28-2.55 5.48-6.22 5.48zM15.5 7.75l-3.03 13.1h-3.7l1.12-4.8L7.5 7.75h3.82l1.31 5.46 1.63-5.46zm-8.7 0-3.38 13.1H0l3.03-13.1z"

type StripeWordmarkProps = {
  className?: string
  /** Hide from AT when a nearby "Pay with Stripe" label already names it. */
  decorative?: boolean
}

export function StripeWordmark({
  className,
  decorative = false,
}: StripeWordmarkProps) {
  return (
    <svg
      viewBox="0 0 60 25"
      className={cn("h-4 w-auto shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Stripe"}
      aria-hidden={decorative || undefined}
    >
      <path fill="currentColor" d={STRIPE_WORDMARK_PATH} />
    </svg>
  )
}

type PayWithStripeProps = {
  verb?: "Pay" | "Manage"
  className?: string
}

export function PayWithStripe({
  verb = "Pay",
  className,
}: PayWithStripeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-white/65",
        className
      )}
    >
      <span>{verb} with</span>
      <StripeWordmark decorative className="h-3.5 text-[#635BFF]" />
    </span>
  )
}
