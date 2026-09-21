/**
 * Official-style Stripe wordmark (brand color via currentColor).
 * Use to mark checkout / portal as billed through Stripe.
 */

import { cn } from "@/lib/utils"

type StripeWordmarkProps = {
  className?: string
}

export function StripeWordmark({ className }: StripeWordmarkProps) {
  return (
    <svg
      viewBox="0 0 60 25"
      role="img"
      aria-label="Stripe"
      className={cn("h-4 w-auto shrink-0", className)}
    >
      <title>Stripe</title>
      <path
        fill="currentColor"
        d="M5.7 14.2c0-.8.7-1.1 1.8-1.1 1.6 0 3.6.5 5.2 1.4v-5c-1.7-.7-3.4-1-5.2-1-4.2 0-7 2.2-7 5.8 0 5.7 7.8 4.8 7.8 7.2 0 .9-.8 1.2-2 1.2-1.7 0-3.9-.7-5.6-1.7v5.1c1.9.8 3.8 1.2 5.6 1.2 4.3 0 7.2-2.1 7.2-5.8.1-6.1-7.8-5-7.8-7.3zm22.3-5.2c-2.2 0-3.8 1-4.6 2.6l-.2-2.1h-5.2v19.1l5.8-1.2v-4.6c.8 1.5 2.4 2.4 4.4 2.4 3.5 0 6.6-2.8 6.6-8.1-.2-5.2-3.3-8.1-6.8-8.1zm-1 12.7c-1.5 0-2.4-.8-2.8-1.8V11c.5-1.1 1.4-1.8 2.8-1.8 2.1 0 3.5 2.3 3.5 5.3 0 3-1.4 5.2-3.5 5.2zm16.8-12.9c-2.2 0-3.8 1-4.6 2.6l-.2-2.1h-5.2v19.1l5.8-1.2v-4.6c.8 1.5 2.4 2.4 4.3 2.4 3.5 0 6.6-2.8 6.6-8.1.1-5.2-3.1-8.1-6.7-8.1zm-1 12.7c-1.5 0-2.4-.8-2.9-1.8V11c.5-1.1 1.5-1.8 2.9-1.8 2.1 0 3.5 2.3 3.5 5.3 0 3-1.4 5.2-3.5 5.2zM60 3.6l-5.8 1.2v4.3c-.8-1.4-2.3-2.6-4.5-2.6-4.1 0-7.3 3.6-7.3 8.3 0 4.6 3.2 8.1 7.3 8.1 2 0 3.8-1 4.7-2.6l.2 2.1H60V3.6zm-5.8 13.4c-.5 1.1-1.5 1.9-2.9 1.9-2.2 0-3.6-2.2-3.6-5.3 0-3.1 1.4-5.3 3.6-5.3 1.4 0 2.4.8 2.9 1.9v6.8z"
      />
    </svg>
  )
}

type PayWithStripeProps = {
  /** Caption before the wordmark. */
  verb?: string
  className?: string
}

export function PayWithStripe({
  verb = "Pay with",
  className,
}: PayWithStripeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-white/45",
        className
      )}
    >
      {verb}
      <StripeWordmark className="h-3.5 w-auto text-[#635BFF]" />
    </span>
  )
}
