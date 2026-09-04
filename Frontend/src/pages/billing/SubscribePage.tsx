/**
 * Legacy /subscribe route — Stripe and old links land here.
 * Forwards to Account Settings, preserving checkout query params.
 */

import { Navigate, useSearchParams } from "react-router-dom"

import { ROUTES } from "@/lib/route"

export function SubscribePage() {
  const [params] = useSearchParams()
  const search = params.toString()
  return (
    <Navigate
      to={search ? `${ROUTES.ACCOUNT}?${search}` : ROUTES.ACCOUNT}
      replace
    />
  )
}
