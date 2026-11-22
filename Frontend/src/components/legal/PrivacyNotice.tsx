/**
 * Short collection notice with links to the policy and terms.
 */

import { Link } from "react-router-dom"

import { ROUTES } from "@/lib/route"

type PrivacyNoticeProps = {
  children?: string
}

export function PrivacyNotice({ children }: PrivacyNoticeProps) {
  return (
    <p className="font-mono text-[11px] leading-relaxed text-cyan-100/60">
      {children ? `${children} ` : null}
      Read the{" "}
      <Link
        to={ROUTES.PRIVACY}
        className="text-cyan-200 underline underline-offset-2"
      >
        Privacy Policy
      </Link>
      {" "}and{" "}
      <Link
        to={ROUTES.TERMS}
        className="text-cyan-200 underline underline-offset-2"
      >
        Terms
      </Link>
      .
    </p>
  )
}
