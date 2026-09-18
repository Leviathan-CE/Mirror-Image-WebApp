/**
 * Replaces public routes with the coming-soon splash.
 * Header stays mounted so LOGIN / sign-out still work.
 */

import type { ReactNode } from "react"
import { useLocation } from "react-router-dom"

import { comingSoonBlocksVisitor } from "@/app/comingSoon.logic"
import { useAuth } from "@/app/providers/AuthProvider"
import { useComingSoon } from "@/app/providers/ComingSoonProvider"
import { AppHeader } from "@/components/common/AppHeader"
import { ComingSoonPage } from "@/pages/coming_soon/ComingSoonPage"

type ComingSoonGateProps = {
  children: ReactNode
}

export function ComingSoonGate({ children }: ComingSoonGateProps) {
  const { comingSoon, ready } = useComingSoon()
  const { user } = useAuth()
  const { pathname } = useLocation()

  if (!ready) {
    return <div className="min-h-screen bg-black" aria-busy="true" />
  }

  if (
    !comingSoonBlocksVisitor({
      comingSoon,
      role: user?.role,
      pathname,
    })
  ) {
    return children
  }

  return (
    <>
      <AppHeader />
      <main className="min-h-screen">
        <ComingSoonPage />
      </main>
    </>
  )
}
