/**
 * One-line mailing-list agreement with policy links.
 */

import { Link } from "react-router-dom"

import { ROUTES } from "@/lib/route"

type MailingConsentProps = {
  checked: boolean
  disabled: boolean
  onChecked: (checked: boolean) => void
}

const rowClass =
  "flex items-center gap-2 font-mono text-[11px] " +
  "leading-relaxed text-cyan-100/60"

const linkClass = "text-cyan-200 underline underline-offset-2"

export function MailingConsent({
  checked,
  disabled,
  onChecked,
}: MailingConsentProps) {
  return (
    <div className={rowClass}>
      <input
        id="mailing-list-agree"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChecked(event.target.checked)}
        aria-label={
          "I agree to the privacy policy and terms of service."
        }
        className="shrink-0"
      />
      <span>
        <label htmlFor="mailing-list-agree">
          I agree to the
        </label>
        {" "}
        <Link to={ROUTES.PRIVACY} className={linkClass}>
          privacy policy
        </Link>
        {" and "}
        <Link to={ROUTES.TERMS} className={linkClass}>
          terms of service
        </Link>
        .
      </span>
    </div>
  )
}
