/**
 * Shared header frame: brand link + nav slot + trailing actions slot.
 * Guest and operator headers only supply different links/actions.
 */

import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import {
  headerBrandClassName,
  headerInnerClassName,
  headerNavClassName,
  headerShellClassName,
} from "@/components/common/headerStyles"

type HeaderShellProps = {
  /** Brand link target (`/` guest, `/main` operator). */
  brandTo: string
  brandLabel?: string
  nav: ReactNode
  actions: ReactNode
}

export function HeaderShell({
  brandTo,
  brandLabel = "MIRRORIMAGE",
  nav,
  actions,
}: HeaderShellProps) {
  return (
    <header className={headerShellClassName}>
      <div className={headerInnerClassName}>
        <Link to={brandTo} className={headerBrandClassName}>
          {brandLabel}
        </Link>
        <nav className={headerNavClassName}>{nav}</nav>
        {actions}
      </div>
    </header>
  )
}
